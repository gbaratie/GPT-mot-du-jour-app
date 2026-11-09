import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import DiscoveryDeck from "./DiscoveryDeck";
import { api } from "@/lib/api/client";
import { markSeen } from "@/lib/discovery";
import type { DailyEntry } from "@/lib/api/types";
const word = (date: string, term: string): DailyEntry => ({
  kind: "word",
  collection_slug: "mot-du-jour",
  publication_date: date,
  payload: { term, definition: "Définition", example: "Exemple" },
});
afterEach(() => vi.restoreAllMocks());
it("exclut les cartes récentes, revient à la précédente et conserve un lot sans nouvel appel", async () => {
  markSeen("mot-du-jour", "2026-11-01");
  vi.spyOn(api, "saved").mockReturnValue([]);
  const discover = vi
    .spyOn(api, "discover")
    .mockResolvedValue([word("2026-11-03", "Trois"), word("2026-11-02", "Deux")]);
  render(<DiscoveryDeck slug="mot-du-jour" locale="fr-FR" initial={word("2026-11-05", "Cinq")} />);
  fireEvent.click(screen.getByRole("button", { name: /Autre découverte/ }));
  await screen.findByText(/Au fil des jours/);
  expect(discover.mock.calls[0][1]).toEqual(expect.arrayContaining(["2026-11-01", "2026-11-05"]));
  fireEvent.click(screen.getByRole("button", { name: "Découverte précédente" }));
  expect(screen.getByText("Cinq")).toBeVisible();
  fireEvent.keyDown(screen.getByRole("group"), { key: "ArrowRight" });
  expect(screen.queryByText("Cinq")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Autre découverte/ }));
  expect(discover).toHaveBeenCalledTimes(1);
});
it("propose de recommencer quand toutes les publications ont été vues", async () => {
  vi.spyOn(api, "saved").mockReturnValue([]);
  vi.spyOn(api, "discover").mockResolvedValue([]);
  render(<DiscoveryDeck slug="mot-du-jour" locale="fr-FR" initial={word("2026-11-05", "Cinq")} />);
  fireEvent.click(screen.getByRole("button", { name: /Autre découverte/ }));
  expect(await screen.findByRole("button", { name: "Recommencer" })).toBeVisible();
});

it("interroge toutes les archives avant d’utiliser le cache et masque l’ancienne carte pendant l’attente", async () => {
  vi.spyOn(api, "saved").mockReturnValue([word("2026-11-04", "Cache récent")]);
  let resolve!: (entries: DailyEntry[]) => void;
  const discover = vi.spyOn(api, "discover").mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  render(<DiscoveryDeck slug="mot-du-jour" locale="fr-FR" initial={word("2026-11-05", "Cinq")} />);
  fireEvent.click(screen.getByRole("button", { name: "Autre découverte" }));
  expect(screen.getByRole("status", { name: "Chargement de la découverte" })).toBeVisible();
  expect(screen.queryByText("Cinq")).not.toBeInTheDocument();
  expect(discover).toHaveBeenCalledTimes(1);
  resolve([word("2025-01-01", "Archive ancienne")]);
  expect(await screen.findByText("Archive ancienne")).toBeVisible();
  expect(screen.queryByText("Cache récent")).not.toBeInTheDocument();
});
