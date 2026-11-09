from datetime import UTC, date, datetime
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import get_today
from app.config import Settings
from app.main import create_app
from app.models import DailyCollection, DailyEntry


def test_health_and_openapi(client):
    assert client.get("/health").json() == {"status": "ok"}
    schema = client.get("/openapi.json").json()
    assert "/api/v1/collections/{slug}/entries/{entry_date}" in schema["paths"]
    assert all(
        not set(methods) & {"post", "patch", "put", "delete"}
        for methods in schema["paths"].values()
    )


def test_list_active_collections(client):
    assert [c["slug"] for c in client.get("/api/v1/collections").json()] == [
        "mot-du-jour",
        "citation-du-jour",
    ]


def test_today_bundle_has_typed_payloads(client):
    response = client.get("/api/v1/today")
    assert response.status_code == 200
    body = response.json()
    assert body["date"] == "2026-01-01"
    assert body["items"][0]["entry"]["payload"]["term"] == "Aujourd’hui"
    assert body["items"][1]["entry"]["kind"] == "quote"


def test_history_crosses_year_and_excludes_today_and_future(client):
    body = client.get("/api/v1/collections/mot-du-jour/entries").json()
    assert [entry["publication_date"] for entry in body] == ["2025-12-31", "2025-12-30"]
    body = client.get("/api/v1/collections/mot-du-jour/entries?before=2026-01-02&limit=1").json()
    assert [entry["publication_date"] for entry in body] == ["2026-01-01"]


def test_exact_date_and_no_annual_repeat(client):
    assert client.get("/api/v1/collections/mot-du-jour/entries/2025-12-31").status_code == 200
    assert client.get("/api/v1/collections/mot-du-jour/entries/2026-12-31").status_code == 404
    assert (
        client.get("/api/v1/collections/mot-du-jour/today").json()["publication_date"]
        == "2026-01-01"
    )


@pytest.mark.parametrize(
    "path",
    [
        "/collections/unknown",
        "/collections/unknown/today",
        "/collections/unknown/entries",
        "/collections/unknown/entries/2026-01-01",
        "/collections/inactive",
    ],
)
def test_unknown_and_inactive_collections(client, path):
    assert client.get(f"/api/v1{path}").status_code == 404


@pytest.mark.parametrize("suffix", ["?limit=0", "?limit=101", "?before=2026-02-30"])
def test_invalid_query(client, suffix):
    assert client.get(f"/api/v1/collections/mot-du-jour/entries{suffix}").status_code == 422


def test_invalid_date(client):
    assert client.get("/api/v1/collections/mot-du-jour/entries/2026-02-30").status_code == 422


def test_today_bundle_keeps_empty_collections(client):
    client.app.dependency_overrides[get_today] = lambda: date(2027, 1, 1)
    body = client.get("/api/v1/today").json()
    assert len(body["items"]) == 2
    assert all(item["entry"] is None for item in body["items"])


def test_cors_allows_only_configured_origins(client):
    headers = {"Origin": "https://gbaratie.github.io", "Access-Control-Request-Method": "GET"}
    response = client.options("/api/v1/today", headers=headers)
    assert response.headers["access-control-allow-origin"] == "https://gbaratie.github.io"
    headers["Origin"] = "https://example.com"
    assert (
        "access-control-allow-origin"
        not in client.options("/api/v1/today", headers=headers).headers
    )


@pytest.mark.parametrize(
    "utc, expected",
    [
        (datetime(2025, 12, 31, 23, 30, tzinfo=UTC), date(2026, 1, 1)),
        (datetime(2026, 6, 30, 22, 30, tzinfo=UTC), date(2026, 7, 1)),
    ],
)
def test_today_uses_paris_even_before_utc_midnight(client, utc, expected):
    client.app.dependency_overrides.clear()
    with patch("app.api.dependencies.datetime") as clock:
        clock.now.side_effect = lambda timezone: utc.astimezone(timezone)
        assert client.get("/api/v1/today").json()["date"] == str(expected)


def test_database_failure_does_not_expose_credentials(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'missing' / 'db'}")
    app = create_app(Settings.from_env())
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/health")
        assert response.status_code == 503
        assert response.json() == {"detail": "Service temporairement indisponible"}


def test_unique_collection_date_constraint(database):
    _, factory = database
    with factory() as session:
        collection = session.scalar(
            select(DailyCollection).where(DailyCollection.slug == "mot-du-jour")
        )
        session.add(
            DailyEntry(collection_id=collection.id, publication_date=date(2026, 1, 1), payload={})
        )
        with pytest.raises(IntegrityError):
            session.commit()


def test_discover_excludes_recent_future_and_other_collections(client):
    response = client.get(
        "/api/v1/collections/mot-du-jour/discover",
        params={"exclude": ["2026-01-01", "2025-12-31"]},
    )
    assert response.status_code == 200
    assert [entry["publication_date"] for entry in response.json()] == ["2025-12-30"]
    assert all(entry["collection_slug"] == "mot-du-jour" for entry in response.json())
    assert client.get("/api/v1/collections/inactive/discover").status_code == 404
    assert client.get("/api/v1/collections/unknown/discover").status_code == 404


def test_discover_limit_exhaustion_and_validation(client):
    assert len(client.get("/api/v1/collections/mot-du-jour/discover?limit=1").json()) == 1
    assert (
        client.get("/api/v1/collections/citation-du-jour/discover?exclude=2026-01-01").json() == []
    )
    for query in ["limit=0", "limit=21", "exclude=bad", "&".join(["exclude=2025-12-31"] * 101)]:
        assert client.get(f"/api/v1/collections/mot-du-jour/discover?{query}").status_code == 422


def test_discover_searches_distant_archives(client, database):
    _, factory = database
    with factory.begin() as session:
        collection = session.scalar(
            select(DailyCollection).where(DailyCollection.slug == "mot-du-jour")
        )
        session.add(
            DailyEntry(
                collection_id=collection.id,
                publication_date=date(2020, 1, 1),
                payload={"term": "Ancien", "definition": "Une archive", "example": "Un exemple"},
            )
        )
    response = client.get(
        "/api/v1/collections/mot-du-jour/discover",
        params={"exclude": ["2025-12-30", "2025-12-31", "2026-01-01"]},
    )
    assert response.status_code == 200
    assert [entry["publication_date"] for entry in response.json()] == ["2020-01-01"]
