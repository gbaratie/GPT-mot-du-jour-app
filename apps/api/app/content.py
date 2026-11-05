"""Validate editorial files before any database mutation."""

import argparse
import calendar
import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator
from sqlalchemy import func, select

from app.collections.registry import PAYLOAD_MODELS, CollectionKind, validate_payload
from app.config import ROOT, Settings
from app.db import create_database
from app.models import DailyCollection, DailyEntry


class ContentError(ValueError):
    pass


class Coverage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    start: date
    end: date

    @model_validator(mode="after")
    def ordered(self):
        if self.start > self.end:
            raise ValueError("La fin de couverture précède le début")
        return self


class CollectionDefinition(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=100)
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    kind: CollectionKind
    locale: str = Field(pattern=r"^[a-z]{2,3}-[A-Z]{2}$")
    active: bool = Field(default=True, strict=True)
    sort_order: int = Field(default=0, ge=0, strict=True)
    coverage: list[Coverage] = Field(min_length=1)


class EditorialEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    publication_date: date
    payload: dict

    @field_validator("publication_date", mode="before")
    @classmethod
    def iso_date(cls, value):
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("La date doit être au format YYYY-MM-DD")
        return value


def read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise ContentError(f"JSON illisible : {path}") from exc


def load_content(root: Path = ROOT / "content") -> list[tuple[CollectionDefinition, list[dict]]]:
    manifest = read_json(root / "collections.json")
    if not isinstance(manifest, list) or not manifest:
        raise ContentError("collections.json doit contenir une liste non vide")
    result = []
    slugs: set[str] = set()
    for raw_collection in manifest:
        collection = CollectionDefinition.model_validate(raw_collection)
        if collection.slug in slugs:
            raise ContentError(f"Collection dupliquée : {collection.slug}")
        slugs.add(collection.slug)
        entries = []
        seen: set[date] = set()
        files = sorted((root / collection.slug).glob("*.json"))
        if not files:
            raise ContentError(f"{collection.slug} : aucun fichier de contenu")
        for path in files:
            if not re.fullmatch(r"\d{4}", path.stem):
                raise ContentError(f"Nom attendu : YYYY.json, reçu {path}")
            raw_entries = read_json(path)
            if not isinstance(raw_entries, list):
                raise ContentError(f"{path} doit contenir une liste")
            for raw in raw_entries:
                entry = EditorialEntry.model_validate(raw)
                day = entry.publication_date
                if day.year != int(path.stem):
                    raise ContentError(f"{path} : date hors de l'année du fichier ({day})")
                if day in seen:
                    raise ContentError(f"{collection.slug} : date dupliquée ({day})")
                seen.add(day)
                payload = validate_payload(collection.kind, entry.payload)
                entries.append({"publication_date": day, "payload": payload})
        expected: set[date] = set()
        for span in collection.coverage:
            days = {span.start + timedelta(days=i) for i in range((span.end - span.start).days + 1)}
            if expected & days:
                raise ContentError(f"{collection.slug} : plages de couverture superposées")
            expected |= days
        missing, outside = sorted(expected - seen), sorted(seen - expected)
        if missing:
            raise ContentError(f"{collection.slug} : dates manquantes : {missing[:10]}")
        if outside:
            raise ContentError(f"{collection.slug} : dates hors couverture : {outside[:10]}")
        result.append((collection, sorted(entries, key=lambda entry: entry["publication_date"])))
    unknown = {
        path.parent.name
        for path in root.glob("*/*.json")
        if path.parent.name != "schemas" and path.parent.name not in slugs
    }
    if unknown:
        raise ContentError(f"Dossiers sans collection : {sorted(unknown)}")
    return result


