"""Exercise the actual historical Render entrypoint against a mocked primary API."""

import importlib.util

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import ROOT

spec = importlib.util.spec_from_file_location("legacy_gateway", ROOT / "api.py")
gateway = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gateway)


@pytest.fixture
def upstream(monkeypatch):
    responses = {}

    def handle(request):
        assert str(request.url).startswith(gateway.API_URL + "/")
        response = responses[request.url.raw_path.decode()]
        if isinstance(response, Exception):
            raise response
        return response

    client_class = httpx.AsyncClient
    monkeypatch.setattr(
        gateway.httpx,
        "AsyncClient",
        lambda **kwargs: client_class(transport=httpx.MockTransport(handle), **kwargs),
    )
    return responses


def word(day):
    return {
        "publication_date": day,
        "payload": {"term": "Mot", "definition": "Définition", "example": "Exemple"},
    }


def test_legacy_today_keeps_original_shape(upstream):
    upstream["/api/v1/collections/mot-du-jour/today"] = httpx.Response(200, json=word("2026-11-05"))
    with TestClient(gateway.app) as client:
        response = client.get("/motdujour")
    assert response.status_code == 200
    assert response.json() == {
        "date": "2026-11-05",
        "word": "Mot",
        "definition": "Définition",
        "example": "Exemple",
    }


def test_legacy_history_is_limited_and_chronological(upstream):
    upstream["/api/v1/collections/mot-du-jour/entries?limit=5"] = httpx.Response(
        200, json=[word("2026-11-05"), word("2026-11-04")]
    )
    with TestClient(gateway.app) as client:
        response = client.get("/historique")
    assert response.status_code == 200
    assert [entry["date"] for entry in response.json()] == ["2026-11-04", "2026-11-05"]


def test_absent_word_keeps_legacy_error(upstream):
    upstream["/api/v1/collections/mot-du-jour/today"] = httpx.Response(404)
    with TestClient(gateway.app) as client:
        response = client.get("/motdujour")
    assert response.status_code == 200
    assert "error" in response.json()


@pytest.mark.parametrize(
    "response",
    [httpx.Response(500), httpx.Response(200, text="broken"), httpx.ConnectTimeout("timeout")],
)
def test_unavailable_primary_api_returns_503(upstream, response):
    upstream["/health"] = response
    with TestClient(gateway.app) as client:
        assert client.get("/health").status_code == 503


def test_health_checks_the_primary_api(upstream):
    upstream["/health"] = httpx.Response(200, json={"status": "ok"})
    with TestClient(gateway.app) as client:
        assert client.get("/health").json() == {"status": "ok"}


@pytest.mark.parametrize("payload", [{}, [], None])
def test_malformed_word_returns_503(upstream, payload):
    upstream["/api/v1/collections/mot-du-jour/today"] = httpx.Response(200, json=payload)
    with TestClient(gateway.app) as client:
        assert client.get("/motdujour").status_code == 503


def test_redirects_preserve_primary_api_query_without_fetching_it():
    with TestClient(gateway.app) as client:
        home = client.get("/", follow_redirects=False)
        api = client.get(
            "/api/v1/collections/enigme-du-jour/entries?limit=5", follow_redirects=False
        )
    assert home.status_code == 307
    assert home.headers["location"] == gateway.SITE_URL
    assert api.status_code == 307
    assert api.headers["location"] == (
        gateway.API_URL + "/api/v1/collections/enigme-du-jour/entries?limit=5"
    )
