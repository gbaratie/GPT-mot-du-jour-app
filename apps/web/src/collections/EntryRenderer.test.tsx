import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    expect(screen.queryByText("Dans la maison")).not.toBeInTheDocument();
    expect(screen.queryByText("Un escalier")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voir la réponse" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    fireEvent.click(screen.getByRole("button", { name: "Voir la réponse" }));
    expect(screen.getByRole("button", { name: "Masquer la réponse" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("Un escalier")).toBeVisible();
    expect(screen.queryByText("Dans la maison")).not.toBeInTheDocument();
  });
  it("affiche et masque l’indice indépendamment de la réponse, puis le réinitialise pour une autre énigme", async () => {
    const entry = {
      ...base,
      kind: "riddle" as const,
      payload: { question: "Qui monte ?", answer: "Un escalier", hint: "Dans la maison" },
    };
    const { rerender } = render(<EntryRenderer entry={entry} />);
    const button = screen.getByRole("button", { name: "Voir l’indice" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(screen.getByText("Dans la maison")).toBeVisible();
    expect(document.getElementById(button.getAttribute("aria-controls")!)).toHaveTextContent(
      "Dans la maison",
    );
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText("Un escalier")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Masquer l’indice" }));
    await waitFor(() => expect(screen.queryByText("Dans la maison")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Voir l’indice" }));
    rerender(<EntryRenderer entry={{ ...entry, publication_date: "2026-11-05" }} />);
    expect(screen.queryByText("Dans la maison")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voir l’indice" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
  it("ne propose pas d’indice quand l’énigme n’en a pas", () => {
    render(
      <EntryRenderer
        entry={{
          ...base,
          kind: "riddle",
          payload: { question: "Qui monte ?", answer: "Un escalier", hint: null },
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: /indice/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voir la réponse" })).toBeVisible();
  });
});
