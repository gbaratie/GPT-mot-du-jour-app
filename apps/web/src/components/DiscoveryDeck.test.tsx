import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import DiscoveryDeck from "./DiscoveryDeck";
import { api } from "@/lib/api/client";
import { markSeen, recentDates } from "@/lib/discovery";
// Animation physics and touch lifecycles are exercised in the browser. Keep
// these contract tests immediate while using the real Motion components.
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => true,
}));

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
  await waitFor(() => within(screen.getByRole("group")).getByText("Trois"));
  expect(discover.mock.calls[0][1]).toEqual(expect.arrayContaining(["2026-11-01", "2026-11-05"]));
  fireEvent.click(screen.getByRole("button", { name: "Découverte précédente" }));
  expect(await waitFor(() => within(screen.getByRole("group")).getByText("Cinq"))).toBeVisible();
  fireEvent.keyDown(screen.getByRole("group"), { key: "ArrowRight" });
  await waitFor(() => within(screen.getByRole("group")).getByText("Trois"));
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
  expect(within(screen.getByRole("group")).queryByText("Cinq")).not.toBeInTheDocument();
  expect(discover).toHaveBeenCalledTimes(1);
  resolve([word("2025-01-01", "Archive ancienne")]);
  expect(
    await waitFor(() => within(screen.getByRole("group")).getByText("Archive ancienne")),
  ).toBeVisible();
  expect(screen.queryByText("Cache récent")).not.toBeInTheDocument();
});

it("précharge une vraie carte sous la première sans la marquer comme vue", async () => {
  vi.spyOn(api, "discover").mockResolvedValue([word("2025-01-01", "En dessous")]);
  render(<DiscoveryDeck slug="mot-du-jour" locale="fr-FR" initial={word("2026-11-05", "Cinq")} />);
  await waitFor(() =>
    expect(document.querySelector(".deck-underneath")).toHaveTextContent("En dessous"),
  );
  expect(document.querySelector(".deck-underneath")).toHaveAttribute("inert");
  expect(recentDates("mot-du-jour")).not.toContain("2025-01-01");
  expect(within(screen.getByRole("group")).getByText("Cinq")).toBeVisible();
});

it("promeut le même élément de carte, sans le recréer ni changer son contenu", async () => {
  vi.spyOn(api, "discover").mockResolvedValue([
    word("2025-01-01", "En dessous"),
    word("2025-01-02", "Après"),
  ]);
  render(<DiscoveryDeck slug="mot-du-jour" locale="fr-FR" initial={word("2026-11-05", "Cinq")} />);
  await waitFor(() => expect(document.querySelector(".deck-underneath")).not.toBeNull());
  const preview = document.querySelector(".deck-underneath");
  const previewText = preview?.querySelector("h3");
  fireEvent.click(screen.getByRole("button", { name: "Autre découverte" }));
  await waitFor(() => within(screen.getByRole("group")).getByText("En dessous"));
  expect(screen.getByRole("group")).toBe(preview);
  expect(screen.getByRole("group").querySelector("h3")).toBe(previewText);
  expect(screen.getByRole("group")).not.toHaveAttribute("inert");
});

it("conserve la carte et permet de réessayer après un échec de préparation", async () => {
  vi.spyOn(api, "discover")
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue([word("2025-01-01", "Rétablie")]);
  vi.spyOn(api, "saved").mockReturnValue([]);
  render(<DiscoveryDeck slug="mot-du-jour" locale="fr-FR" initial={word("2026-11-05", "Cinq")} />);
  await screen.findByText(/Impossible de charger/);
  expect(within(screen.getByRole("group")).getByText("Cinq")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  expect(
    await waitFor(() => within(screen.getByRole("group")).getByText("Rétablie")),
  ).toBeVisible();
});
