"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import CardIcon from "./CardIcon";
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
  const surface = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const motion = useRef<Animation | null>(null);
  const start = useRef<{ x: number; y: number; time: number } | null>(null);
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

  useEffect(
    () => () => {
      controller.current?.abort();
      motion.current?.cancel();
    },
    [],
  );
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

  function resetDrag() {
    start.current = null;
    if (lock.current) return;
    if (surface.current) {
      surface.current.style.transform = "";
      delete surface.current.dataset.dragging;
    }
  }
  async function advance(targetDirection: "next" | "previous", restart = false) {
    if (lock.current || (targetDirection === "previous" && position <= 0)) {
      resetDrag();
      return;
    }
    lock.current = true;
    start.current = null;
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
      resetDrag();
      return;
    }
    setBusy(false);
    const card = surface.current;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (card && card.animate && !reduced) {
      const sign = targetDirection === "next" ? -1 : 1;
      const distance = window.innerWidth + card.getBoundingClientRect().width;
      motion.current = card.animate(
        [
          { transform: card.style.transform || "translateX(0) rotate(0deg)", opacity: 1 },
          { transform: `translateX(${sign * distance}px) rotate(${sign * 18}deg)`, opacity: 0 },
        ],
        { duration: 260, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" },
      );
      try {
        await motion.current.finished;
      } catch {
        return;
      }
    }
    if (controller.current?.signal.aborted) return;
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
    if (card) {
      card.style.transform = "";
      delete card.dataset.dragging;
    }
    motion.current?.cancel();
    motion.current = null;
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
          {!preview && (
            <Stack direction="row" sx={{ flexShrink: 0 }}>
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
          )}
        </Stack>
        {!preview && busy ? (
          <Box role="status" aria-label="Chargement de la découverte">
            <Skeleton variant="rounded" height={180} />
          </Box>
        ) : entry ? (
          <EntryRenderer key={`${slug}:${entry.publication_date}:${preview}`} entry={entry} />
        ) : (
          <Typography color="text.secondary">
            Aucun contenu publié aujourd’hui. Retrouvez les publications précédentes dans les
            archives ou découvrez un autre jour.
          </Typography>
        )}
        {!preview && (
          <Typography
            variant="caption"
            color="text.secondary"
            className="swipe-hint"
            sx={{ mt: 2, fontSize: ".7rem", lineHeight: 1.5 }}
          >
            Glissez à gauche pour découvrir, à droite pour revenir.
          </Typography>
        )}
      </CardContent>
    );
  }

  return (
    <Box ref={root} className="discovery-deck">
      <Box className="deck-stack">
        {underneath && (
          <Card className="deck-card deck-underneath" aria-hidden="true" inert>
            {content(underneath, true)}
          </Card>
        )}
        <Card
          ref={surface}
          className="deck-card deck-foreground"
          tabIndex={0}
          role="group"
          aria-label="Carte découverte. Flèche droite : autre découverte. Flèche gauche : précédente."
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "ArrowRight") {
              e.preventDefault();
              void advance("next");
            }
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              void advance("previous");
            }
          }}
          onPointerDown={(e) => {
            if (
              (e.target as HTMLElement).closest("button, a, input") ||
              !e.isPrimary ||
              (e.pointerType === "mouse" && e.button !== 0) ||
              lock.current ||
              busy
            )
              return;
            motion.current?.cancel();
            start.current = { x: e.clientX, y: e.clientY, time: performance.now() };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const origin = start.current;
            if (!origin || lock.current) return;
            const dx = e.clientX - origin.x;
            const dy = e.clientY - origin.y;
            if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
              resetDrag();
              return;
            }
            if (Math.abs(dx) > Math.abs(dy)) {
              setDirection(dx < 0 ? "next" : "previous");
              e.currentTarget.dataset.dragging = "true";
              e.currentTarget.style.transform = `translate3d(${dx}px, ${dy * 0.12}px, 0) rotate(${dx * 0.025}deg)`;
            }
          }}
          onPointerCancel={resetDrag}
          onLostPointerCapture={resetDrag}
          onPointerUp={(e) => {
            const origin = start.current;
            start.current = null;
            if (!origin) return;
            const dx = e.clientX - origin.x;
            const dy = e.clientY - origin.y;
            const velocity = Math.abs(dx) / Math.max(1, performance.now() - origin.time);
            const enough = Math.abs(dx) >= 80 || (Math.abs(dx) >= 30 && velocity > 0.5);
            if (enough && Math.abs(dx) > Math.abs(dy) * 1.5)
              void advance(dx < 0 ? "next" : "previous");
            else resetDrag();
          }}
        >
          {content(current)}
        </Card>
      </Box>
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
