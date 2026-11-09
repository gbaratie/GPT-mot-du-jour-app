const key = (slug: string) => `daily-seen-v1:${slug}`;
export function recentDates(slug: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(slug)) ?? "[]");
    return Array.isArray(value)
      ? value
          .filter(
            (day): day is string => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day),
          )
          .slice(-30)
      : [];
  } catch {
    return [];
  }
}
export function markSeen(slug: string, date: string) {
  try {
    localStorage.setItem(
      key(slug),
      JSON.stringify([...recentDates(slug).filter((d) => d !== date), date].slice(-30)),
    );
  } catch {
    /* Private browsing remains usable. */
  }
}
export function clearRecent(slug: string) {
  try {
    localStorage.removeItem(key(slug));
  } catch {
    /* Optional persistence. */
  }
}
