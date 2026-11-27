import {
  cached,
  save,
  remember,
  savedEntries,
  cacheAge,
  isDailyEntry,
  isEntryList,
  isTodayResponse,
} from "./cache";
import type { DailyEntry, TodayResponse, Feedback, FeedbackVote } from "./types";
import { readerId } from "../reader";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
type ReadOptions = { fallback?: boolean };

const entryPath = (slug: string, day: string | null) =>
  `/collections/${encodeURIComponent(slug)}/${day ? `entries/${encodeURIComponent(day)}` : "today"}`;
const historyPath = (slug: string, before: string | null) =>
  `/collections/${encodeURIComponent(slug)}/entries?limit=10${before ? `&before=${encodeURIComponent(before)}` : ""}`;

function readResponse<T>(path: string, maxAge: number): T | undefined {
  const value = cached<unknown>(`${API_URL}${path}`, maxAge);
  const [, , encodedSlug, resource, day] = path.split("?")[0].split("/");
  const slug = encodedSlug ? decodeURIComponent(encodedSlug) : undefined;
  const valid =
    path === "/today"
      ? isTodayResponse(value)
      : path.includes("?limit=")
        ? isEntryList(value) && value.every((entry) => entry.collection_slug === slug)
        : isDailyEntry(value) &&
          value.collection_slug === slug &&
          (resource !== "entries" || value.publication_date === day);
  return valid ? (value as T) : undefined;
}

function discoveryPool(slug: string): DailyEntry[] {
  const value = cached<unknown>(`${API_URL}/discovery-pool/${slug}`, cacheAge);
  // A merged pool must not extend the original seven-day lifetime of its cards.
  const retained = new Set(savedEntries(slug, API_URL).map((entry) => entry.publication_date));
  return Array.isArray(value)
    ? value
        .filter(isDailyEntry)
        .filter((entry) => entry.collection_slug === slug && retained.has(entry.publication_date))
    : [];
}

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

async function get<T>(
  path: string,
  signal?: AbortSignal,
  random = false,
  options: ReadOptions = {},
): Promise<T> {
  signal?.throwIfAborted();
  const key = `${API_URL}${path}`;
  const maxAge = path.includes("today") || path.includes("?limit=") ? 60000 : cacheAge;
  const hit = random || path.endsWith("today") ? undefined : readResponse<T>(path, maxAge);
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
    signal?.throwIfAborted();
    if (!random) save(key, value);
    // Cache individual publications regardless of the endpoint that supplied them.
    if (isEntryList(value)) value.forEach((entry) => remember(entry, API_URL));
    else if (isTodayResponse(value))
      value.items.forEach(({ entry }) => {
        if (entry) {
          remember(entry, API_URL);
          save(`${API_URL}/collections/${encodeURIComponent(entry.collection_slug)}/today`, entry);
        }
      });
    else if (isDailyEntry(value)) remember(value, API_URL);
    return value;
  } catch (error) {
    if (signal?.aborted || (error instanceof ApiError && error.status < 500)) throw error;
    const stale =
      random || options.fallback === false ? undefined : readResponse<T>(path, cacheAge);
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

async function feedbackRequest<T>(
  path: string,
  signal?: AbortSignal,
  vote?: FeedbackVote | null,
): Promise<T> {
  let slow = false;
  const timer = setTimeout(() => {
    slow = true;
    notifySlow(1);
  }, 3500);
  try {
    const response = await fetch(`${API_URL}/api/v1${path}`, {
      method: vote === undefined ? "GET" : "PUT",
      headers: {
        Accept: "application/json",
        "X-Reader-Id": readerId(),
        ...(vote === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: vote === undefined ? undefined : JSON.stringify({ vote }),
      cache: "no-store",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(90000)])
        : AbortSignal.timeout(90000),
    });
    if (!response.ok) throw new ApiError(response.status);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
    if (slow) notifySlow(-1);
  }
}

const feedbackPath = (slug: string, day: string) =>
  `/collections/${encodeURIComponent(slug)}/entries/${encodeURIComponent(day)}/feedback`;

export const api = {
  cachedToday: () => readResponse<TodayResponse>("/today", cacheAge),
  cachedEntry: (slug: string, day: string | null) => {
    if (day) return readResponse<DailyEntry>(entryPath(slug, day), cacheAge);
    const today = readResponse<TodayResponse>("/today", cacheAge);
    const item = today?.items.find(({ collection }) => collection.slug === slug);
    const entry = readResponse<DailyEntry>(entryPath(slug, null), cacheAge);
    if (entry && (!today || entry.publication_date > today.date)) return entry;
    return today ? (item?.entry ?? undefined) : entry;
  },
  cachedHistory: (slug: string, before: string | null) =>
    readResponse<DailyEntry[]>(historyPath(slug, before), cacheAge),
  feedback: (slug: string, day: string, signal?: AbortSignal) =>
    feedbackRequest<Feedback>(feedbackPath(slug, day), signal),
  vote: (slug: string, day: string, vote: FeedbackVote | null) =>
    feedbackRequest<Feedback>(feedbackPath(slug, day), undefined, vote),
  favorites: (offset = 0, signal?: AbortSignal) =>
    feedbackRequest<DailyEntry[]>(`/feedback/favorites?limit=20&offset=${offset}`, signal),
  saved: (slug: string) => {
    const today = readResponse<TodayResponse>("/today", cacheAge)?.date;
    const dated = today
      ? savedEntries(slug, API_URL).filter((e) => e.publication_date <= today)
      : [];
    const pool = discoveryPool(slug).filter((entry) => !today || entry.publication_date <= today);
    return [...new Map([...pool, ...dated].map((e) => [e.publication_date, e])).values()];
  },
  discover: async (slug: string, exclude: string[], signal?: AbortSignal) => {
    const query = new URLSearchParams({ limit: "12" });
    exclude.slice(-100).forEach((day) => query.append("exclude", day));
    const entries = await get<DailyEntry[]>(
      `/collections/${encodeURIComponent(slug)}/discover?${query}`,
      signal,
      true,
    );
    const pool = new Map<string, DailyEntry>();
    for (const entry of [...entries, ...discoveryPool(slug)]) {
      if (!pool.has(entry.publication_date)) pool.set(entry.publication_date, entry);
    }
    save(`${API_URL}/discovery-pool/${slug}`, [...pool.values()].slice(0, 24));
    return entries;
  },
  today: (signal?: AbortSignal, options?: ReadOptions) =>
    get<TodayResponse>("/today", signal, false, options),
  entry: (slug: string, day: string | null, signal?: AbortSignal, options?: ReadOptions) =>
    get<DailyEntry>(entryPath(slug, day), signal, false, options),
  history: (slug: string, before: string | null, signal?: AbortSignal) =>
    get<DailyEntry[]>(historyPath(slug, before), signal),
};
