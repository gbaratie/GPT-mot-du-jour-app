import { afterEach, expect, it, vi } from "vitest";
import { api } from "./client";
import { cached, cacheAge, remember, save } from "./cache";
import type { DailyEntry, TodayResponse } from "./types";
const entry = {
  kind: "word",
  collection_slug: "mot-du-jour",
  publication_date: "2026-11-05",
  payload: { term: "Test", definition: "Définition", example: "Exemple" },
} satisfies DailyEntry;
const scope = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const today: TodayResponse = {
  date: entry.publication_date,
  items: [
    {
      collection: {
        slug: entry.collection_slug,
        name: "Mot du jour",
        description: "Une découverte quotidienne",
        kind: "word",
        locale: "fr-FR",
        active: true,
        sort_order: 0,
      },
      entry,
    },
  ],
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

it("envoie les votes au serveur avec la même identité, sans cache ni succès hors ligne", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ vote: "like" }) });
  vi.stubGlobal("fetch", fetch);
  await api.vote("mot-du-jour", "2026-01-01", "like");
  await api.feedback("mot-du-jour", "2026-01-01");
  expect(fetch.mock.calls[0][1]).toMatchObject({
    method: "PUT",
    body: JSON.stringify({ vote: "like" }),
    cache: "no-store",
  });
  const id = fetch.mock.calls[0][1].headers["X-Reader-Id"];
  expect(fetch.mock.calls[1][1].headers["X-Reader-Id"]).toBe(id);
  expect(localStorage.getItem("daily-reader-v1")).toBe(id);
  fetch.mockRejectedValue(new Error("offline"));
  await expect(api.vote("mot-du-jour", "2026-01-01", "dislike")).rejects.toThrow("offline");
});

it("expose les dernières données immédiatement sans attendre la revalidation", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => today })
    .mockResolvedValueOnce({ ok: true, json: async () => [entry] });
  vi.stubGlobal("fetch", fetch);
  await api.today();
  await api.history(entry.collection_slug, null);
  fetch.mockImplementation(() => new Promise(() => {}));

  expect(api.cachedToday()).toEqual(today);
  expect(api.cachedEntry(entry.collection_slug, null)).toEqual(entry);
  expect(api.cachedEntry(entry.collection_slug, entry.publication_date)).toEqual(entry);
  expect(api.cachedHistory(entry.collection_slug, null)).toEqual([entry]);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("permet de distinguer un échec de revalidation d’un succès en cache", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => today }));
  await api.today();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

  await expect(api.today(undefined, { fallback: false })).rejects.toThrow("offline");
  await expect(
    api.entry(entry.collection_slug, null, undefined, { fallback: false }),
  ).rejects.toThrow("offline");
  expect(api.cachedToday()).toEqual(today);
  expect(await api.today()).toEqual(today);
});

it("fusionne les lots de réserve et conserve au plus 24 cartes sans doublons", async () => {
  const cards = Array.from({ length: 30 }, (_, index) => ({
    ...entry,
    publication_date: `2026-10-${String(index + 1).padStart(2, "0")}`,
  }));
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => cards.slice(0, 12) })
    .mockResolvedValueOnce({ ok: true, json: async () => cards.slice(10, 22) })
    .mockResolvedValueOnce({ ok: true, json: async () => cards.slice(18, 30) });
  vi.stubGlobal("fetch", fetch);
  await api.discover(entry.collection_slug, []);
  await api.discover(entry.collection_slug, []);
  expect(api.saved(entry.collection_slug)).toHaveLength(22);
  await api.discover(entry.collection_slug, []);

  const reserve = api.saved(entry.collection_slug);
  expect(reserve).toHaveLength(24);
  expect(new Set(reserve.map((card) => card.publication_date)).size).toBe(24);
  expect(reserve[0]).toEqual(cards[18]);
});

