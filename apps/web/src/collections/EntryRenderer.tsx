"use client";

import { Box, Button, Collapse, Stack, Typography } from "@mui/material";
import { useState } from "react";
import type { DailyEntry } from "@/lib/api/types";

function Riddle({ payload }: { payload: Extract<DailyEntry, { kind: "riddle" }>["payload"] }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <Stack spacing={2}>
      <Typography variant="h2" component="h3">
        {payload.question}
      </Typography>
      {payload.hint && <Typography color="text.secondary">Indice : {payload.hint}</Typography>}
      <Box>
        <Button variant="outlined" onClick={() => setRevealed(!revealed)} aria-expanded={revealed}>
          {revealed ? "Masquer la réponse" : "Voir la réponse"}
        </Button>
      </Box>
      <Collapse in={revealed}>
        <Typography>{payload.answer}</Typography>
      </Collapse>
    </Stack>
  );
}

export function EntryRenderer({ entry }: { entry: DailyEntry }) {
  switch (entry.kind) {
    case "word":
      return (
        <Stack spacing={3}>
          <Typography
            variant="h2"
            component="h3"
            sx={{ fontFamily: "Georgia, serif", fontSize: { xs: "2rem", md: "3rem" } }}
          >
            {entry.payload.term}
          </Typography>
          <Typography sx={{ fontSize: "1.2rem", lineHeight: 1.8 }}>
            {entry.payload.definition}
          </Typography>
          <Typography
            component="blockquote"
            color="text.secondary"
            sx={{
              m: 0,
              pl: 2,
              borderLeft: "2px solid",
              borderColor: "primary.main",
              fontStyle: "italic",
            }}
          >
            {entry.payload.example}
          </Typography>
        </Stack>
      );
    case "quote":
      return (
        <Stack spacing={3}>
          <Typography
            component="blockquote"
            sx={{
              m: 0,
              fontFamily: "Georgia, serif",
              fontSize: { xs: "1.6rem", md: "2.2rem" },
              lineHeight: 1.6,
            }}
          >
            « {entry.payload.text} »
          </Typography>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>{entry.payload.author}</Typography>
            {entry.payload.source && (
              <Typography color="text.secondary" variant="body2">
                {entry.payload.source}
              </Typography>
            )}
          </Box>
        </Stack>
      );
    case "riddle":
      return (
        <Riddle
          key={`${entry.collection_slug}-${entry.publication_date}`}
          payload={entry.payload}
        />
      );
    default: {
      const exhaustive: never = entry;
      return exhaustive;
    }
  }
}
