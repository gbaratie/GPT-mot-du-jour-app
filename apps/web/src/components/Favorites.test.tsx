import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api/client";
import type { DailyEntry } from "@/lib/api/types";
import Favorites from "./Favorites";

const entry: DailyEntry = {
  collection_slug: "mot-du-jour",
  kind: "word",
  publication_date: "2026-01-01",
  payload: { term: "Favori", definition: "Sens", example: "Exemple" },
};
afterEach(() => vi.restoreAllMocks());
it("affiche les cartes aimées et les retire de la liste après le retrait du vote", async () => {
  vi.spyOn(api, "favorites").mockResolvedValue([entry]);
  vi.spyOn(api, "vote").mockResolvedValue({ vote: null });
  render(<Favorites />);
  await screen.findByText("Favori");
  const like = screen.getByRole("button", { name: "J’aime" });
  expect(like).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(like);
  await waitFor(() => expect(screen.queryByText("Favori")).not.toBeInTheDocument());
  expect(await screen.findByRole("link", { name: "Découvrir les cartes" })).toHaveAttribute(
    "href",
    "/",
  );
});
it("permet de réessayer un chargement en échec", async () => {
  vi.spyOn(api, "favorites").mockRejectedValueOnce(new Error("offline")).mockResolvedValue([]);
  render(<Favorites />);
  fireEvent.click(await screen.findByRole("button", { name: "Réessayer" }));
  expect(await screen.findByText(/Aucun favori/)).toBeVisible();
});
