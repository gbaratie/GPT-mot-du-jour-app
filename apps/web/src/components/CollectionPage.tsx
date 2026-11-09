"use client";

import Link from "next/link";
import DiscoveryDeck from "./DiscoveryDeck";
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
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [moreError, setMoreError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    Promise.allSettled([
      api.entry(collection.slug, day, controller.signal),
      api.history(collection.slug, day, controller.signal),
    ]).then(([entry, history]) => {
      if (controller.signal.aborted) return;
      setHasMore(history.status === "fulfilled" && history.value.length === 10);
      setResult({
        entry: entry.status === "fulfilled" ? entry.value : null,
        history: history.status === "fulfilled" ? history.value : [],
        entryError: entry.status === "rejected" ? errorMessage(entry.reason) : null,
        historyError: history.status === "rejected",
      });
    });
    return () => controller.abort();
  }, [collection.slug, day, valid, attempt]);

  function navigate(selected: string | null) {
    if (selected === day) return;
    router.push(`/${collection.slug}/${selected ? `?date=${selected}` : ""}`, { scroll: false });
  }

  async function loadMore() {
    if (!result?.history.length) return;
    const before = result.history[result.history.length - 1].publication_date;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const history = await api.history(collection.slug, before);
      setResult((current) =>
        current ? { ...current, history: [...current.history, ...history] } : current,
      );
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
      ) : !result ? (
        <Skeleton
          role="status"
          aria-label="Chargement de la publication"
          variant="rounded"
          height={260}
        />
      ) : (
        <>
          {result.entry ? (
            <Card className="publication-card">
              <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
                <DiscoveryDeck
                  key={result.entry.publication_date}
                  slug={collection.slug}
                  locale={collection.locale}
                  initial={result.entry}
                />
              </CardContent>
            </Card>
          ) : (
            <Alert
              severity="info"
              action={
                <Button
                  onClick={() => {
                    setResult(null);
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
          {!result.entry && (
            <DiscoveryDeck slug={collection.slug} locale={collection.locale} initial={null} />
          )}
          <Box className="archive-section">
            <Typography variant="h2" sx={{ mb: 3 }}>
              Les jours précédents
            </Typography>
            {result.historyError ? (
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
