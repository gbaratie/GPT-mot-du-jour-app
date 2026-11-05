"""Compatibility gateway for the historical Render start command `uvicorn api:app`."""

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse

API_URL = "https://daily-collections-api.onrender.com"
SITE_URL = "https://gbaratie.github.io/GPT-mot-du-jour-app/"

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


async def fetch_json(path: str):
    """Read the primary API without introducing a second database or calendar."""
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.get(f"{API_URL}{path}")
        if response.status_code == 404:
            raise HTTPException(404, "Aucune publication disponible")
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(503, "L'API principale est temporairement indisponible") from exc


def legacy_word(entry: dict) -> dict:
    try:
        payload = entry["payload"]
        return {
            "date": entry["publication_date"],
            "word": payload["term"],
            "definition": payload["definition"],
            "example": payload["example"],
        }
    except (KeyError, TypeError) as exc:
        raise HTTPException(503, "Réponse inattendue de l'API principale") from exc


@app.get("/")
def home():
    return RedirectResponse(SITE_URL, status_code=307)


@app.get("/health")
async def health():
    return await fetch_json("/health")


@app.get("/motdujour")
async def word_of_the_day():
    try:
        return legacy_word(await fetch_json("/api/v1/collections/mot-du-jour/today"))
    except HTTPException as exc:
        if exc.status_code == 404:
            return {"error": "Aucun mot disponible aujourd'hui"}
        raise


@app.get("/historique")
async def history():
    entries = await fetch_json("/api/v1/collections/mot-du-jour/entries?limit=5")
    if not isinstance(entries, list):
        raise HTTPException(503, "Réponse inattendue de l'API principale")
    return [legacy_word(entry) for entry in reversed(entries)]


@app.get("/docs")
@app.get("/api/v1/{path:path}")
def primary_api(request: Request):
    suffix = f"?{request.url.query}" if request.url.query else ""
    return RedirectResponse(f"{API_URL}{request.url.path}{suffix}", status_code=307)
