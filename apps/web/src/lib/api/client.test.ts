import { afterEach, expect, it, vi } from "vitest";
import { api } from "./client";
import { cached } from "./cache";
const entry = {
  kind: "word",
  collection_slug: "mot-du-jour",
  publication_date: "2026-11-05",
  payload: { term: "Test", definition: "Définition", example: "Exemple" },
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("conserve les publications d’un lot après rechargement et évite un nouvel appel", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [entry] });
  vi.stubGlobal("fetch", fetch);
  await api.discover("mot-du-jour", []);
  await api.entry("mot-du-jour", entry.publication_date);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(api.saved("mot-du-jour")).toEqual([entry]);
});
it("ignore un cache corrompu ou indisponible", async () => {
  localStorage.setItem("daily-cache-v1", "null");
  expect(cached("missing", 100)).toBeUndefined();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => entry }));
  expect(await api.entry("mot-du-jour", entry.publication_date)).toEqual(entry);
});
it("signale une attente prolongée puis ferme le message dès la réponse", async () => {
  vi.useFakeTimers();
  let resolve!: (value: unknown) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    ),
  );
  const listener = vi.fn();
  window.addEventListener("daily-network", listener);
  try {
    const pending = api.today();
    await vi.advanceTimersByTimeAsync(3500);
    expect(listener.mock.calls.at(-1)?.[0].detail).toBe(1);
    resolve({ ok: true, json: async () => ({ date: "2026-11-05", items: [] }) });
    await pending;
    expect(listener.mock.calls.at(-1)?.[0].detail).toBe(0);
  } finally {
    window.removeEventListener("daily-network", listener);
  }
});
it("sert une ancienne réponse en cas de panne mais ne masque pas une erreur 404", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => entry }));
  await api.entry("mot-du-jour", entry.publication_date);
  vi.setSystemTime(Date.now() + 61000);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
  // Historical entries are served immediately even without the network.
  expect(await api.entry("mot-du-jour", entry.publication_date)).toEqual(entry);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
  await expect(api.entry("mot-du-jour", "2026-11-06")).rejects.toMatchObject({ status: 404 });
});

it("revalide aujourd’hui même si une ancienne réponse est en cache", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ date: "2026-11-08", items: [] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ date: "2026-11-09", items: [] }) });
  vi.stubGlobal("fetch", fetch);
  await api.today();
  expect((await api.today()).date).toBe("2026-11-09");
  expect(fetch).toHaveBeenCalledTimes(2);
});
