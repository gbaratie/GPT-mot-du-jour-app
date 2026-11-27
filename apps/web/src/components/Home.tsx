"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  Typography,
} from "@mui/material";
import { api, ApiError } from "@/lib/api/client";
import type { TodayResponse } from "@/lib/api/types";
import CardIcon from "./CardIcon";
import DiscoveryDeck from "./DiscoveryDeck";
import CachedContentNotice from "./CachedContentNotice";
import { collections } from "@/collections/catalog";

export default function Home() {
  const [selected, setSelected] = useState(0);
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [cacheStatus, setCacheStatus] = useState<"refreshing" | "offline" | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const saved = api.cachedToday();
    // Apply browser storage after hydration, ignoring an abandoned effect.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setError(false);
      if (saved) setToday(saved);
      setCacheStatus(saved ? "refreshing" : null);
    });
    api
      .today(controller.signal, { fallback: false })
      .then((fresh) => {
        if (controller.signal.aborted) return;
        setToday(fresh);
        setCacheStatus(null);
        setError(false);
      })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        const rejected = failure instanceof ApiError && failure.status < 500;
        if (rejected) setToday(null);
        setCacheStatus(saved && !rejected ? "offline" : null);
        setError(true);
      });
    const reconnect = () => setAttempt((value) => value + 1);
    window.addEventListener("online", reconnect);
    return () => {
      controller.abort();
      window.removeEventListener("online", reconnect);
    };
  }, [attempt]);

  return (
    <Stack sx={{ gap: { xs: 2, md: 4 } }} className="home-view">
      <Box className="home-intro">
        <Typography variant="h1">Une découverte chaque jour.</Typography>
      </Box>
      {(today?.items.length ?? collections.length) > 1 && (
        <ToggleButtonGroup
          className="collection-picker"
          exclusive
          value={selected}
          onChange={(_, value: number | null) => {
            if (value !== null) setSelected(value);
          }}
          aria-label="Choisir une découverte"
        >
          {(today?.items ?? collections.map((collection) => ({ collection }))).map(
            ({ collection }, index) => (
              <ToggleButton
                key={collection.slug}
                value={index}
                aria-controls={`discovery-${collection.slug}`}
              >
                {collection.name}
              </ToggleButton>
            ),
          )}
        </ToggleButtonGroup>
      )}
      {cacheStatus && (
        <CachedContentNotice
          refreshing={cacheStatus === "refreshing"}
          onRetry={() => setAttempt((value) => value + 1)}
        />
      )}
      {error && !today ? (
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
        <Box className="discoveries" role="status" aria-label="Chargement des collections">
          {collections.map((collection, index) => (
            <Card
              key={collection.slug}
              className={`discovery ${index === selected ? "is-selected" : ""}`}
            >
              <CardContent>
                <Typography variant="h2" sx={{ fontSize: "1.1rem", mb: 3 }}>
                  {collection.name}
                </Typography>
                <Skeleton variant="rounded" height={180} />
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : today.items.length === 0 ? (
        <Alert severity="info">Aucune collection disponible pour le moment.</Alert>
      ) : (
        <Box className="discoveries">
          {today.items.map(({ collection, entry }, index) => (
            <Box
              component="article"
              id={`discovery-${collection.slug}`}
              className={`discovery ${index === selected ? "is-selected" : ""}`}
              key={collection.slug}
            >
              <DiscoveryDeck
                slug={collection.slug}
                locale={collection.locale}
                initial={entry}
                heading={
                  <Typography
                    variant="h2"
                    component="h2"
                    className="discovery-title"
                    sx={{ fontSize: "1.1rem" }}
                  >
                    {collection.name}
                  </Typography>
                }
                action={
                  <IconButton
                    component={Link}
                    href={`/${collection.slug}/`}
                    aria-label={`Explorer ${collection.name.toLowerCase()} : archives`}
                    title="Explorer les archives"
                    sx={{ width: 44, height: 44, color: "text.secondary" }}
                  >
                    <CardIcon name="archive" />
                  </IconButton>
                }
              />
            </Box>
          ))}
        </Box>
      )}
    </Stack>
  );
}
