import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api/client";
import type { DailyEntry } from "@/lib/api/types";
import CardFeedback from "./CardFeedback";

const entry: DailyEntry = {
  collection_slug: "mot-du-jour",
  kind: "word",
  publication_date: "2026-01-01",
  payload: { term: "Mot", definition: "Sens", example: "Exemple" },
};
afterEach(() => vi.restoreAllMocks());

it("restaure le vote puis permet de le remplacer et de le retirer", async () => {
  vi.spyOn(api, "feedback").mockResolvedValue({ vote: "like" });
  const save = vi
    .spyOn(api, "vote")
    .mockResolvedValueOnce({ vote: "dislike" })
    .mockResolvedValueOnce({ vote: null });
  render(<CardFeedback entry={entry} />);
  const like = screen.getByRole("button", { name: "J’aime" });
  const dislike = screen.getByRole("button", { name: "Je n’aime pas" });
  await waitFor(() => expect(like).toHaveAttribute("aria-pressed", "true"));
  fireEvent.click(dislike);
  await waitFor(() => expect(dislike).toHaveAttribute("aria-pressed", "true"));
  expect(like).toHaveAttribute("aria-pressed", "false");
  expect(save).toHaveBeenLastCalledWith(entry.collection_slug, entry.publication_date, "dislike");
  fireEvent.click(dislike);
  await waitFor(() => expect(dislike).toHaveAttribute("aria-pressed", "false"));
  expect(save).toHaveBeenLastCalledWith(entry.collection_slug, entry.publication_date, null);
});

it("n’annonce aucun succès avant le serveur, bloque les doubles clics et réessaie la même intention", async () => {
  vi.spyOn(api, "feedback").mockResolvedValue({ vote: null });
  let reject!: (e: Error) => void;
  const save = vi
    .spyOn(api, "vote")
    .mockImplementationOnce(
      () =>
        new Promise((_, r) => {
          reject = r;
        }),
    )
    .mockResolvedValueOnce({ vote: "like" });
  render(<CardFeedback entry={entry} />);
  const like = screen.getByRole("button", { name: "J’aime" });
  await waitFor(() => expect(like).toBeEnabled());
  fireEvent.click(like);
  fireEvent.click(like);
  expect(save).toHaveBeenCalledTimes(1);
  expect(like).toHaveAttribute("aria-pressed", "false");
  expect(screen.queryByText("Ajoutée aux favoris")).not.toBeInTheDocument();
  reject(new Error("offline"));
  await screen.findByText("Avis indisponible. Réessayez.");
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  await screen.findByText("Ajoutée aux favoris");
  expect(save.mock.calls.map((call) => call[2])).toEqual(["like", "like"]);
});

it("ne charge aucun vote tant que la carte est une prévisualisation", async () => {
  const load = vi.spyOn(api, "feedback").mockResolvedValue({ vote: null });
  const { rerender } = render(<CardFeedback entry={entry} active={false} />);
  expect(load).not.toHaveBeenCalled();
  rerender(<CardFeedback entry={entry} active />);
  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
});
