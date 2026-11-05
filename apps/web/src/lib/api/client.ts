import type { DailyEntry, TodayResponse } from "./types";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public status: number) {
    super(
      status === 404 ? "Aucun contenu pour cette date." : "L’API est temporairement indisponible.",
    );
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<T>;
}

export const api = {
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
