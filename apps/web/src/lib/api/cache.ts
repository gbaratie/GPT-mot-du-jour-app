import type { DailyEntry } from "./types";

const KEY = "daily-cache-v1";
const WEEK = 7 * 24 * 60 * 60 * 1000;
type Record = { value: unknown; saved: number };
type Cache = { [key: string]: Record };
function read(): Cache {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([, item]) =>
          item && typeof item === "object" && typeof item.saved === "number" && "value" in item,
      ),
    );
  } catch {
    return {};
  }
}
export function cached<T>(key: string, maxAge: number): T | undefined {
  const item = read()[key];
  return item && Date.now() - item.saved < maxAge ? (item.value as T) : undefined;
}
export function save(key: string, value: unknown) {
  try {
    const cache = read();
    cache[key] = { value, saved: Date.now() };
    const keys = Object.keys(cache)
      .sort((a, b) => cache[b].saved - cache[a].saved)
      .slice(0, 200);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(keys.map((k) => [k, cache[k]]))));
  } catch {
    /* Storage unavailable or full: network remains usable. */
  }
}
export function remember(entry: DailyEntry, scope: string) {
  save(
    `${scope}/collections/${encodeURIComponent(entry.collection_slug)}/entries/${entry.publication_date}`,
    entry,
  );
}
export function savedEntries(slug: string, scope: string): DailyEntry[] {
  const prefix = `${scope}/collections/${encodeURIComponent(slug)}/entries/`;
  return Object.entries(read())
    .filter(([key, item]) => key.startsWith(prefix) && Date.now() - item.saved < WEEK)
    .map(([, item]) => item.value as DailyEntry);
}
export const cacheAge = WEEK;
