import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Home from "./Home";
import { api } from "@/lib/api/client";
import { save } from "@/lib/api/cache";
import { collections } from "@/collections/catalog";
import type { DailyEntry, TodayResponse } from "@/lib/api/types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const collection = collections.find((item) => item.kind === "word")!;
const snapshot = (date: string, term: string): TodayResponse => ({
  date,
  items: [
    {
      collection,
      entry: {
        kind: "word",
        collection_slug: collection.slug,
        publication_date: date,
        payload: { term, definition: "Une définition", example: "Un exemple" },
      },
    },
  ],
});
function seedToday() {
  save(
    `${(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "")}/today`,
    snapshot("2026-11-05", "Enregistrée"),
  );
  vi.spyOn(api, "feedback").mockResolvedValue({ vote: null });
  vi.spyOn(api, "discover").mockImplementation(() => new Promise<DailyEntry[]>(() => {}));
}

it("affiche un état vide et un lien vers les archives quand il n’y a pas de mot", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        date: "2026-11-04",
        items: [
          {
            collection: { slug: "mot-du-jour", name: "Mot du jour", locale: "fr-FR" },
            entry: null,
          },
        ],
      }),
    }),
  );
  render(<Home />);
  expect(await screen.findByText(/Aucun contenu publié aujourd’hui/)).toBeVisible();
  expect(screen.getByRole("link", { name: /Explorer/ })).toHaveAttribute(
    "href",
    expect.stringMatching(/^\/mot-du-jour\/?$/),
  );
});

it("affiche une erreur avec une possibilité de réessayer", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network error")));
  render(<Home />);
  expect(await screen.findByText(/ne peut pas être chargé/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Réessayer" })).toBeVisible();
});

it("permet de choisir une découverte sans perdre les liens des collections", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        date: "2026-11-08",
        items: [
          {
            collection: { slug: "mot-du-jour", name: "Mot du jour", locale: "fr-FR" },
            entry: null,
          },
          {
            collection: { slug: "citation-du-jour", name: "Citation du jour", locale: "fr-FR" },
            entry: null,
          },
        ],
      }),
    }),
  );
  render(<Home />);
  const choice = await screen.findByRole("button", { name: "Citation du jour" });
  const { fireEvent } = await import("@testing-library/react");
  fireEvent.click(choice);
  expect(choice).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Mot du jour" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(document.getElementById("discovery-citation-du-jour")).toHaveClass("is-selected");
});

it("affiche le cache sans attendre le réseau puis actualise la première carte", async () => {
  seedToday();
  let resolve!: (value: unknown) => void;
  const fetch = vi.fn(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  vi.stubGlobal("fetch", fetch);
  render(<Home />);
  expect(await screen.findByText("Enregistrée")).toBeVisible();
  expect(screen.getByText(/Actualisation en cours/)).toBeVisible();
  expect(
    screen.queryByRole("status", { name: "Chargement des collections" }),
  ).not.toBeInTheDocument();
  await act(async () => {
    resolve({ ok: true, json: async () => snapshot("2026-11-06", "Actualisée") });
  });
  expect(await screen.findByText("Actualisée")).toBeVisible();
  expect(screen.queryByText(/Actualisation en cours/)).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("garde les cartes après un échec et réessaie quand la connexion revient", async () => {
  seedToday();
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("offline"))
    .mockResolvedValue({ ok: true, json: async () => snapshot("2026-11-06", "Reconnectée") });
  vi.stubGlobal("fetch", fetch);
  render(<Home />);
  expect(await screen.findByText(/Vous pouvez continuer à lire/)).toBeVisible();
  expect(screen.getByText("Enregistrée")).toBeVisible();
  fireEvent(window, new Event("online"));
  expect(await screen.findByText("Reconnectée")).toBeVisible();
  await waitFor(() =>
    expect(screen.queryByText(/Vous pouvez continuer à lire/)).not.toBeInTheDocument(),
  );
});

it("retire le contenu de secours si le serveur le refuse explicitement", async () => {
  seedToday();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
  render(<Home />);
  expect(await screen.findByText(/ne peut pas être chargé/)).toBeVisible();
  expect(screen.queryByText("Enregistrée")).not.toBeInTheDocument();
});
