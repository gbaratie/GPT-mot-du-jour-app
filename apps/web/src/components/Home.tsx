"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { api } from "@/lib/api/client";
import type { TodayResponse } from "@/lib/api/types";
import { EntryRenderer } from "@/collections/EntryRenderer";
import { formatDate } from "@/lib/dates";

export default function Home() {
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api
      .today(controller.signal)
      .then(setToday)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <Stack spacing={5}>
      <Box>
        <Typography variant="overline" color="primary">
          Le plaisir de découvrir
        </Typography>
        <Typography variant="h1" sx={{ mt: 1, mb: 2 }}>
          Un jour.
          <br />
          Une nouvelle idée.
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 520 }}>
          Un mot à apprivoiser, une pensée à emporter. Prenez un instant pour nourrir votre
          curiosité.
        </Typography>
        {today && (
          <Typography sx={{ mt: 2 }} variant="body2" color="primary">
            {formatDate(today.date)}
          </Typography>
        )}
      </Box>
      {error ? (
        <Alert
          severity="warning"
          action={
            <Button
              onClick={() => {
                setError(false);
                setAttempt(attempt + 1);
              }}
            >
              Réessayer
            </Button>
          }
        >
          Le contenu ne peut pas être chargé pour le moment.
        </Alert>
      ) : !today ? (
        <Stack spacing={2} role="status" aria-label="Chargement des collections">
          <Skeleton variant="rounded" height={220} />
          <Skeleton variant="rounded" height={220} />
        </Stack>
      ) : today.items.length === 0 ? (
        <Alert severity="info">Aucune collection disponible pour le moment.</Alert>
      ) : (
        today.items.map(({ collection, entry }) => (
          <Card key={collection.slug}>
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Stack spacing={3}>
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", alignItems: "center", gap: 2 }}
                >
                  <Typography variant="h2" component="h2" sx={{ fontSize: "1.1rem" }}>
                    {collection.name}
                  </Typography>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={collection.locale === "fr-FR" ? "Français" : collection.locale}
                  />
                </Stack>
                {entry ? (
                  <EntryRenderer entry={entry} />
                ) : (
                  <Typography color="text.secondary">
                    Aucun contenu publié aujourd’hui. Retrouvez les publications précédentes dans
                    les archives.
                  </Typography>
                )}
                <Box>
                  <Button component={Link} href={`/${collection.slug}/`} variant="outlined">
                    Explorer {collection.name.toLowerCase()} →
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        ))
      )}
    </Stack>
  );
}
