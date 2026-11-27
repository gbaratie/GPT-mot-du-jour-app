import { isDate } from "../dates";
import type { Collection, DailyEntry, TodayResponse } from "./types";

const KEY = "daily-cache-v1";
const WEEK = 7 * 24 * 60 * 60 * 1000;
type Record = { value: unknown; saved: number };
type Cache = { [key: string]: Record };

function object(value: unknown): value is { [key: string]: unknown } {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
const text = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const optionalText = (value: unknown) => value === null || typeof value === "string";

export function isDailyEntry(value: unknown): value is DailyEntry {
  if (
    !object(value) ||
    !text(value.collection_slug) ||
    typeof value.publication_date !== "string" ||
    !isDate(value.publication_date) ||
    !object(value.payload)
  )
    return false;
  const payload = value.payload;
  switch (value.kind) {
    case "word":
      return text(payload.term) && text(payload.definition) && text(payload.example);
    case "quote":
      return text(payload.text) && text(payload.author) && optionalText(payload.source);
    case "riddle":
      return text(payload.question) && text(payload.answer) && optionalText(payload.hint);
    default:
      return false;
  }
}

function isCollection(value: unknown): value is Collection {
  return (
    object(value) &&
    text(value.slug) &&
    text(value.name) &&
    typeof value.description === "string" &&
    ["word", "quote", "riddle"].includes(value.kind as string) &&
    text(value.locale) &&
    typeof value.active === "boolean" &&
    typeof value.sort_order === "number" &&
    Number.isFinite(value.sort_order)
  );
}

export function isTodayResponse(value: unknown): value is TodayResponse {
  return (
    object(value) &&
    typeof value.date === "string" &&
    isDate(value.date) &&
    Array.isArray(value.items) &&
    value.items.every(
      (item) =>
        object(item) &&
        isCollection(item.collection) &&
        (item.entry === null ||
          (isDailyEntry(item.entry) &&
            item.entry.collection_slug === item.collection.slug &&
            item.entry.kind === item.collection.kind &&
            item.entry.publication_date === value.date)),
    )
  );
}

export function isEntryList(value: unknown): value is DailyEntry[] {
  return Array.isArray(value) && value.every(isDailyEntry);
}

function fresh(item: Record, maxAge: number) {
  const age = Date.now() - item.saved;
  return age >= 0 && age < maxAge;
}
function read(): Cache {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([, item]) =>
          object(item) &&
          typeof item.saved === "number" &&
          Number.isFinite(item.saved) &&
          "value" in item,
      ),
    );
  } catch {
    return {};
  }
}
export function cached<T>(key: string, maxAge: number): T | undefined {
  const item = read()[key];
  return item && fresh(item, maxAge) ? (item.value as T) : undefined;
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
    .filter(([key, item]) => key.startsWith(prefix) && fresh(item, WEEK))
    .map(([, item]) => item.value)
    .filter(isDailyEntry)
    .filter((entry) => entry.collection_slug === slug);
}
export const cacheAge = WEEK;
