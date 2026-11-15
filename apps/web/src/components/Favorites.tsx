"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";
import { api } from "@/lib/api/client";
import type { DailyEntry } from "@/lib/api/types";
import { collections } from "@/collections/catalog";
import { EntryRenderer } from "@/collections/EntryRenderer";
import { formatDate } from "@/lib/dates";
import CardFeedback from "./CardFeedback";

export default function Favorites() {
  const [entries, setEntries] = useState<DailyEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api
      .favorites(0, controller.signal)
      .then((items) => {
        setEntries(items);
        setOffset(items.length);
        setMore(items.length === 20);
        setError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [attempt]);

  async function loadMore() {
    setBusy(true);
    setError(false);
    try {
      const items = await api.favorites(offset);
      setEntries((current) => [...(current ?? []), ...items]);
      setOffset((n) => n + items.length);
      setMore(items.length === 20);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack className="favorites-view" sx={{ gap: 3 }}>
      <Box>
        <Typography variant="h1">Mes favoris</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Les cartes que vous aimez, retrouvées sur ce navigateur.
        </Typography>
      </Box>
      {error && (
        <Alert
          severity="warning"
          action={
            <Button onClick={() => (entries ? void loadMore() : setAttempt((n) => n + 1))}>
              Réessayer
            </Button>
          }
        >
          Impossible de charger vos favoris.
        </Alert>
      )}
      {!entries && !error ? (
        <Skeleton
          variant="rounded"
          height={240}
          role="status"
          aria-label="Chargement des favoris"
        />
      ) : entries?.length === 0 ? (
        <Box>
          <Typography color="text.secondary">
            Aucun favori pour le moment. Touchez « J’aime » sur une carte pour la retrouver ici.
          </Typography>
          <Button component={Link} href="/" sx={{ mt: 2 }}>
            Découvrir les cartes
          </Button>
        </Box>
      ) : (
        <Stack className="archive-grid" spacing={2}>
          {entries?.map((entry) => {
            const collection = collections.find((c) => c.slug === entry.collection_slug);
            return (
              <Card key={`${entry.collection_slug}:${entry.publication_date}`}>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                  <Typography variant="h2" sx={{ fontSize: "1.1rem", mb: 1 }}>
                    {collection?.name ?? entry.collection_slug}
                  </Typography>
                  <Button
                    component={Link}
                    href={`/${entry.collection_slug}/?date=${entry.publication_date}`}
                    sx={{ mb: 1 }}
                  >
                    {formatDate(entry.publication_date, collection?.locale)}
                  </Button>
                  <EntryRenderer entry={entry} />
                  <CardFeedback
                    entry={entry}
                    initialVote="like"
                    onChange={(vote) => {
                      if (vote !== "like") {
                        setEntries(
                          (current) =>
                            current?.filter(
                              (item) =>
                                item.collection_slug !== entry.collection_slug ||
                                item.publication_date !== entry.publication_date,
                            ) ?? [],
                        );
                        setOffset((n) => Math.max(0, n - 1));
                      }
                    }}
                  />
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
      {more && (
        <Box>
          <Button onClick={() => void loadMore()} disabled={busy}>
            {busy ? "Chargement…" : "Voir plus"}
          </Button>
        </Box>
      )}
    </Stack>
  );
}
