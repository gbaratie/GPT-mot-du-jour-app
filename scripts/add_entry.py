#!/usr/bin/env python3
"""Create a draft, or insert a fully validated entry into editorial content."""

import argparse
import json
import shutil
import tempfile
from datetime import date, timedelta
from pathlib import Path

from app.collections import validate_payload
from app.config import ROOT
from app.content import ContentError, load_content, read_json


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def add_entry(root: Path, slug: str, day: date, payload: dict):
    content = load_content(root)
    found = next(
        ((definition, entries) for definition, entries in content if definition.slug == slug),
        None,
    )
    if found is None:
        raise ContentError(f"Collection inconnue : {slug}")
    definition, entries = found
    if any(entry["publication_date"] == day for entry in entries):
        raise ContentError(f"Date déjà publiée : {slug}/{day}")
    payload = validate_payload(definition.kind, payload)
    manifest = read_json(root / "collections.json")
    metadata = next(collection for collection in manifest if collection["slug"] == slug)
    spans = sorted(
        [
            *[
                (date.fromisoformat(span["start"]), date.fromisoformat(span["end"]))
                for span in metadata["coverage"]
            ],
            (day, day),
        ]
    )
    merged: list[list[date]] = []
    for start, end in spans:
        if merged and start <= merged[-1][1] + timedelta(days=1):
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    metadata["coverage"] = [{"start": str(start), "end": str(end)} for start, end in merged]
    path = Path(slug) / f"{day.year}.json"
    rows = read_json(root / path) if (root / path).exists() else []
    rows.append({"publication_date": str(day), "payload": payload})
    rows.sort(key=lambda entry: entry["publication_date"])
    with tempfile.TemporaryDirectory() as directory:
        staged = Path(directory) / "content"
        shutil.copytree(root, staged)
        write_json(staged / path, rows)
        write_json(staged / "collections.json", manifest)
        load_content(staged)
    write_json(root / path, rows)
    write_json(root / "collections.json", manifest)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--collection", required=True)
    parser.add_argument("--date", required=True, type=date.fromisoformat)
    parser.add_argument("--payload-file", type=Path)
    args = parser.parse_args()
    root = ROOT / "content"
    if args.payload_file:
        add_entry(root, args.collection, args.date, read_json(args.payload_file))
        print(f"Entrée validée et ajoutée : {args.collection}/{args.date}")
        return
    definition = next(
        (definition for definition, _ in load_content(root) if definition.slug == args.collection),
        None,
    )
    if definition is None:
        parser.error("Collection inconnue")
    templates = {
        "word": {"term": "", "definition": "", "example": ""},
        "quote": {"text": "", "author": "", "source": None},
        "riddle": {"question": "", "answer": "", "hint": None},
    }
    draft = ROOT / "work" / "drafts" / f"{args.collection}-{args.date}.json"
    if draft.exists():
        parser.error(f"Le brouillon existe déjà : {draft}")
    write_json(draft, templates[definition.kind])
    print(f"Brouillon créé : {draft}. Complétez-le puis relancez avec PAYLOAD={draft}")


if __name__ == "__main__":
    main()
