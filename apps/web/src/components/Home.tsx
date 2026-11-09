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
  IconButton,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  Typography,
} from "@mui/material";
import { api } from "@/lib/api/client";
import type { TodayResponse } from "@/lib/api/types";
import CardIcon from "./CardIcon";
import DiscoveryDeck from "./DiscoveryDeck";
import { formatDate } from "@/lib/dates";

export default function Home() {
  const [selected, setSelected] = useState(0);
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
    <Stack spacing={{ xs: 2.5, md: 4 }} className="home-view">
      <Box className="home-intro">
        <Typography variant="overline" color="primary">
          Le plaisir de découvrir
        </Typography>
        <Typography variant="h1" sx={{ mt: 0.5, mb: 1.5 }}>
          Un jour. Une nouvelle idée.
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
      {today && today.items.length > 1 && (
        <ToggleButtonGroup
          className="collection-picker"
          exclusive
          value={selected}
          onChange={(_, value: number | null) => {
            if (value !== null) setSelected(value);
          }}
          aria-label="Choisir une découverte"
        >
          {today.items.map(({ collection }, index) => (
            <ToggleButton
              key={collection.slug}
              value={index}
              aria-controls={`discovery-${collection.slug}`}
            >
              {collection.name}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}
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
        <Box className="discoveries">
          {today.items.map(({ collection, entry }, index) => (
            <Card
              component="article"
              id={`discovery-${collection.slug}`}
              className={`discovery ${index === selected ? "is-selected" : ""}`}
              key={collection.slug}
            >
              <CardContent className="discovery-content" sx={{ p: { xs: 2.5, sm: 3 } }}>
                <Stack spacing={2.5} sx={{ height: "100%" }}>
                  <Stack
                    direction="row"
                    sx={{ justifyContent: "space-between", alignItems: "center", gap: 1 }}
                  >
                    <Typography variant="h2" component="h2" sx={{ fontSize: "1.1rem" }}>
                      {collection.name}
                    </Typography>
                    <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={collection.locale === "fr-FR" ? "Français" : collection.locale}
                      />
                      <IconButton
                        component={Link}
                        href={`/${collection.slug}/`}
                        aria-label={`Explorer ${collection.name.toLowerCase()} : archives`}
                        title="Explorer les archives"
                        sx={{ width: 44, height: 44, color: "text.secondary" }}
                      >
                        <CardIcon name="archive" />
                      </IconButton>
                    </Stack>
                  </Stack>
                  <DiscoveryDeck
                    slug={collection.slug}
                    locale={collection.locale}
                    initial={entry}
                  />
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Stack>
  );
}
