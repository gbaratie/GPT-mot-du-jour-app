import importlib.util
import json
from datetime import date

import pytest
from pydantic import ValidationError

from app.config import ROOT
from app.content import ContentError, load_content

spec = importlib.util.spec_from_file_location("add_entry", ROOT / "scripts/add_entry.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


@pytest.fixture
def content_root(tmp_path):
    root = tmp_path / "content"
    (root / "test-word").mkdir(parents=True)
    (root / "collections.json").write_text(
        json.dumps(
            [
                {
                    "slug": "test-word",
                    "name": "Test",
                    "description": "Test",
                    "kind": "word",
                    "locale": "fr-FR",
                    "coverage": [{"start": "2025-12-31", "end": "2025-12-31"}],
                }
            ]
        )
    )
    (root / "test-word/2025.json").write_text(
        json.dumps(
            [
                {
                    "publication_date": "2025-12-31",
                    "payload": {"term": "Mot", "definition": "Sens", "example": "Phrase"},
                }
            ]
        )
    )
    return root


def test_add_entry_extends_coverage_across_year_without_losing_archives(content_root):
    module.add_entry(
        content_root,
        "test-word",
        date(2026, 1, 1),
        {
            "term": "Nouveau",
            "definition": "Nouveau sens",
            "example": "Nouvelle phrase",
        },
    )
    definition, entries = load_content(content_root)[0]
    assert len(entries) == 2
    assert len(definition.coverage) == 1
    assert definition.coverage[0].end == date(2026, 1, 1)


def test_invalid_payload_and_duplicates_leave_files_unchanged(content_root):
    original = {path: path.read_bytes() for path in content_root.rglob("*.json")}
    with pytest.raises(ValidationError):
        module.add_entry(content_root, "test-word", date(2026, 1, 1), {"term": ""})
    with pytest.raises(ContentError, match="déjà publiée"):
        module.add_entry(content_root, "test-word", date(2025, 12, 31), {})
    assert {path: path.read_bytes() for path in content_root.rglob("*.json")} == original
