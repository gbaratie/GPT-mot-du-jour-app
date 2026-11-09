"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  CardContent,
  CircularProgress,
  IconButton,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import CardIcon from "./CardIcon";
import SwipeStack, { type SwipeStackHandle } from "./SwipeStack";
import { EntryRenderer } from "@/collections/EntryRenderer";
import { api } from "@/lib/api/client";
import type { DailyEntry } from "@/lib/api/types";
import { formatDate } from "@/lib/dates";
import { clearRecent, markSeen, recentDates } from "@/lib/discovery";

type Props = { slug: string; locale: string; initial: DailyEntry | null; heading?: ReactNode };
export default function DiscoveryDeck({ slug, locale, initial, heading }: Props) {
  const [trail, setTrail] = useState<DailyEntry[]>(initial ? [initial] : []);
  const [position, setPosition] = useState(initial ? 0 : -1);
  const [prepared, setPrepared] = useState<DailyEntry | null>(null);
  const [direction, setDirection] = useState<"next" | "previous">("next");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [empty, setEmpty] = useState(false);
  const pool = useRef<DailyEntry[]>([]);
  const sessionSeen = useRef(new Set<string>());
  const controller = useRef<AbortController | null>(null);
  const pending = useRef<Promise<DailyEntry | null> | null>(null);
  const candidate = useRef<DailyEntry | null>(null);
  const lock = useRef(false);
  const stack = useRef<SwipeStackHandle>(null);
  const root = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const current = trail[position] ?? null;
  const forward = trail[position + 1] ?? prepared;
  const underneath = direction === "previous" ? trail[position - 1] : forward;

  function excluded() {
    const dates = new Set([...recentDates(slug), ...sessionSeen.current].slice(-99));
    if (current) dates.add(current.publication_date);
    return dates;
  }
  // Prepare the actual next publication, without marking the preview as seen.
  async function prepare(): Promise<DailyEntry | null> {
    if (candidate.current) return candidate.current;
    if (pending.current) return pending.current;
    const request = new AbortController();
    controller.current = request;
    const task = async () => {
      const dates = excluded();
      let available = pool.current.filter((e) => !dates.has(e.publication_date));
      if (!available.length) {
        try {
          available = await api.discover(slug, [...dates], request.signal);
        } catch (failure) {
          available = api.saved(slug).filter((e) => !dates.has(e.publication_date));
          if (!available.length) throw failure;
        }
      }
      if (request.signal.aborted) return null;
      available = available.filter((e) => !dates.has(e.publication_date));
      const chosen = available[0] ?? null;
      pool.current = available.slice(1);
      candidate.current = chosen;
      setPrepared(chosen);
      setEmpty(!chosen);
      return chosen;
    };
    pending.current = task()
      .catch(() => {
        if (!request.signal.aborted) setError(true);
        return null;
      })
      .finally(() => {
        pending.current = null;
      });
    return pending.current;
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const visible = () => {
      if (current) {
        markSeen(slug, current.publication_date);
        sessionSeen.current.add(current.publication_date);
      }
      if (position >= trail.length - 1) void prepare();
    };
    if (typeof IntersectionObserver === "undefined") {
      visible();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) visible();
    });
    observer.observe(node);
    return () => observer.disconnect();
    // Preparation is tied to the visible publication, not to its request state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, position, trail.length]);

  async function advance(targetDirection: "next" | "previous", restart = false, exitSide?: number) {
    if (lock.current) return;
    if (targetDirection === "previous" && position <= 0) {
      stack.current?.reset();
      return;
    }
    lock.current = true;
    setDirection(targetDirection);
    setError(false);
    if (restart) {
      clearRecent(slug);
      sessionSeen.current.clear();
      candidate.current = null;
      setPrepared(null);
    }
    let target: DailyEntry | undefined =
      targetDirection === "previous" ? trail[position - 1] : trail[position + 1];
    if (!target) {
      if (!candidate.current) setBusy(true);
      target = (await prepare()) ?? undefined;
    }
    if (!target || controller.current?.signal.aborted) {
      lock.current = false;
      setBusy(false);
      stack.current?.reset();
      return;
    }
    setBusy(false);
    await stack.current?.dismiss(exitSide ?? (targetDirection === "next" ? -1 : 1));
    if (!mounted.current) return;
    if (targetDirection === "previous") setPosition((p) => p - 1);
    else if (position < trail.length - 1) setPosition((p) => p + 1);
    else {
      markSeen(slug, target.publication_date);
      sessionSeen.current.add(target.publication_date);
      candidate.current = null;
      setPrepared(null);
      setTrail((old) => [...old, target]);
      setPosition((p) => p + 1);
    }
    lock.current = false;
    setDirection("next");
  }

  function content(entry: DailyEntry | null, preview = false) {
    return (
      <CardContent sx={{ p: { xs: 2.5, sm: 3 }, "&:last-child": { pb: { xs: 2.5, sm: 3 } } }}>
        {heading && <Box sx={{ mb: 2 }}>{heading}</Box>}
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.5 }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            component="p"
            aria-live={preview ? undefined : "polite"}
          >
            {entry ? formatDate(entry.publication_date, locale) : "Au fil des jours"}
          </Typography>
          <Stack direction="row" sx={{ flexShrink: 0, visibility: preview ? "hidden" : "visible" }}>
            <IconButton
              onClick={() => void advance("previous")}
              disabled={position <= 0 || busy}
              aria-label="Découverte précédente"
              title="Découverte précédente"
              sx={{ width: 44, height: 44 }}
            >
              <CardIcon name="back" />
            </IconButton>
            <IconButton
              onClick={() => void advance("next")}
              disabled={busy}
              aria-label={busy ? "Recherche en cours" : "Autre découverte"}
              title="Autre découverte"
              color="primary"
              sx={{ width: 44, height: 44 }}
            >
              {busy ? <CircularProgress size={18} color="inherit" /> : <CardIcon name="next" />}
            </IconButton>
          </Stack>
        </Stack>
        {!preview && busy ? (
          <Box role="status" aria-label="Chargement de la découverte">
            <Skeleton variant="rounded" height={180} />
          </Box>
        ) : entry ? (
          <EntryRenderer key={`${slug}:${entry.publication_date}`} entry={entry} />
        ) : (
          <Typography color="text.secondary">
            Aucun contenu publié aujourd’hui. Retrouvez les publications précédentes dans les
            archives ou découvrez un autre jour.
          </Typography>
        )}
        <Typography
          variant="caption"
          color="text.secondary"
          className="swipe-hint"
          sx={{
            mt: 2,
            fontSize: ".7rem",
            lineHeight: 1.5,
            visibility: preview ? "hidden" : "visible",
            minHeight: "3em",
          }}
        >
          {position > 0
            ? "Glissez à gauche pour découvrir, à droite pour revenir."
            : "Glissez sur le côté pour découvrir."}
        </Typography>
      </CardContent>
    );
  }

  return (
    <Box ref={root} className="discovery-deck">
      <SwipeStack
        ref={stack}
        current={current}
        underneath={underneath}
        canGoBack={position > 0}
        busy={busy}
        onDirection={setDirection}
        onAdvance={advance}
        renderCard={content}
      />
      {error && (
        <Alert
          severity="warning"
          sx={{ mt: 2 }}
          action={<Button onClick={() => void advance("next")}>Réessayer</Button>}
        >
          Impossible de charger une autre découverte. La carte actuelle reste disponible.
        </Alert>
      )}
      {empty && (
        <Alert
          severity="info"
          sx={{ mt: 2 }}
          action={
            <Button sx={{ whiteSpace: "nowrap" }} onClick={() => void advance("next", true)}>
              Recommencer
            </Button>
          }
        >
          Vous avez parcouru les publications disponibles récemment. Recommencer autorise leur
          réapparition.
        </Alert>
      )}
    </Box>
  );
}
