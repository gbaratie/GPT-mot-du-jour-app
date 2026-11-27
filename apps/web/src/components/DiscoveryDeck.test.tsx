import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DiscoveryDeck from "./DiscoveryDeck";
import { api, ApiError } from "@/lib/api/client";
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
beforeEach(() => {
  vi.spyOn(api, "feedback").mockResolvedValue({ vote: null });
  vi.spyOn(api, "saved").mockReturnValue([]);
});
afterEach(() => vi.restoreAllMocks());
it("exclut les cartes récentes, revient à la précédente et conserve un lot sans nouvel appel", async () => {
  markSeen("mot-du-jour", "2026-11-01");
  vi.spyOn(api, "saved").mockReturnValue([]);
  const discover = vi
    .spyOn(api, "discover")
    .mockResolvedValue([
      word("2026-11-03", "Trois"),
      word("2026-11-02", "Deux"),
      word("2026-10-30", "Suite"),
      word("2026-10-29", "Encore"),
      word("2026-10-28", "Après"),
      word("2026-10-27", "Fin"),
    ]);
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

it("permet de lire plusieurs questions enregistrées pendant le remplissage réseau", async () => {
  markSeen("mot-du-jour", "2026-11-01");
  vi.spyOn(api, "saved").mockReturnValue([
    word("2026-11-04", "Cache quatre"),
    word("2026-11-03", "Cache trois"),
    word("2026-11-02", "Cache deux"),
    word("2026-11-01", "Déjà vue"),
  ]);
  let resolve!: (entries: DailyEntry[]) => void;
  const discover = vi.spyOn(api, "discover").mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  render(<DiscoveryDeck slug="mot-du-jour" locale="fr-FR" initial={word("2026-11-05", "Cinq")} />);
  await waitFor(() =>
    expect(document.querySelector(".deck-underneath")).toHaveTextContent("Cache quatre"),
  );
  for (const term of ["Cache quatre", "Cache trois", "Cache deux"]) {
    fireEvent.click(screen.getByRole("button", { name: "Autre découverte" }));
    expect(await waitFor(() => within(screen.getByRole("group")).getByText(term))).toBeVisible();
  }
  expect(discover).toHaveBeenCalledTimes(1);
  expect(discover.mock.calls[0][1]).toEqual(expect.arrayContaining(["2026-11-01", "2026-11-04"]));
  fireEvent.click(screen.getByRole("button", { name: "Autre découverte" }));
  expect(screen.getByRole("status", { name: "Chargement de la découverte" })).toBeVisible();
  expect(discover).toHaveBeenCalledTimes(1);
  resolve([word("2025-01-01", "Archive ancienne")]);
  expect(
    await waitFor(() => within(screen.getByRole("group")).getByText("Archive ancienne")),
  ).toBeVisible();
  expect(screen.queryByText("Déjà vue")).not.toBeInTheDocument();
});

it("complète le lot en arrière-plan sans remplacer la prévisualisation ni créer de doublon", async () => {
  vi.spyOn(api, "saved").mockReturnValue([
    word("2026-11-04", "Quatre"),
    word("2026-11-03", "Trois"),
  ]);
  let resolve!: (entries: DailyEntry[]) => void;
  vi.spyOn(api, "discover")
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValue([]);
  render(<DiscoveryDeck slug="mot-du-jour" locale="fr-FR" initial={word("2026-11-05", "Cinq")} />);
  await waitFor(() =>
    expect(document.querySelector(".deck-underneath")).toHaveTextContent("Quatre"),
  );
  resolve([word("2026-11-04", "Doublon"), word("2026-11-02", "Deux")]);
  await waitFor(() =>
    expect(document.querySelector(".deck-underneath")).toHaveTextContent("Quatre"),
  );
  for (const term of ["Quatre", "Trois", "Deux"]) {
    fireEvent.click(screen.getByRole("button", { name: "Autre découverte" }));
    expect(await waitFor(() => within(screen.getByRole("group")).getByText(term))).toBeVisible();
  }
  expect(screen.queryByText("Doublon")).not.toBeInTheDocument();
});

it("conserve les cartes disponibles après une panne et signale l’échec une fois le lot vide", async () => {
  vi.spyOn(api, "saved").mockReturnValue([word("2026-11-04", "Enregistrée")]);
  vi.spyOn(api, "discover").mockRejectedValue(new Error("offline"));
  render(<DiscoveryDeck slug="mot-du-jour" locale="fr-FR" initial={word("2026-11-05", "Cinq")} />);
  await waitFor(() =>
    expect(document.querySelector(".deck-underneath")).toHaveTextContent("Enregistrée"),
  );
  expect(screen.queryByText(/Impossible de charger/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Autre découverte" }));
  expect(
    await waitFor(() => within(screen.getByRole("group")).getByText("Enregistrée")),
  ).toBeVisible();
  expect(await screen.findByText(/Impossible de charger/)).toBeVisible();
  expect(within(screen.getByRole("group")).getByText("Enregistrée")).toBeVisible();
});

it("ne masque pas une erreur 404 avec les questions enregistrées", async () => {
  vi.spyOn(api, "saved").mockReturnValue([word("2026-11-04", "Enregistrée")]);
  vi.spyOn(api, "discover").mockRejectedValue(new ApiError(404));
  render(<DiscoveryDeck slug="mot-du-jour" locale="fr-FR" initial={word("2026-11-05", "Cinq")} />);
  expect(await screen.findByText(/Impossible de charger/)).toBeVisible();
  expect(document.querySelector(".deck-underneath")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  expect(await screen.findByText(/Impossible de charger/)).toBeVisible();
  expect(within(screen.getByRole("group")).getByText("Cinq")).toBeVisible();
  expect(screen.queryByText("Enregistrée")).not.toBeInTheDocument();
});

it("actualise la première carte reçue du serveur et préserve un parcours commencé", async () => {
  vi.spyOn(api, "saved").mockReturnValue([word("2026-11-03", "Découverte")]);
  vi.spyOn(api, "discover").mockResolvedValue([]);
  const { rerender } = render(
    <DiscoveryDeck slug="mot-du-jour" locale="fr-FR" initial={word("2026-11-04", "Ancienne")} />,
  );
  rerender(
    <DiscoveryDeck slug="mot-du-jour" locale="fr-FR" initial={word("2026-11-05", "Actualisée")} />,
  );
  expect(
    await waitFor(() => within(screen.getByRole("group")).getByText("Actualisée")),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Autre découverte" }));
  expect(
    await waitFor(() => within(screen.getByRole("group")).getByText("Découverte")),
  ).toBeVisible();
  rerender(
    <DiscoveryDeck slug="mot-du-jour" locale="fr-FR" initial={word("2026-11-06", "Nouvelle")} />,
  );
  expect(within(screen.getByRole("group")).getByText("Découverte")).toBeVisible();
});

it("retire une première carte enregistrée si la revalidation indique son absence", async () => {
  vi.spyOn(api, "discover").mockResolvedValue([]);
  const { rerender } = render(
    <DiscoveryDeck slug="mot-du-jour" locale="fr-FR" initial={word("2026-11-04", "Ancienne")} />,
  );
  rerender(<DiscoveryDeck slug="mot-du-jour" locale="fr-FR" initial={null} />);
  expect(await screen.findByText(/Aucun contenu publié aujourd’hui/)).toBeVisible();
  expect(screen.queryByText("Ancienne")).not.toBeInTheDocument();
});

it("annule le remplissage au démontage et ignore sa réponse tardive", async () => {
  let resolve!: (entries: DailyEntry[]) => void;
  const discover = vi.spyOn(api, "discover").mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const { unmount } = render(
    <DiscoveryDeck slug="mot-du-jour" locale="fr-FR" initial={word("2026-11-05", "Cinq")} />,
  );
  const signal = discover.mock.calls[0][2];
  unmount();
  expect(signal?.aborted).toBe(true);
  resolve([word("2026-11-04", "Tardive")]);
  await Promise.resolve();
  expect(screen.queryByText("Tardive")).not.toBeInTheDocument();
});

it("relance le remplissage après le cycle de vérification des effets de React", async () => {
  vi.spyOn(api, "saved").mockReturnValue([word("2026-11-04", "Enregistrée")]);
  const discover = vi.spyOn(api, "discover").mockImplementation(() => new Promise(() => {}));
  render(
    <StrictMode>
      <DiscoveryDeck slug="mot-du-jour" locale="fr-FR" initial={word("2026-11-05", "Cinq")} />
    </StrictMode>,
  );
  await waitFor(() => expect(discover).toHaveBeenCalledTimes(2));
  expect(discover.mock.calls[0][2]?.aborted).toBe(true);
  expect(discover.mock.calls[1][2]?.aborted).toBe(false);
  expect(document.querySelector(".deck-underneath")).toHaveTextContent("Enregistrée");
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
