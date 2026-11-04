import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Home from "./Home";

afterEach(() => vi.unstubAllGlobals());

it("affiche un état vide et un lien vers les archives quand il n’y a pas de mot", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        date: "2026-11-04",
        items: [
          {
            collection: { slug: "mot-du-jour", name: "Mot du jour", locale: "fr-FR" },
            entry: null,
          },
        ],
      }),
    }),
  );
  render(<Home />);
  expect(await screen.findByText(/Aucun contenu publié aujourd’hui/)).toBeVisible();
  expect(screen.getByRole("link", { name: /Explorer/ })).toHaveAttribute(
    "href",
    expect.stringMatching(/^\/mot-du-jour\/?$/),
  );
});

it("affiche une erreur avec une possibilité de réessayer", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network error")));
  render(<Home />);
  expect(await screen.findByText(/ne peut pas être chargé/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Réessayer" })).toBeVisible();
});
