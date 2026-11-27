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
import CardFeedback from "./CardFeedback";
import SwipeStack, { type SwipeStackHandle } from "./SwipeStack";
import { EntryRenderer } from "@/collections/EntryRenderer";
import { api, ApiError } from "@/lib/api/client";
import type { DailyEntry } from "@/lib/api/types";
import { formatDate } from "@/lib/dates";
import { clearRecent, markSeen, recentDates } from "@/lib/discovery";

type Props = {
  slug: string;
  locale: string;
  initial: DailyEntry | null;
  heading?: ReactNode;
  action?: ReactNode;
};
export default function DiscoveryDeck({ slug, locale, initial, heading, action }: Props) {
  const [trail, setTrail] = useState<DailyEntry[]>(initial ? [initial] : []);
  const [position, setPosition] = useState(initial ? 0 : -1);
  const [prepared, setPrepared] = useState<DailyEntry | null>(null);
  const [direction, setDirection] = useState<"next" | "previous">("next");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [empty, setEmpty] = useState(false);
  const pool = useRef<DailyEntry[]>([]);
  const cacheLoaded = useRef(false);
  const refillPending = useRef<Promise<void> | null>(null);
  const refillError = useRef<unknown>(null);
  const exhausted = useRef(false);
  const generation = useRef(0);
  const navigated = useRef(false);
  const lastInitial = useRef(initial);
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
  // Refill independently of the next-card promise, so saved cards remain usable
  // while the service wakes up. Never replace a preview the reader already sees.
  function refill(): Promise<void> {
    if (refillPending.current) return refillPending.current;
    if (exhausted.current) return Promise.resolve();
    const request = new AbortController();
    const version = generation.current;
    controller.current = request;
    refillError.current = null;
    const dates = new Set([
      ...excluded(),
      ...pool.current.map((entry) => entry.publication_date),
      ...(candidate.current ? [candidate.current.publication_date] : []),
    ]);
    const task = api
      .discover(slug, [...dates].slice(-100), request.signal)
      .then((entries) => {
        if (!mounted.current || request.signal.aborted || version !== generation.current) return;
        const seen = excluded();
        if (candidate.current) seen.add(candidate.current.publication_date);
        pool.current = [...pool.current, ...entries].filter((entry) => {
          if (seen.has(entry.publication_date)) return false;
          seen.add(entry.publication_date);
          return true;
        });
        exhausted.current = entries.length === 0;
      })
      .catch((failure: unknown) => {
        if (!mounted.current || request.signal.aborted || version !== generation.current) return;
        refillError.current = failure;
        if (failure instanceof ApiError && failure.status < 500) {
          pool.current = [];
          candidate.current = null;
          setPrepared(null);
          setError(true);
        }
      })
      .finally(() => {
        if (version === generation.current) refillPending.current = null;
      });
    refillPending.current = task;
    return task;
  }

  // Prepare the actual next publication, without marking the preview as seen.
  async function prepare(): Promise<DailyEntry | null> {
    if (candidate.current) {
      if (controller.current?.signal.aborted) void refill();
      return candidate.current;
    }
    if (pending.current) return pending.current;
    const version = generation.current;
    const task = async () => {
      const dates = excluded();
      if (!cacheLoaded.current) {
        cacheLoaded.current = true;
        pool.current = api
          .saved(slug)
          .filter((entry) => !dates.has(entry.publication_date))
          .slice(0, 12);
        void refill();
      }
      let available = pool.current.filter((e) => !dates.has(e.publication_date));
      if (!available.length) {
        await refill();
        if (!mounted.current || version !== generation.current) return null;
        available = pool.current.filter((entry) => !excluded().has(entry.publication_date));
        if (!available.length && refillError.current) throw refillError.current;
      }
      if (!mounted.current || version !== generation.current) return null;
      const chosen = available[0] ?? null;
      pool.current = available.slice(1);
      candidate.current = chosen;
      setPrepared(chosen);
      setEmpty(!chosen);
      if (chosen && available.length <= 3) void refill();
      return chosen;
    };
    pending.current = task()
      .catch(() => {
        if (mounted.current && version === generation.current) setError(true);
        return null;
      })
      .finally(() => {
        if (version === generation.current) pending.current = null;
      });
    return pending.current;
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      controller.current?.abort();
      pending.current = null;
      refillPending.current = null;
    };
  }, []);
  useEffect(() => {
    if (lastInitial.current === initial) return;
    lastInitial.current = initial;
    if (navigated.current) return;
    setTrail(initial ? [initial] : []);
    setPosition(initial ? 0 : -1);
    if (candidate.current?.publication_date === initial?.publication_date) {
      candidate.current = null;
      setPrepared(null);
    }
  }, [initial]);
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
    navigated.current = true;
    setDirection(targetDirection);
    setError(false);
    if (restart) {
      generation.current += 1;
      controller.current?.abort();
      pending.current = null;
      refillPending.current = null;
      refillError.current = null;
      exhausted.current = false;
      cacheLoaded.current = false;
      pool.current = [];
      clearRecent(slug);
      sessionSeen.current.clear();
      candidate.current = null;
      setPrepared(null);
    }
    const version = generation.current;
    let target: DailyEntry | undefined =
      targetDirection === "previous" ? trail[position - 1] : trail[position + 1];
    const discovering = !target;
    if (!target) {
      if (!candidate.current) setBusy(true);
      target = (await prepare()) ?? undefined;
    }
    if (!mounted.current || version !== generation.current) {
      lock.current = false;
      return;
    }
    if (!target) {
      lock.current = false;
      setBusy(false);
      stack.current?.reset();
      return;
    }
    setBusy(false);
    await stack.current?.dismiss(exitSide ?? (targetDirection === "next" ? -1 : 1));
    if (!mounted.current || version !== generation.current) return;
    if (
      discovering &&
      refillError.current instanceof ApiError &&
      refillError.current.status < 500
    ) {
      lock.current = false;
      stack.current?.reset();
      return;
    }
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
      <CardContent
        sx={{ position: "relative", p: { xs: 2, md: 3 }, "&:last-child": { pb: { xs: 2, md: 3 } } }}
      >
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.5 }}
        >
          <Box sx={{ minWidth: 0 }}>
            {heading}
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              aria-live={preview ? undefined : "polite"}
            >
              {entry ? formatDate(entry.publication_date, locale) : "Au fil des jours"}
            </Typography>
          </Box>
          <Stack direction="row" sx={{ flexShrink: 0, visibility: preview ? "hidden" : "visible" }}>
            {action}
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
          <EntryRenderer
            key={`${slug}:${entry.publication_date}`}
            entry={entry}
            actions={
              entry.kind === "riddle" ? (
                <CardFeedback entry={entry} active={!preview} inline />
              ) : undefined
            }
          />
        ) : (
          <Typography color="text.secondary">
            Aucun contenu publié aujourd’hui. Découvrez un autre jour ou ouvrez les archives.
          </Typography>
        )}
        {entry && entry.kind !== "riddle" && !busy && (
          <CardFeedback entry={entry} active={!preview} />
        )}
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
          Impossible de charger une autre découverte.
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
          Tout a été vu. Recommencer permet de revoir ces publications.
        </Alert>
      )}
    </Box>
  );
}
