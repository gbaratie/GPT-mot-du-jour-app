import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EntryRenderer } from "./EntryRenderer";

const base = { collection_slug: "test", publication_date: "2026-11-04" };

describe("rendu par kind", () => {
  it("présente un mot sans interpréter son contenu comme du HTML", () => {
    render(
      <EntryRenderer
        entry={{
          ...base,
          kind: "word",
          payload: {
            term: "<script>alert(1)</script>",
            definition: "Définition",
            example: "Exemple",
          },
        }}
      />,
    );
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });
  it("présente une citation avec son auteur et sa source", () => {
    render(
      <EntryRenderer
        entry={{
          ...base,
          kind: "quote",
          payload: {
            text: "Cultiver notre jardin.",
            author: "Voltaire",
            source: "Candide",
          },
        }}
      />,
    );
    expect(screen.getByText("Voltaire")).toBeInTheDocument();
    expect(screen.getByText("Candide")).toBeInTheDocument();
  });
  it("révèle la réponse de la devinette sur demande", () => {
    render(
      <EntryRenderer
        entry={{
          ...base,
          kind: "riddle",
          payload: {
            question: "Qui monte ?",
            answer: "Un escalier",
            hint: "Dans la maison",
          },
        }}
      />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Voir la réponse" }));
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Un escalier")).toBeVisible();
  });
});