it("ne prolonge pas la durée de vie des anciennes cartes en rechargeant la réserve", async () => {
  vi.useFakeTimers();
  const second = { ...entry, publication_date: "2026-11-04" };
  const third = { ...entry, publication_date: "2026-11-03" };
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => [entry] })
    .mockResolvedValueOnce({ ok: true, json: async () => [second] })
    .mockResolvedValueOnce({ ok: true, json: async () => [third] });
  vi.stubGlobal("fetch", fetch);
  await api.discover(entry.collection_slug, []);
  vi.setSystemTime(Date.now() + cacheAge - 1000);
  await api.discover(entry.collection_slug, []);
  vi.setSystemTime(Date.now() + 1000);
  await api.discover(entry.collection_slug, []);

  expect(api.saved(entry.collection_slug)).toEqual([third, second]);
});

it("conserve la version actualisée d’une carte déjà présente dans la réserve", async () => {
  const updated = { ...entry, payload: { ...entry.payload, definition: "Définition corrigée" } };
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [entry] })
      .mockResolvedValueOnce({ ok: true, json: async () => [updated] }),
  );
  await api.discover(entry.collection_slug, []);
  await api.discover(entry.collection_slug, []);
  expect(api.saved(entry.collection_slug)).toEqual([updated]);
});

it("ignore les valeurs mal formées et les cartes d’une autre collection", () => {
  save(`${scope}/today`, { date: "invalid", items: {} });
  save(`${scope}/collections/mot-du-jour/today`, { ...entry, payload: {} });
  save(`${scope}/collections/mot-du-jour/entries?limit=10`, [null]);
  save(`${scope}/collections/mot-du-jour/entries/2026-11-05`, {
    ...entry,
    collection_slug: "autre-collection",
  });
  save(`${scope}/discovery-pool/mot-du-jour`, [null, {}, entry]);

  expect(api.cachedToday()).toBeUndefined();
  expect(api.cachedEntry("mot-du-jour", null)).toBeUndefined();
  expect(api.cachedEntry("mot-du-jour", "2026-11-05")).toBeUndefined();
  expect(api.cachedHistory("mot-du-jour", null)).toBeUndefined();
  expect(api.saved("mot-du-jour")).toEqual([]);
});

it("ignore les snapshots expirés et ne déduit pas aujourd’hui de l’horloge du navigateur", () => {
  vi.useFakeTimers();
  save(`${scope}/today`, today);
  remember(entry, scope);
  remember({ ...entry, publication_date: "2026-11-06" }, scope);
  expect(api.saved(entry.collection_slug)).toEqual([entry]);
  vi.setSystemTime(Date.now() + cacheAge);
  expect(api.cachedToday()).toBeUndefined();
  expect(api.cachedEntry(entry.collection_slug, entry.publication_date)).toBeUndefined();
  expect(api.saved(entry.collection_slug)).toEqual([]);
});

it.each(["2026-11-05", "2026-11-06"])(
  "ne restaure pas une carte après une absence confirmée pour le %s",
  (date) => {
    save(`${scope}/collections/mot-du-jour/today`, entry);
    save(`${scope}/today`, {
      ...today,
      date,
      items: [{ ...today.items[0], entry: null }],
    });
    expect(api.cachedEntry(entry.collection_slug, null)).toBeUndefined();
  },
);

it.each([{ items: [] }, { items: [{ ...today.items[0], entry: null }] }])(
  "conserve la carte plus récente qu’un ancien accueil sans publication ($items)",
  ({ items }) => {
    save(`${scope}/today`, { ...today, date: "2026-11-04", items });
    save(`${scope}/collections/mot-du-jour/today`, entry);
    expect(api.cachedEntry(entry.collection_slug, null)).toEqual(entry);
  },
);

it("ne sauvegarde pas la réponse tardive d’une requête annulée", async () => {
  const controller = new AbortController();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        controller.abort();
        return today;
      },
    }),
  );
  await expect(api.today(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(api.cachedToday()).toBeUndefined();
});

it("continue sans stockage persistant disponible", async () => {
  const storage = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Storage blocked");
  });
  try {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => today }));
    expect(api.cachedToday()).toBeUndefined();
    expect(api.saved(entry.collection_slug)).toEqual([]);
    expect(await api.today()).toEqual(today);
  } finally {
    storage.mockRestore();
  }
});
