from datetime import date
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_today
from app.config import Settings
from app.db import Base, create_database
from app.main import create_app
from app.models import DailyCollection, DailyEntry


@pytest.fixture
def database(tmp_path):
    url = f"sqlite:///{tmp_path / 'test.db'}"
    engine, factory = create_database(url)
    Base.metadata.create_all(engine)
    with factory.begin() as session:
        word = DailyCollection(
            slug="mot-du-jour",
            name="Mot du jour",
            description="Des mots",
            kind="word",
            locale="fr-FR",
            active=True,
            sort_order=0,
        )
        quote = DailyCollection(
            slug="citation-du-jour",
            name="Citation du jour",
            description="Des pensées",
            kind="quote",
            locale="fr-FR",
            active=True,
            sort_order=1,
        )
        hidden = DailyCollection(
            slug="inactive",
            name="Inactive",
            description="Masquée",
            kind="riddle",
            locale="fr-FR",
            active=False,
            sort_order=2,
        )
        session.add_all([word, quote, hidden])
        session.flush()
        for day, term in [
            (date(2025, 12, 30), "Hier"),
            (date(2025, 12, 31), "Veille"),
            (date(2026, 1, 1), "Aujourd’hui"),
            (date(2026, 1, 2), "Demain"),
        ]:
            session.add(
                DailyEntry(
                    collection_id=word.id,
                    publication_date=day,
                    payload={
                        "term": term,
                        "definition": "Une définition",
                        "example": "Un exemple",
                    },
                )
            )
        session.add(
            DailyEntry(
                collection_id=quote.id,
                publication_date=date(2026, 1, 1),
                payload={
                    "text": "Une pensée",
                    "author": "Auteur",
                    "source": None,
                },
            )
        )
    yield url, factory
    engine.dispose()


@pytest.fixture
def client(database):
    url, _ = database
    app = create_app(Settings(url, ("https://gbaratie.github.io",), ZoneInfo("Europe/Paris")))
    app.dependency_overrides[get_today] = lambda: date(2026, 1, 1)
    with TestClient(app) as client:
        yield client
