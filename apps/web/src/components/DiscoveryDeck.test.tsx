import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import DiscoveryDeck from "./DiscoveryDeck";
import { api } from "@/lib/api/client";
import { markSeen, recentDates } from "@/lib/discovery";
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
  await within(screen.getByRole("group")).findByText("Trois");
  expect(discover.mock.calls[0][1]).toEqual(expect.arrayContaining(["2026-11-01", "2026-11-05"]));
  fireEvent.click(screen.getByRole("button", { name: "Découverte précédente" }));
  expect(within(screen.getByRole("group")).getByText("Cinq")).toBeVisible();
  fireEvent.keyDown(screen.getByRole("group"), { key: "ArrowRight" });
  expect(within(screen.getByRole("group")).queryByText("Cinq")).not.toBeInTheDocument();
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
  expect(await within(screen.getByRole("group")).findByText("Archive ancienne")).toBeVisible();
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

it("attend la sortie de la carte avant de promouvoir la suivante", async () => {
  vi.spyOn(api, "discover").mockResolvedValue([word("2025-01-01", "En dessous")]);
  let finish!: () => void;
  const animate = vi.fn(() => ({
    finished: new Promise<void>((r) => {
      finish = r;
    }),
    cancel: vi.fn(),
  }));
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
  try {
    render(
      <DiscoveryDeck slug="mot-du-jour" locale="fr-FR" initial={word("2026-11-05", "Cinq")} />,
    );
    await waitFor(() => expect(document.querySelector(".deck-underneath")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Autre découverte" }));
    await waitFor(() => expect(animate).toHaveBeenCalled());
    expect(within(screen.getByRole("group")).getByText("Cinq")).toBeVisible();
    finish();
    expect(await within(screen.getByRole("group")).findByText("En dessous")).toBeVisible();
  } finally {
    delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
    vi.unstubAllGlobals();
  }
});

it("aspire la carte dès le seuil franchi, avant le relâchement, sans annulation par perte de capture", async () => {
  class Pointer extends MouseEvent {
    constructor(type: string, init: MouseEventInit) {
      super(type, init);
      Object.defineProperties(this, {
        isPrimary: { value: true },
        pointerType: { value: "touch" },
        pointerId: { value: 1 },
      });
    }
  }
  vi.stubGlobal("PointerEvent", Pointer);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.spyOn(api, "discover").mockResolvedValue([
    word("2025-01-01", "Suivante"),
    word("2025-01-02", "Encore"),
  ]);
  let finish!: () => void;
  const animate = vi.fn(() => ({
    finished: new Promise<void>((r) => {
      finish = r;
    }),
    cancel: vi.fn(),
  }));
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
  try {
    render(
      <DiscoveryDeck slug="mot-du-jour" locale="fr-FR" initial={word("2026-11-05", "Cinq")} />,
    );
    await waitFor(() => expect(document.querySelector(".deck-underneath")).not.toBeNull());
    const card = screen.getByRole("group");
    Object.defineProperty(card, "setPointerCapture", { value: vi.fn() });
    fireEvent.pointerDown(card, { clientX: 220, clientY: 150 });
    fireEvent.pointerMove(card, { clientX: 100, clientY: 155 });
    await waitFor(() => expect(animate).toHaveBeenCalledTimes(1));
    fireEvent.lostPointerCapture(card);
    fireEvent.pointerCancel(card);
    fireEvent.pointerMove(card, { clientX: 80, clientY: 155 });
    expect(animate).toHaveBeenCalledTimes(1);
    finish();
    expect(await within(card).findByText("Suivante")).toBeVisible();
  } finally {
    delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
    vi.unstubAllGlobals();
  }
});

it("permet de découvrir en glissant la première carte vers la droite", async () => {
  class Pointer extends MouseEvent {
    constructor(type: string, init: MouseEventInit) {
      super(type, init);
      Object.defineProperties(this, {
        isPrimary: { value: true },
        pointerType: { value: "touch" },
        pointerId: { value: 1 },
      });
    }
  }
  vi.stubGlobal("PointerEvent", Pointer);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.spyOn(api, "discover").mockResolvedValue([word("2025-01-01", "Suivante")]);
  try {
    render(
      <DiscoveryDeck slug="mot-du-jour" locale="fr-FR" initial={word("2026-11-05", "Cinq")} />,
    );
    await waitFor(() => expect(document.querySelector(".deck-underneath")).not.toBeNull());
    const card = screen.getByRole("group");
    Object.defineProperty(card, "setPointerCapture", { value: vi.fn() });
    fireEvent.pointerDown(card, { clientX: 100, clientY: 150 });
    fireEvent.pointerMove(card, { clientX: 220, clientY: 150 });
    expect(await within(card).findByText("Suivante")).toBeVisible();
  } finally {
    vi.unstubAllGlobals();
  }
});
