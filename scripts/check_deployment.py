#!/usr/bin/env python3
"""Read-only checks for the deployed API, CORS and static Pages routes."""

import argparse
import json
import re
import time
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent


def fetch(url: str, origin: str, *, method: str = "GET"):
    headers = {"Origin": origin}
    if method == "OPTIONS":
        headers["Access-Control-Request-Method"] = "GET"
    with urlopen(Request(url, headers=headers, method=method), timeout=30) as response:
        return response.read(), response.headers


def check_api_once(api_url: str, origin: str):
    body, _ = fetch(f"{api_url}/health", origin)
    assert json.loads(body) == {"status": "ok"}, "Health check invalide"

    body, headers = fetch(f"{api_url}/api/v1/collections", origin)
    assert headers.get("Access-Control-Allow-Origin") == origin, "Origine CORS non autorisée"
    collections = json.loads(body)
    manifest = json.loads((ROOT / "content/collections.json").read_text(encoding="utf-8"))
    active = [collection for collection in manifest if collection["active"]]
    assert {c["slug"] for c in collections} == {c["slug"] for c in active}, (
        "Collections non synchronisées"
    )
    for collection in active:
        slug = collection["slug"]
        source = sorted((ROOT / "content" / slug).glob("*.json"))[0]
        sample = json.loads(source.read_text(encoding="utf-8"))[0]
        body, _ = fetch(
            f"{api_url}/api/v1/collections/{slug}/entries/{sample['publication_date']}", origin
        )
        entry = json.loads(body)
        assert entry["collection_slug"] == slug and entry["kind"] == collection["kind"]
        assert entry["publication_date"] == sample["publication_date"]
        assert all(entry["payload"][key] == value for key, value in sample["payload"].items())

    paris = ZoneInfo("Europe/Paris")
    before = datetime.now(paris).date().isoformat()
    body, _ = fetch(f"{api_url}/api/v1/today", origin)
    today = json.loads(body)
    after = datetime.now(paris).date().isoformat()
    assert today["date"] in {before, after}, "Le jour courant ne correspond pas à Paris"
    assert len(today["items"]) == len(active)
    _, headers = fetch(f"{api_url}/api/v1/today", origin, method="OPTIONS")
    assert headers.get("Access-Control-Allow-Origin") == origin, "Prévol CORS refusé"
    print("API : santé, collections, archives, contenu, date de Paris et CORS vérifiés.")


def check_api(api_url: str, origin: str, *, wait_seconds: float = 0):
    deadline = time.monotonic() + wait_seconds
    while True:
        try:
            check_api_once(api_url, origin)
            return
        except (URLError, TimeoutError, AssertionError) as exc:
            detail = f"{exc} ({exc.url})" if isinstance(exc, HTTPError) else str(exc)
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise RuntimeError(f"API non prête : {detail}") from exc
            print(f"API en cours de mise à jour : {detail}. Nouvel essai…", flush=True)
            time.sleep(min(10, remaining))


def check_web(web_url: str, origin: str):
    web_url = web_url.rstrip("/") + "/"
    body, _ = fetch(web_url, origin)
    html = body.decode("utf-8")
    assert "Chaque jour" in html, "Page d'accueil inattendue"
    manifest = json.loads((ROOT / "content/collections.json").read_text(encoding="utf-8"))
    for collection in manifest:
        if collection["active"]:
            body, _ = fetch(urljoin(web_url, collection["slug"] + "/"), origin)
            assert b"<!DOCTYPE html>" in body or b"<!doctype html>" in body
    assets = re.findall(r'src="([^"]+\.js(?:\?[^"]*)?)"', html)
    assert assets, "Aucun script JavaScript dans l'export"
    for asset in assets:
        url = urljoin(web_url, asset)
        assert urlsplit(url).netloc == urlsplit(web_url).netloc, "Asset hors du domaine du site"
        fetch(url, origin)
    print("Front : accueil, routes de collections et assets sous le basePath vérifiés.")


def check_legacy(legacy_url: str, api_url: str, origin: str):
    def legacy_word(entry):
        return {
            "date": entry["publication_date"],
            "word": entry["payload"]["term"],
            "definition": entry["payload"]["definition"],
            "example": entry["payload"]["example"],
        }

    # Both free Render services can still be rolling out when Pages finishes.
    for attempt in range(12):
        try:
            body, _ = fetch(f"{legacy_url}/health", origin)
            assert json.loads(body) == {"status": "ok"}, "Passerelle indisponible"
            try:
                body, _ = fetch(f"{api_url}/api/v1/collections/mot-du-jour/today", origin)
                expected = legacy_word(json.loads(body))
            except HTTPError as exc:
                if exc.code != 404:
                    raise
                expected = {"error": "Aucun mot disponible aujourd'hui"}
            body, _ = fetch(f"{legacy_url}/motdujour", origin)
            assert json.loads(body) == expected, "Le mot historique diffère de l'API principale"
            body, _ = fetch(f"{api_url}/api/v1/collections/mot-du-jour/entries?limit=5", origin)
            expected_history = [legacy_word(entry) for entry in reversed(json.loads(body))]
            body, _ = fetch(f"{legacy_url}/historique", origin)
            assert json.loads(body) == expected_history, "L'historique de la passerelle diffère"
            print("Passerelle : santé, mot du jour et historique comparés à l'API principale.")
            return
        except (URLError, TimeoutError, AssertionError):
            if attempt == 11:
                raise
            time.sleep(5)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", required=True)
    parser.add_argument("--origin")
    parser.add_argument(
        "--wait-seconds",
        type=int,
        default=0,
        help="Temps maximal d’attente de synchronisation de l’API",
    )
    parser.add_argument("--web-url")
    parser.add_argument("--legacy-api-url")
    args = parser.parse_args()
    if args.wait_seconds < 0:
        parser.error("--wait-seconds doit être positif")
    for url in [args.api_url, args.web_url, args.legacy_api_url]:
        if url:
            parsed = urlsplit(url)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.username:
                parser.error("URL HTTP publique attendue, sans identifiants")
    parsed = urlsplit(args.web_url or "https://gbaratie.github.io")
    origin = args.origin or f"{parsed.scheme}://{parsed.netloc}"
    try:
        check_api(args.api_url.rstrip("/"), origin, wait_seconds=args.wait_seconds)
        if args.web_url:
            check_web(args.web_url, origin)
        if args.legacy_api_url:
            check_legacy(args.legacy_api_url.rstrip("/"), args.api_url.rstrip("/"), origin)
    except (
        RuntimeError,
        AssertionError,
        HTTPError,
        URLError,
        TimeoutError,
        ValueError,
        KeyError,
    ) as exc:
        raise SystemExit(f"Vérification du déploiement échouée : {exc}") from exc


if __name__ == "__main__":
    main()
