import json
import os
import subprocess
import sys
from datetime import date

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select

from app.collections import validate_payload
from app.config import ROOT
from app.content import ContentError, import_legacy, load_content, sync_content
from app.db import Base, create_database
from app.models import DailyEntry


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")


@pytest.fixture
def editorial(tmp_path):
    root = tmp_path / "content"
    write_json(
        root / "collections.json",
        [
            {
                "slug": "mot-du-jour",
                "name": "Mot",
                "description": "Un mot",
                "kind": "word",
                "locale": "fr-FR",
                "coverage": [{"start": "2026-01-01", "end": "2026-01-02"}],
            }
        ],
    )
    write_json(
        root / "mot-du-jour/2026.json",
        [
            {
                "publication_date": f"2026-01-{day:02d}",
                "payload": {"term": "Mot", "definition": "Définition", "example": "Exemple"},
            }
            for day in (1, 2)
        ],
    )
    return root


def test_repository_content_valid_and_legacy_year_complete():
    content = load_content()
    assert len(content) == 3
    word, entries = content[0]
    assert word.kind == "word"
    assert len(entries) == 422
    assert entries[0]["publication_date"] == date(2025, 1, 1)
    assert entries[364]["publication_date"] == date(2025, 12, 31)
    assert entries[365]["publication_date"] == date(2026, 11, 5)
    assert entries[-1]["publication_date"] == date(2026, 12, 31)
    assert [e["payload"] for e in entries[365:]] == [
        e["payload"] for e in entries[:365] if e["publication_date"] >= date(2025, 11, 5)
    ]
    assert content[1][0].kind == "quote"
    riddle, entries = content[2]
    assert riddle.slug == "enigme-du-jour"
    assert riddle.kind == "riddle"
    assert len(entries) == 57
    assert entries[0]["publication_date"] == date(2026, 11, 5)
    assert entries[-1]["publication_date"] == date(2026, 12, 31)


@pytest.mark.parametrize(
    "mutation, error",
    [
        (lambda rows: rows + [rows[0]], "dupliquée"),
        (lambda rows: rows[:1], "manquantes"),
        (lambda rows: [{**rows[0], "publication_date": "2025-12-31"}, rows[1]], "année"),
        (lambda rows: [{**rows[0], "publication_date": "2026-02-30"}, rows[1]], "date"),
        (lambda rows: [{**rows[0], "payload": {"term": ""}}, rows[1]], "validation"),
    ],
)
def test_content_rejects_invalid_entries(editorial, mutation, error):
    path = editorial / "mot-du-jour/2026.json"
    write_json(path, mutation(json.loads(path.read_text())))
    with pytest.raises((ContentError, ValidationError), match=error):
        load_content(editorial)


def test_rejects_undeclared_dates_and_collections(editorial):
    path = editorial / "mot-du-jour/2026.json"
    rows = json.loads(path.read_text())
    write_json(path, rows + [{**rows[0], "publication_date": "2026-01-03"}])
    with pytest.raises(ContentError, match="hors couverture"):
        load_content(editorial)
    write_json(path, rows)
    write_json(editorial / "unregistered/2026.json", [])
    with pytest.raises(ContentError, match="sans collection"):
        load_content(editorial)


@pytest.mark.parametrize(
    "kind,payload",
    [
        ("word", {"term": "Mot", "definition": "Sens", "example": "Phrase"}),
        ("quote", {"text": "Pensée", "author": "Auteur", "source": None}),
        ("riddle", {"question": "Question ?", "answer": "Réponse", "hint": None}),
    ],
)
def test_payload_registry(kind, payload):
    assert validate_payload(kind, payload) == payload
    with pytest.raises(ValidationError):
        validate_payload(kind, {**payload, "surprise": "not allowed"})


def test_sync_is_idempotent_and_updates_only_changed_entries(editorial, tmp_path):
    url = f"sqlite:///{tmp_path / 'sync.db'}"
    engine, factory = create_database(url)
    Base.metadata.create_all(engine)
    assert sync_content(editorial, url) == 2
    with factory() as session:
        original = [(entry.id, entry.updated_at) for entry in session.scalars(select(DailyEntry))]
    assert sync_content(editorial, url) == 2
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(DailyEntry)) == 2
        assert [
            (entry.id, entry.updated_at) for entry in session.scalars(select(DailyEntry))
        ] == original
    path = editorial / "mot-du-jour/2026.json"
    rows = json.loads(path.read_text())
    rows[0]["payload"]["term"] = "Corrigé"
    write_json(path, rows)
    sync_content(editorial, url)
    with factory() as session:
        assert (
            session.scalar(select(DailyEntry).order_by(DailyEntry.id)).payload["term"] == "Corrigé"
        )
    engine.dispose()


def test_sync_validates_before_connecting(editorial):
    write_json(editorial / "mot-du-jour/2026.json", [])
    with pytest.raises(ContentError, match="manquantes"):
        sync_content(editorial, "postgresql://not-a-real-host/db")


def test_sync_rolls_back_on_incompatible_collection(editorial, tmp_path):
    url = f"sqlite:///{tmp_path / 'rollback.db'}"
    engine, factory = create_database(url)
    Base.metadata.create_all(engine)
    sync_content(editorial, url)
    manifest = json.loads((editorial / "collections.json").read_text())
    manifest[0]["kind"] = "quote"
    write_json(editorial / "collections.json", manifest)
    write_json(
        editorial / "mot-du-jour/2026.json",
        [
            {
                "publication_date": f"2026-01-{day:02d}",
                "payload": {"text": "Texte", "author": "Auteur"},
            }
            for day in (1, 2)
        ],
    )
    with pytest.raises(ContentError, match="immuable"):
        sync_content(editorial, url)
    with factory() as session:
        assert all("term" in entry.payload for entry in session.scalars(select(DailyEntry)))
    engine.dispose()


def test_legacy_import_refuses_incomplete_year_without_writes(tmp_path):
    source = tmp_path / "legacy.json"
    write_json(
        source, [{"date": "2025-01-01", "word": "Mot", "definition": "Sens", "example": "Exemple"}]
    )
    output = tmp_path / "output"
    with pytest.raises(ContentError, match="incomplète"):
        import_legacy(source, output)
    assert not output.exists()


def test_migrations_upgrade_and_downgrade(tmp_path):
    env = {**os.environ, "DATABASE_URL": f"sqlite:///{tmp_path / 'migrations.db'}"}
    command = [sys.executable, "-m", "alembic", "-c", str(ROOT / "apps/api/alembic.ini")]
    subprocess.run([*command, "upgrade", "head"], env=env, check=True, capture_output=True)
    subprocess.run([*command, "check"], env=env, check=True, capture_output=True)
    subprocess.run([*command, "downgrade", "base"], env=env, check=True, capture_output=True)


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="PostgreSQL de test non configuré")
def test_postgres_migration_and_sync():
    # Dedicated disposable database only; the CI PostgreSQL service supplies this URL.
    url = os.environ["TEST_DATABASE_URL"]
    env = {**os.environ, "DATABASE_URL": url}
    command = [sys.executable, "-m", "alembic", "-c", str(ROOT / "apps/api/alembic.ini")]
    subprocess.run([*command, "upgrade", "head"], env=env, check=True, capture_output=True)
    assert sync_content(ROOT / "content", url) == 482
    assert sync_content(ROOT / "content", url) == 482
    subprocess.run([*command, "check"], env=env, check=True, capture_output=True)
    engine, factory = create_database(url)
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(DailyEntry)) == 482
    engine.dispose()
