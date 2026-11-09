import { cached, save, remember, savedEntries, cacheAge } from "./cache";
import type { DailyEntry, TodayResponse } from "./types";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public status: number) {
    super(
      status === 404 ? "Aucun contenu pour cette date." : "L’API est temporairement indisponible.",
    );
  }
}

let slowRequests = 0;
function notifySlow(delta: number) {
  slowRequests += delta;
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("daily-network", { detail: slowRequests }));
}

async function get<T>(path: string, signal?: AbortSignal, random = false): Promise<T> {
  signal?.throwIfAborted();
  const key = `${API_URL}${path}`;
  const maxAge = path.includes("today") || path.includes("?limit=") ? 60000 : cacheAge;
  const hit = random ? undefined : cached<T>(key, maxAge);
  if (hit !== undefined) return hit;
  let slow = false;
  const timer = setTimeout(() => {
    slow = true;
    notifySlow(1);
  }, 3500);
  try {
    const response = await fetch(`${API_URL}/api/v1${path}`, {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(90000)])
        : AbortSignal.timeout(90000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new ApiError(response.status);
    const value = (await response.json()) as T;
    if (!random) save(key, value);
    // Cache individual publications regardless of the endpoint that supplied them.
    const data = value as TodayResponse | DailyEntry[] | DailyEntry;
    if (Array.isArray(data)) data.forEach((entry) => remember(entry, API_URL));
    else if ("items" in data)
      data.items.forEach(({ entry }) => {
        if (entry) {
          remember(entry, API_URL);
          save(`${API_URL}/collections/${encodeURIComponent(entry.collection_slug)}/today`, entry);
        }
      });
    else if ("publication_date" in data) remember(data, API_URL);
    return value;
  } catch (error) {
    if (signal?.aborted || (error instanceof ApiError && error.status < 500)) throw error;
    const stale = random ? undefined : cached<T>(key, cacheAge);
    if (stale !== undefined) {
      if (typeof window !== "undefined") window.dispatchEvent(new Event("daily-offline-cache"));
      return stale;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    if (slow) notifySlow(-1);
  }
}

export const api = {
  saved: (slug: string) => {
    const today = cached<TodayResponse>(`${API_URL}/today`, cacheAge)?.date;
    const dated = today
      ? savedEntries(slug, API_URL).filter((e) => e.publication_date <= today)
      : [];
    const pool = cached<DailyEntry[]>(`${API_URL}/discovery-pool/${slug}`, cacheAge) ?? [];
    return [...new Map([...dated, ...pool].map((e) => [e.publication_date, e])).values()];
  },
  discover: async (slug: string, exclude: string[], signal?: AbortSignal) => {
    const query = new URLSearchParams({ limit: "12" });
    exclude.slice(-100).forEach((day) => query.append("exclude", day));
    const entries = await get<DailyEntry[]>(
      `/collections/${encodeURIComponent(slug)}/discover?${query}`,
      signal,
      true,
    );
    save(`${API_URL}/discovery-pool/${slug}`, entries);
    return entries;
  },
  today: (signal?: AbortSignal) => get<TodayResponse>("/today", signal),
  entry: (slug: string, day: string | null, signal?: AbortSignal) =>
    get<DailyEntry>(
      `/collections/${encodeURIComponent(slug)}/${day ? `entries/${encodeURIComponent(day)}` : "today"}`,
      signal,
    ),
  history: (slug: string, before: string | null, signal?: AbortSignal) =>
    get<DailyEntry[]>(
      `/collections/${encodeURIComponent(slug)}/entries?limit=10${before ? `&before=${encodeURIComponent(before)}` : ""}`,
      signal,
    ),
};
