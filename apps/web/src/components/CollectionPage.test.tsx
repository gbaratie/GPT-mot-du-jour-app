import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CollectionPage from "./CollectionPage";
import { api } from "@/lib/api/client";
import { save } from "@/lib/api/cache";
import { collections } from "@/collections/catalog";
import type { DailyEntry } from "@/lib/api/types";

const navigation = vi.hoisted(() => ({ day: null as string | null, push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.day ? { date: navigation.day } : {}),
  useRouter: () => ({ push: navigation.push }),
}));

const collection = collections.find((item) => item.kind === "word")!;
const scope = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const word = (date: string, term: string): DailyEntry => ({
  kind: "word",
  collection_slug: collection.slug,
  publication_date: date,
  payload: { term, definition: "Une définition", example: "Un exemple" },
});

function seedEntry() {
  const entry = word("2026-11-05", "Enregistrée");
  save(`${scope}/collections/${collection.slug}/today`, entry);
  save(`${scope}/collections/${collection.slug}/entries/${entry.publication_date}`, entry);
}

function pendingResponse(init?: RequestInit) {
  return new Promise<never>((_, reject) => {
    init?.signal?.addEventListener(
      "abort",
      () => reject(new DOMException("Aborted", "AbortError")),
      {
        once: true,
      },
    );
  });
}

function deferredResponse() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  navigation.day = null;
  navigation.push.mockClear();
  vi.spyOn(api, "feedback").mockResolvedValue({ vote: null });
  vi.spyOn(api, "discover").mockImplementation(() => new Promise<DailyEntry[]>(() => {}));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("montre immédiatement la publication enregistrée pendant l’attente des deux requêtes", async () => {
  seedEntry();
  const fetch = vi.fn((_url: string, init?: RequestInit) => pendingResponse(init));
  vi.stubGlobal("fetch", fetch);
  render(<CollectionPage collection={collection} />);
  expect(await screen.findByText("Enregistrée")).toBeVisible();
  expect(screen.getByText(/Actualisation en cours/)).toBeVisible();
  expect(screen.getByRole("status", { name: "Chargement des archives" })).toBeVisible();
  expect(
    screen.queryByRole("status", { name: "Chargement de la publication" }),
  ).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("affiche une publication fraîche sans attendre les archives", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) =>
      url.endsWith("/today")
        ? Promise.resolve({ ok: true, json: async () => word("2026-11-06", "Disponible") })
        : pendingResponse(init),
    ),
  );
  render(<CollectionPage collection={collection} />);
  expect(await screen.findByText("Disponible")).toBeVisible();
  expect(screen.getByRole("status", { name: "Chargement des archives" })).toBeVisible();
});

it("actualise une carte enregistrée alors que les archives attendent encore", async () => {
  seedEntry();
  const entryRequest = deferredResponse();
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) =>
      url.endsWith("/today") ? entryRequest.promise : pendingResponse(init),
    ),
  );
  render(<CollectionPage collection={collection} />);
  expect(await screen.findByText("Enregistrée")).toBeVisible();
  await act(async () => {
    entryRequest.resolve({ ok: true, json: async () => word("2026-11-06", "Actualisée") });
  });
  expect(await screen.findByText("Actualisée")).toBeVisible();
  expect(screen.getByRole("status", { name: "Chargement des archives" })).toBeVisible();
  expect(screen.queryByText(/Actualisation en cours/)).not.toBeInTheDocument();
});

it("retire la carte enregistrée après un refus 404 du serveur", async () => {
  seedEntry();
  const entryRequest = deferredResponse();
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) =>
      url.endsWith("/today") ? entryRequest.promise : pendingResponse(init),
    ),
  );
  render(<CollectionPage collection={collection} />);
  expect(await screen.findByText("Enregistrée")).toBeVisible();
  await act(async () => {
    entryRequest.resolve({ ok: false, status: 404 });
  });
  expect(await screen.findByText(/Aucun contenu pour cette date/)).toBeVisible();
  await waitFor(() => expect(screen.queryByText("Enregistrée")).not.toBeInTheDocument());
  expect(screen.queryByText(/Actualisation en cours/)).not.toBeInTheDocument();
});

it("conserve les cartes hors connexion et permet de réessayer", async () => {
  seedEntry();
  let attempts = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (!url.endsWith("/today")) return pendingResponse(init);
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new TypeError("offline"))
        : Promise.resolve({ ok: true, json: async () => word("2026-11-06", "Rétablie") });
    }),
  );
  render(<CollectionPage collection={collection} />);
  expect(await screen.findByText(/Vous pouvez continuer à lire/)).toBeVisible();
  expect(screen.getByText("Enregistrée")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  expect(await screen.findByText("Rétablie")).toBeVisible();
  expect(attempts).toBe(2);
});

it("consulte une date précise déjà enregistrée sans bloquer sur les archives", async () => {
  seedEntry();
  navigation.day = "2026-11-05";
  const fetch = vi.fn((_url: string, init?: RequestInit) => pendingResponse(init));
  vi.stubGlobal("fetch", fetch);
  render(<CollectionPage collection={collection} />);
  expect(await screen.findByText("Enregistrée")).toBeVisible();
  expect(screen.getByRole("status", { name: "Chargement des archives" })).toBeVisible();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toContain("before=2026-11-05");
});
