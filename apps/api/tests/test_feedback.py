import json
from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app.feedback_report import export_report
from app.models import DailyCollection, DailyEntry, EntryFeedback

PATH = "/api/v1/collections/mot-du-jour/entries/2026-01-01/feedback"


def test_vote_is_persisted_idempotent_replaceable_and_removable(client, database):
    headers = {"X-Reader-Id": str(uuid4())}
    assert client.get(PATH, headers=headers).json() == {"vote": None}
    for _ in range(2):
        response = client.put(PATH, headers=headers, json={"vote": "like"})
        assert response.status_code == 200
        assert response.json() == {"vote": "like"}
        assert response.headers["cache-control"] == "no-store"
    _, factory = database
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(EntryFeedback)) == 1
        assert session.scalar(select(EntryFeedback.reader_hash)) != headers["X-Reader-Id"]
    assert client.get(PATH, headers=headers).json() == {"vote": "like"}
    assert client.put(PATH, headers=headers, json={"vote": "dislike"}).json() == {"vote": "dislike"}
    assert client.get(PATH, headers=headers).json() == {"vote": "dislike"}
    assert client.put(PATH, headers=headers, json={"vote": None}).status_code == 200
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(EntryFeedback)) == 0


def test_readers_and_cards_are_isolated_and_favorites_paginate(client):
    first, second = ({"X-Reader-Id": str(uuid4())} for _ in range(2))
    other_card = PATH.replace("2026-01-01", "2025-12-31")
    client.put(PATH, headers=first, json={"vote": "like"})
    client.put(other_card, headers=first, json={"vote": "like"})
    client.put(PATH, headers=second, json={"vote": "dislike"})
    assert client.get(PATH, headers=first).json() == {"vote": "like"}
    assert client.get(PATH, headers=second).json() == {"vote": "dislike"}
    favorites = "/api/v1/feedback/favorites"
    page = client.get(favorites + "?limit=1", headers=first)
    assert page.headers["cache-control"] == "no-store"
    assert [e["publication_date"] for e in page.json()] == ["2026-01-01"]
    assert (
        client.get(favorites + "?limit=1&offset=1", headers=first).json()[0]["publication_date"]
        == "2025-12-31"
    )
    assert client.get(favorites, headers=second).json() == []
    client.put(PATH, headers=first, json={"vote": "dislike"})
    assert len(client.get(favorites, headers=first).json()) == 1


@pytest.mark.parametrize(
    "body", [{"vote": "love"}, {"vote": True}, {}, {"vote": "like", "extra": 1}]
)
def test_invalid_vote_cannot_write(client, body):
    assert client.put(PATH, headers={"X-Reader-Id": str(uuid4())}, json=body).status_code == 422


def test_identity_and_entry_are_required_and_inactive_cards_stay_hidden(client, database):
    assert client.put(PATH, json={"vote": "like"}).status_code == 422
    assert client.get(PATH, headers={"X-Reader-Id": "not-a-uuid"}).status_code == 422
    headers = {"X-Reader-Id": str(uuid4())}
    for path in [
        PATH.replace("2026-01-01", "2026-02-01"),
        PATH.replace("mot-du-jour", "unknown"),
        PATH.replace("mot-du-jour", "inactive"),
    ]:
        assert client.put(path, headers=headers, json={"vote": "like"}).status_code == 404
    client.put(PATH, headers=headers, json={"vote": "like"})
    _, factory = database
    with factory.begin() as session:
        session.scalar(
            select(DailyCollection).where(DailyCollection.slug == "mot-du-jour")
        ).active = False
    assert client.get("/api/v1/feedback/favorites", headers=headers).json() == []
    assert client.get(PATH, headers=headers).status_code == 404


def test_cors_allows_feedback_only_from_configured_origins(client):
    headers = {
        "Origin": "https://gbaratie.github.io",
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "content-type,x-reader-id",
    }
    response = client.options(PATH, headers=headers)
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == headers["Origin"]
    headers["Origin"] = "https://example.com"
    assert client.options(PATH, headers=headers).status_code == 400


def test_editorial_report_aggregates_latest_votes_without_identity(client, database):
    first, second = ({"X-Reader-Id": str(uuid4())} for _ in range(2))
    client.put(PATH, headers=first, json={"vote": "dislike"})
    client.put(PATH, headers=first, json={"vote": "like"})
    client.put(PATH, headers=second, json={"vote": "dislike"})
    url, _ = database
    report = export_report(url)
    assert report["total_votes"] == 2
    assert len(report["items"]) == 1
    assert report["items"][0]["likes"] == 1
    assert report["items"][0]["dislikes"] == 1
    assert report["items"][0]["payload"]["term"] == "Aujourd’hui"
    serialized = json.dumps(report, default=str)
    assert first["X-Reader-Id"] not in serialized and "reader_hash" not in serialized
    assert export_report(url, "citation-du-jour")["total_votes"] == 0
    assert export_report(url, since=date(2099, 1, 1))["total_votes"] == 0


def test_feedback_does_not_modify_editorial_payload(client, database):
    _, factory = database
    with factory() as session:
        before = [
            (entry.id, entry.payload, entry.updated_at)
            for entry in session.scalars(select(DailyEntry))
        ]
    client.put(PATH, headers={"X-Reader-Id": str(uuid4())}, json={"vote": "like"})
    with factory() as session:
        assert [
            (entry.id, entry.payload, entry.updated_at)
            for entry in session.scalars(select(DailyEntry))
        ] == before