def sync_content(root: Path, database_url: str) -> int:
    content = load_content(root)
    engine, factory = create_database(database_url)
    try:
        if engine.dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import insert
        elif engine.dialect.name == "sqlite":
            from sqlalchemy.dialects.sqlite import insert
        else:
            raise ContentError("Synchronisation supportée sur PostgreSQL et SQLite uniquement")
        with factory.begin() as session:
            known = {definition.slug for definition, _ in content}
            stale = set(session.scalars(select(DailyCollection.slug))) - known
            if stale:
                raise ContentError(
                    f"Collections absentes du manifeste : {sorted(stale)}. "
                    "Conservez-les avec active=false pour les retirer."
                )
            for definition, entries in content:
                collection = session.scalar(
                    select(DailyCollection).where(DailyCollection.slug == definition.slug)
                )
                metadata = definition.model_dump(exclude={"coverage"})
                if collection is None:
                    collection = DailyCollection(**metadata)
                    session.add(collection)
                else:
                    if collection.kind != definition.kind:
                        raise ContentError(f"Le kind de {definition.slug} est immuable")
                    for key, value in metadata.items():
                        setattr(collection, key, value)
                session.flush()
                # Upsert by natural key; unchanged rows keep updated_at. Never delete archives.
                for entry in entries:
                    statement = insert(DailyEntry).values(collection_id=collection.id, **entry)
                    session.execute(
                        statement.on_conflict_do_update(
                            index_elements=["collection_id", "publication_date"],
                            set_={"payload": statement.excluded.payload, "updated_at": func.now()},
                            where=DailyEntry.payload.is_distinct_from(statement.excluded.payload),
                        )
                    )
        return sum(len(entries) for _, entries in content)
    finally:
        engine.dispose()


def import_legacy(source: Path, output: Path):
    raw = read_json(source)
    if not isinstance(raw, list):
        raise ContentError("Le fichier historique doit contenir une liste")
    by_year: dict[int, list] = {}
    seen: set[date] = set()
    for item in raw:
        entry = EditorialEntry.model_validate(
            {
                "publication_date": item["date"],
                "payload": {
                    "term": item["word"],
                    "definition": item["definition"],
                    "example": item["example"],
                },
            }
        )
        if entry.publication_date in seen:
            raise ContentError(f"Date dupliquée : {entry.publication_date}")
        seen.add(entry.publication_date)
        payload = validate_payload("word", entry.payload)
        by_year.setdefault(entry.publication_date.year, []).append(
            {
                "publication_date": str(entry.publication_date),
                "payload": payload,
            }
        )
    # Validate full historical years, including leap years, before writing any file.
    for year, entries in by_year.items():
        if len(entries) != (366 if calendar.isleap(year) else 365):
            raise ContentError(f"Année historique incomplète : {year}")
        if (output / f"{year}.json").exists():
            raise ContentError(f"Refus d'écraser {output / f'{year}.json'}")
    output.mkdir(parents=True, exist_ok=True)
    for year, entries in by_year.items():
        entries.sort(key=lambda entry: entry["publication_date"])
        (output / f"{year}.json").write_text(
            json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["validate", "sync", "import-legacy", "schemas"])
    parser.add_argument("--content-root", type=Path, default=ROOT / "content")
    parser.add_argument("--source", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "schemas":
            output = args.content_root / "schemas"
            output.mkdir(parents=True, exist_ok=True)
            schemas = {kind: model.model_json_schema() for kind, model in PAYLOAD_MODELS.items()}
            schemas["collection"] = CollectionDefinition.model_json_schema()
            for name, schema in schemas.items():
                (output / f"{name}.json").write_text(
                    json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
                )
        elif args.command == "import-legacy":
            if args.source is None:
                parser.error("--source est obligatoire")
            import_legacy(args.source, args.content_root / "mot-du-jour")
        elif args.command == "sync":
            count = sync_content(args.content_root, Settings.from_env().database_url)
            print(f"{count} entrées synchronisées (aucune suppression).")
        else:
            content = load_content(args.content_root)
            print(f"{len(content)} collections, {sum(len(e) for _, e in content)} entrées valides.")
    except (ContentError, ValidationError, KeyError) as exc:
        print(f"Validation échouée : {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
