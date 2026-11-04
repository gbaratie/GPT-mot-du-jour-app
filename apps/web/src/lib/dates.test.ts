import { describe, expect, it } from "vitest";
import { formatDate, isDate } from "./dates";

describe("dates calendaires", () => {
  it("accepte les années bissextiles et rejette les dates impossibles", () => {
    expect(isDate("2024-02-29")).toBe(true);
    for (const value of ["2025-02-29", "2026-02-30", "2026-13-01", "2026-1-1", "<script>"]) {
      expect(isDate(value)).toBe(false);
    }
  });
  it("formate une date exacte sans décalage de jour", () => {
    expect(formatDate("2025-12-31")).toBe("31 décembre 2025");
  });
});
