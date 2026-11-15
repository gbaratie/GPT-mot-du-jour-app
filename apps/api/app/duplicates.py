"""Check proposed editorial content against all years and the proposed batch."""

import argparse
import json
import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

from app.collections.registry import validate_payload
from app.config import ROOT
from app.content import ContentError, EditorialEntry, load_content, read_json


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.casefold())
    text = "".join(char for char in text if not unicodedata.combining(char))
    return " ".join(re.findall(r"[^\W_]+", text))


def subject(kind: str, payload: dict) -> str:
    return payload[{"word": "term", "quote": "text", "riddle": "question"}[kind]]


def find_duplicates(definition, candidates: list[dict], content: list) -> list[dict]:
    # Another collection in the same language may already contain the same subject.
    references = [
        (collection.slug, entry)
        for collection, entries in content
        if (collection.kind, collection.locale) == (definition.kind, definition.locale)
        for entry in entries
    ]
    findings = []
    for candidate in candidates:
        text = normalize(subject(definition.kind, candidate["payload"]))
        for slug, reference in references:
            if (
                slug == definition.slug
                and reference["publication_date"] == candidate["publication_date"]
            ):
                continue
            other = normalize(subject(definition.kind, reference["payload"]))
            match = None
            if text == other:
                match = "exact"
            elif definition.kind == "riddle" and re.sub(r"\b\d+\b", "#", text) == re.sub(
                r"\b\d+\b", "#", other
            ):
                match = "template"
            elif (
                min(len(text), len(other)) / max(len(text), len(other), 1) >= 0.75
                and SequenceMatcher(None, text, other, autojunk=False).ratio() >= 0.86
            ):
                match = "near"
            if match:
                findings.append(
                    {
                        "candidate_date": str(candidate["publication_date"]),
                        "match": match,
                        "existing_collection": slug,
                        "existing_date": str(reference["publication_date"]),
                        "existing_subject": subject(definition.kind, reference["payload"]),
                    }
                )
        references.append((definition.slug, candidate))
    return findings


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--content-root", type=Path, default=ROOT / "content")
    parser.add_argument("--collection", required=True)
    parser.add_argument("--draft", type=Path, required=True, help="JSON array of dated entries")
    args = parser.parse_args()
    content = load_content(args.content_root)
    definition = next((c for c, _ in content if c.slug == args.collection), None)
    if definition is None:
        raise ContentError(f"Collection inconnue : {args.collection}")
    raw = read_json(args.draft)
    if not isinstance(raw, list) or not raw:
        raise ContentError("Le brouillon doit contenir une liste non vide d'entrées datées")
    candidates = []
    for item in raw:
        entry = EditorialEntry.model_validate(item)
        candidates.append(
            {
                "publication_date": entry.publication_date,
                "payload": validate_payload(definition.kind, entry.payload),
            }
        )
    if len({e["publication_date"] for e in candidates}) != len(candidates):
        raise ContentError("Dates dupliquées dans le brouillon")
    findings = find_duplicates(definition, candidates, content)
    print(json.dumps({"findings": findings}, ensure_ascii=False, indent=2))
    # Similarities require human editorial review; exact re-publications are blocked.
    if any(finding["match"] == "exact" for finding in findings):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
