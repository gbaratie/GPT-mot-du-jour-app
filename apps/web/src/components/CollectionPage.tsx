"use client";

import Link from "next/link";
import DiscoveryDeck from "./DiscoveryDeck";
import CardFeedback from "./CardFeedback";
import CachedContentNotice from "./CachedContentNotice";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { EntryRenderer } from "@/collections/EntryRenderer";
import { api, ApiError } from "@/lib/api/client";
import type { Collection, DailyEntry } from "@/lib/api/types";
import { formatDate, isDate } from "@/lib/dates";

type Result = {
  entry: DailyEntry | null;
  history: DailyEntry[];
  entryError: string | null;
  historyError: boolean;
  entryLoading: boolean;
  historyLoading: boolean;
};

function errorMessage(error: unknown): string {
  return error instanceof ApiError && error.status === 404
    ? "Aucun contenu pour cette date. Vous pouvez consulter les archives ci-dessous."
    : "Le contenu est indisponible pour le moment. Réessayez dans quelques instants.";
}

export default function CollectionPage({ collection }: { collection: Collection }) {
  const params = useSearchParams();
  const day = params.get("date");
  return (
    <CollectionView
      key={`${collection.slug}:${day ?? "today"}`}
      collection={collection}
      day={day}
    />
  );
}

function CollectionView({ collection, day }: { collection: Collection; day: string | null }) {
  const router = useRouter();
  const valid = day === null || isDate(day);
  const [draft, setDraft] = useState(day ?? "");
  const [result, setResult] = useState<Result>({
    entry: null,
    history: [],
    entryError: null,
    historyError: false,
    entryLoading: true,
    historyLoading: true,
  });
  const [cacheStatus, setCacheStatus] = useState<"refreshing" | "offline" | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [moreError, setMoreError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    const savedEntry = api.cachedEntry(collection.slug, day);
    const savedHistory = api.cachedHistory(collection.slug, day);
    // Apply browser storage after hydration, ignoring an abandoned effect.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setCacheStatus(savedEntry && day === null ? "refreshing" : null);
      setHasMore(savedHistory?.length === 10);
      setResult({
        entry: savedEntry ?? null,
        history: savedHistory ?? [],
        entryError: null,
        historyError: false,
        entryLoading: !savedEntry,
        historyLoading: !savedHistory,
      });
    });
    // The publication can be read while the independent archive request is pending.
    api.entry(collection.slug, day, controller.signal, { fallback: false }).then(
      (entry) => {
        if (controller.signal.aborted) return;
        setResult((current) => ({ ...current, entry, entryLoading: false }));
        setCacheStatus(null);
      },
      (failure) => {
        if (controller.signal.aborted) return;
        const rejected = failure instanceof ApiError && failure.status < 500;
        const retained = savedEntry && !rejected;
        setCacheStatus(retained ? "offline" : null);
        setResult((current) => ({
          ...current,
          entry: retained ? savedEntry : null,
          entryError: retained ? null : errorMessage(failure),
          entryLoading: false,
        }));
      },
    );
    api.history(collection.slug, day, controller.signal).then(
      (history) => {
        if (controller.signal.aborted) return;
        setHasMore(history.length === 10);
        setResult((current) => ({ ...current, history, historyLoading: false }));
      },
      () => {
        if (controller.signal.aborted) return;
        setResult((current) => ({ ...current, historyError: true, historyLoading: false }));
      },
    );
    const reconnect = () => setAttempt((value) => value + 1);
    window.addEventListener("online", reconnect);
    return () => {
      controller.abort();
      window.removeEventListener("online", reconnect);
    };
  }, [collection.slug, day, valid, attempt]);

  function navigate(selected: string | null) {
    if (selected === day) return;
    router.push(`/${collection.slug}/${selected ? `?date=${selected}` : ""}`, { scroll: false });
  }

  async function loadMore() {
    if (!result.history.length) return;
    const before = result.history[result.history.length - 1].publication_date;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const history = await api.history(collection.slug, before);
      setResult((current) => ({ ...current, history: [...current.history, ...history] }));
      setHasMore(history.length === 10);
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Stack spacing={3} className="collection-view">
      <Box>
        <Typography variant="overline" color="primary">
          Une découverte à la fois
        </Typography>
        <Typography variant="h1" sx={{ mt: 1, mb: 2 }}>
          {collection.name}
        </Typography>
        <Typography color="text.secondary">{collection.description}</Typography>
      </Box>
      <Stack
        component="form"
        className="date-controls"
        direction={{ xs: "column", sm: "row" }}
        sx={{ gap: 2, alignItems: { sm: "center" } }}
        onSubmit={(event) => {
          event.preventDefault();
          if (isDate(draft)) navigate(draft);
        }}
      >
        <TextField
          label="Choisir une date"
          type="date"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          size="small"
        />
        <Button type="submit" variant="outlined" disabled={!isDate(draft)}>
          Consulter
        </Button>
        <Button onClick={() => navigate(null)} disabled={day === null}>
          Aujourd’hui
        </Button>
      </Stack>
      {!valid ? (
        <Alert severity="warning">Date invalide. Utilisez le format AAAA-MM-JJ.</Alert>
      ) : result.entryLoading ? (
        <Skeleton
          role="status"
          aria-label="Chargement de la publication"
          variant="rounded"
          height={260}
        />
      ) : (
        <>
          {cacheStatus && (
            <CachedContentNotice
              refreshing={cacheStatus === "refreshing"}
              onRetry={() => setAttempt((value) => value + 1)}
            />
          )}
          {result.entryError && (
            <Alert
              severity="info"
              action={
                <Button
                  onClick={() => {
                    setAttempt(attempt + 1);
                  }}
                >
                  Réessayer
                </Button>
              }
            >
              {result.entryError}
            </Alert>
          )}
          <DiscoveryDeck slug={collection.slug} locale={collection.locale} initial={result.entry} />
          <Box className="archive-section">
            <Typography variant="h2" sx={{ mb: 3 }}>
              Les jours précédents
            </Typography>
            {result.historyLoading ? (
              <Skeleton role="status" aria-label="Chargement des archives" height={120} />
            ) : result.historyError ? (
              <Alert severity="warning">Les archives ne sont pas disponibles pour le moment.</Alert>
            ) : !result.history.length ? (
              <Typography color="text.secondary">
                Aucune publication antérieure à cette date.
              </Typography>
            ) : (
              <Stack spacing={2} className="archive-grid">
                {result.history.map((entry) => (
                  <Card key={entry.publication_date}>
                    <CardContent sx={{ p: 3 }}>
                      <Button
                        component={Link}
                        href={`/${collection.slug}/?date=${entry.publication_date}`}
                        sx={{ mb: 2 }}
                      >
                        {formatDate(entry.publication_date, collection.locale)}
                      </Button>
                      <EntryRenderer entry={entry} />
                      <CardFeedback entry={entry} />
                    </CardContent>
                  </Card>
                ))}
                {moreError && (
                  <Alert severity="warning">
                    Les publications suivantes n’ont pas pu être chargées.
                  </Alert>
                )}
                {hasMore && (
                  <Box>
                    <Button onClick={loadMore} disabled={loadingMore}>
                      {loadingMore ? "Chargement…" : "Voir plus de publications"}
                    </Button>
                  </Box>
                )}
              </Stack>
            )}
          </Box>
        </>
      )}
    </Stack>
  );
}
