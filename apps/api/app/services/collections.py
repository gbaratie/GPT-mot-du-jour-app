from datetime import date

from fastapi import HTTPException

from app.models import DailyCollection, DailyEntry
from app.repositories.collections import CollectionRepository


def serialize_entry(collection: DailyCollection, entry: DailyEntry) -> dict:
    return {
        "collection_slug": collection.slug,
        "kind": collection.kind,
        "publication_date": entry.publication_date,
        "payload": entry.payload,
    }


class CollectionService:
    def __init__(self, repository: CollectionRepository):
        self.repository = repository

    def collection(self, slug: str):
        collection = self.repository.collection(slug)
        if collection is None:
            raise HTTPException(404, "Collection introuvable")
        return collection

    def entry(self, slug: str, day: date):
        collection = self.collection(slug)
        entry = self.repository.entry(collection.id, day)
        if entry is None:
            raise HTTPException(404, "Aucun contenu pour cette date")
        return serialize_entry(collection, entry)

    def entries(self, slug: str, before: date, limit: int):
        collection = self.collection(slug)
        return [
            serialize_entry(collection, entry)
            for entry in self.repository.entries(collection.id, before, limit)
        ]

    def today(self, day: date):
        entries = self.repository.today_entries(day)
        return {
            "date": day,
            "items": [
                {
                    "collection": collection,
                    "entry": serialize_entry(collection, entries[collection.id])
                    if collection.id in entries
                    else None,
                }
                for collection in self.repository.collections()
            ],
        }
