"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Button, IconButton, Stack, Typography } from "@mui/material";
import { api } from "@/lib/api/client";
import type { DailyEntry, FeedbackVote } from "@/lib/api/types";
import CardIcon from "./CardIcon";

type Props = {
  entry: DailyEntry;
  active?: boolean;
  onChange?: (vote: FeedbackVote | null) => void;
  initialVote?: FeedbackVote | null;
  inline?: boolean;
};

export default function CardFeedback({
  entry,
  active = true,
  onChange,
  initialVote,
  inline = false,
}: Props) {
  const [vote, setVote] = useState<FeedbackVote | null>(initialVote ?? null);
  const [loading, setLoading] = useState(initialVote === undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  const failedIntent = useRef<FeedbackVote | null | undefined>(undefined);
  useEffect(() => {
    if (!active || initialVote !== undefined) return;
    const controller = new AbortController();
    api
      .feedback(entry.collection_slug, entry.publication_date, controller.signal)
      .then((result) => {
        setVote(result.vote);
        setError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [active, entry.collection_slug, entry.publication_date, attempt, initialVote]);

  async function save(value: FeedbackVote | null) {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setSaved(false);
    setError(false);
    try {
      const result = await api.vote(entry.collection_slug, entry.publication_date, value);
      setVote(result.vote);
      setSaved(true);
      failedIntent.current = undefined;
      onChange?.(result.vote);
    } catch {
      failedIntent.current = value;
      setError(true);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  return (
    <Box
      className={`card-feedback${inline ? " is-inline" : ""}`}
      sx={{
        mt: inline ? 0 : 1.5,
        flexBasis: error && inline ? "100%" : undefined,
        visibility: active ? "visible" : "hidden",
      }}
    >
      <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
        {(
          [
            ["like", "J’aime"],
            ["dislike", "Je n’aime pas"],
          ] as const
        ).map(([value, label]) => (
          <IconButton
            key={value}
            aria-label={label}
            title={label}
            aria-pressed={vote === value}
            disabled={!active || loading || saving}
            onClick={() => void save(vote === value ? null : value)}
            sx={{
              width: 44,
              height: 44,
              color: vote === value ? "primary.main" : "text.secondary",
              bgcolor: vote === value ? "action.selected" : undefined,
            }}
          >
            <CardIcon name={value} />
          </IconButton>
        ))}
        <Typography
          className="feedback-status"
          variant="caption"
          color="text.secondary"
          role="status"
          sx={{ ml: 1 }}
        >
          {saving
            ? "Enregistrement…"
            : saved
              ? vote === "like"
                ? "Ajoutée aux favoris"
                : vote
                  ? "Avis enregistré"
                  : "Avis retiré"
              : vote === "like"
                ? "Dans vos favoris"
                : ""}
        </Typography>
      </Stack>
      {error && (
        <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Avis indisponible. Réessayez.
          </Typography>
          <Button
            size="small"
            aria-label="Réessayer"
            onClick={() => {
              if (failedIntent.current !== undefined) {
                void save(failedIntent.current);
                return;
              }
              setLoading(true);
              setAttempt((n) => n + 1);
            }}
          >
            Réessayer
          </Button>
        </Stack>
      )}
    </Box>
  );
}
