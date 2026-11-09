"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
  Skeleton,
} from "@mui/material";
import CardIcon from "./CardIcon";
import { EntryRenderer } from "@/collections/EntryRenderer";
import { api } from "@/lib/api/client";
import type { DailyEntry } from "@/lib/api/types";
import { formatDate } from "@/lib/dates";
import { clearRecent, markSeen, recentDates } from "@/lib/discovery";

type Props = { slug: string; locale: string; initial: DailyEntry | null };
export default function DiscoveryDeck({ slug, locale, initial }: Props) {
  const [trail, setTrail] = useState<DailyEntry[]>(initial ? [initial] : []);
  const [position, setPosition] = useState(initial ? 0 : -1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [empty, setEmpty] = useState(false);
  const pool = useRef<DailyEntry[]>([]);
  const sessionSeen = useRef(new Set<string>());
  const request = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const surface = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const current = trail[position] ?? null;

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const node = surface.current;
    if (!node || !current) return;
    const record = () => {
      markSeen(slug, current.publication_date);
      sessionSeen.current.add(current.publication_date);
    };
    if (typeof IntersectionObserver === "undefined") {
      record();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) record();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [current, slug]);

  function previous() {
    if (!lock.current) setPosition((p) => Math.max(0, p - 1));
  }
  async function next(restart = false) {
    if (lock.current) return;
    if (!restart && position < trail.length - 1) {
      setPosition((p) => p + 1);
      return;
    }
    if (restart) {
      clearRecent(slug);
      sessionSeen.current.clear();
    }
    const excluded = new Set([...recentDates(slug), ...sessionSeen.current].slice(-99));
    if (current) excluded.add(current.publication_date);
    const available = (entries: DailyEntry[]) =>
      entries.filter((e) => !excluded.has(e.publication_date));
    let candidates = available(pool.current);

    setError(false);
    setEmpty(false);
    lock.current = true;
    setBusy(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      if (!candidates.length)
        try {
          candidates = await api.discover(slug, [...excluded], controller.signal);
        } catch (error) {
          candidates = available(api.saved(slug));
          if (!candidates.length) throw error;
        }
      if (controller.signal.aborted) return;
      candidates = available(candidates);
      if (!candidates.length) {
        setEmpty(true);
        return;
      }
      const index = Math.floor(Math.random() * candidates.length);
      const chosen = candidates[index];
      pool.current = candidates.filter((_, i) => i !== index);
      // Record immediately as well, so rapid navigation cannot repeat a card.
      sessionSeen.current.add(chosen.publication_date);
      markSeen(slug, chosen.publication_date);
      setTrail((old) => [...old.slice(0, position + 1), chosen]);
      setPosition(position + 1);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      lock.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function movingCard() {
    return (
      surface.current?.closest<HTMLElement>(".discovery, .publication-card") ?? surface.current
    );
  }
  function resetDrag() {
    start.current = null;
    const card = movingCard();
    if (card) {
      card.style.transform = "";
      delete card.dataset.dragging;
    }
  }

  return (
    <Box className="discovery-deck">
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.5 }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          component="p"
          sx={{ minWidth: 0 }}
          aria-live="polite"
        >
          {current ? formatDate(current.publication_date, locale) : "Au fil des jours"}
          {current && position > 0 ? " · Au fil des jours" : ""}
        </Typography>
        <Stack direction="row" sx={{ flexShrink: 0 }}>
          <IconButton
            onClick={previous}
            disabled={position <= 0 || busy}
            aria-label="Découverte précédente"
            title="Découverte précédente"
            sx={{ width: 44, height: 44 }}
          >
            <CardIcon name="back" />
          </IconButton>
          <IconButton
            onClick={() => void next()}
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
      <Box
        ref={surface}
        className="swipe-surface"
        tabIndex={0}
        role="group"
        aria-label="Carte découverte. Flèche droite : autre découverte. Flèche gauche : précédente."
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "ArrowRight") {
            e.preventDefault();
            void next();
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            previous();
          }
        }}
        onPointerDown={(e) => {
          if (
            (e.target as HTMLElement).closest("button, a, input") ||
            !e.isPrimary ||
            (e.pointerType === "mouse" && e.button !== 0) ||
            busy
          )
            return;
          start.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!start.current || busy) return;
          const dx = e.clientX - start.current.x;
          const dy = e.clientY - start.current.y;
          if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
            resetDrag();
            return;
          }
          if (Math.abs(dx) > Math.abs(dy)) {
            const card = movingCard();
            if (card) {
              card.dataset.dragging = "true";
              card.style.transform = `translate3d(${Math.max(-24, Math.min(24, dx * 0.2))}px, 0, 0)`;
            }
          }
        }}
        onPointerCancel={resetDrag}
        onLostPointerCapture={resetDrag}
        onPointerUp={(e) => {
          const origin = start.current;
          resetDrag();
          if (!origin) return;
          const dx = e.clientX - origin.x;
          if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(e.clientY - origin.y) * 1.5) return;
          if (dx < 0) void next();
          else previous();
        }}
      >
        {busy ? (
          <Box role="status" aria-label="Chargement de la découverte">
            <Skeleton variant="rounded" height={180} />
          </Box>
        ) : current ? (
          <>
            <EntryRenderer key={`${slug}:${current.publication_date}`} entry={current} />
          </>
        ) : (
          <Typography color="text.secondary">
            Aucun contenu publié aujourd’hui. Retrouvez les publications précédentes dans les
            archives ou découvrez un autre jour.
          </Typography>
        )}
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        className="swipe-hint"
        sx={{ mt: 2, fontSize: "0.7rem", lineHeight: 1.5 }}
      >
        Glissez à gauche pour découvrir, à droite pour revenir.
      </Typography>
      {error && (
        <Alert
          severity="warning"
          sx={{ mt: 2 }}
          action={<Button onClick={() => void next()}>Réessayer</Button>}
        >
          Impossible de charger une autre découverte. La carte actuelle reste disponible.
        </Alert>
      )}
      {empty && (
        <Alert
          severity="info"
          sx={{ mt: 2 }}
          action={
            <Button sx={{ whiteSpace: "nowrap" }} onClick={() => void next(true)}>
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
