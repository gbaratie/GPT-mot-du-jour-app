let fallback: string | undefined;
const key = "daily-reader-v1";

export function readerId(): string {
  try {
    const stored = localStorage.getItem(key);
    if (
      stored &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored)
    )
      return stored;
  } catch {
    /* Continue for this session if storage is unavailable. */
  }
  fallback ??= crypto.randomUUID();
  try {
    localStorage.setItem(key, fallback);
  } catch {
    /* Session identity remains usable. */
  }
  return fallback;
}
