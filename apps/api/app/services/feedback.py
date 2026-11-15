from datetime import date
from hashlib import sha256
from uuid import UUID

from fastapi import HTTPException

from app.repositories.feedback import FeedbackRepository
from app.services.collections import CollectionService, serialize_entry


class FeedbackService:
    def __init__(self, collections: CollectionService, repository: FeedbackRepository):
        self.collections = collections
        self.repository = repository

    def entry(self, slug: str, day: date):
        collection = self.collections.collection(slug)
        entry = self.collections.repository.entry(collection.id, day)
        if entry is None:
            raise HTTPException(404, "Aucun contenu pour cette date")
        return entry

    def read(self, slug: str, day: date, reader_id: UUID):
        entry = self.entry(slug, day)
        return {"vote": self.repository.vote(entry.id, self.reader_hash(reader_id))}

    def save(self, slug: str, day: date, reader_id: UUID, vote: str | None):
        entry = self.entry(slug, day)
        self.repository.save(entry.id, self.reader_hash(reader_id), vote)
        return {"vote": vote}

    def favorites(self, reader_id: UUID, limit: int, offset: int):
        return [
            serialize_entry(collection, entry)
            for collection, entry in self.repository.favorites(
                self.reader_hash(reader_id), limit, offset
            )
        ]

    @staticmethod
    def reader_hash(reader_id: UUID):
        return sha256(str(reader_id).encode()).hexdigest()
