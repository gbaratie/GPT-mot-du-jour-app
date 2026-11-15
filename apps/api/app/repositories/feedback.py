from datetime import date

from sqlalchemy import case, delete, func, select
from sqlalchemy.orm import Session

from app.models import DailyCollection, DailyEntry, EntryFeedback


class FeedbackRepository:
    def __init__(self, session: Session):
        self.session = session

    def vote(self, entry_id: int, reader_hash: str):
        return self.session.scalar(
            select(EntryFeedback.vote).where(
                EntryFeedback.entry_id == entry_id, EntryFeedback.reader_hash == reader_hash
            )
        )

    def save(self, entry_id: int, reader_hash: str, vote: str | None):
        if vote is None:
            self.session.execute(
                delete(EntryFeedback).where(
                    EntryFeedback.entry_id == entry_id, EntryFeedback.reader_hash == reader_hash
                )
            )
        else:
            # A database upsert keeps retries and simultaneous identical votes idempotent.
            if self.session.get_bind().dialect.name == "postgresql":
                from sqlalchemy.dialects.postgresql import insert
            else:
                from sqlalchemy.dialects.sqlite import insert
            statement = insert(EntryFeedback).values(
                entry_id=entry_id, reader_hash=reader_hash, vote=vote
            )
            self.session.execute(
                statement.on_conflict_do_update(
                    index_elements=["entry_id", "reader_hash"],
                    set_={"vote": statement.excluded.vote, "updated_at": func.now()},
                    where=EntryFeedback.vote != statement.excluded.vote,
                )
            )
        self.session.commit()

    def favorites(self, reader_hash: str, limit: int, offset: int):
        return self.session.execute(
            select(DailyCollection, DailyEntry)
            .join(DailyEntry, DailyEntry.collection_id == DailyCollection.id)
            .join(EntryFeedback, EntryFeedback.entry_id == DailyEntry.id)
            .where(
                DailyCollection.active.is_(True),
                EntryFeedback.reader_hash == reader_hash,
                EntryFeedback.vote == "like",
            )
            .order_by(DailyEntry.publication_date.desc(), DailyEntry.id.desc())
            .limit(limit)
            .offset(offset)
        ).all()

    def report(self, slug: str | None = None, since: date | None = None):
        statement = (
            select(
                DailyCollection.slug,
                DailyCollection.kind,
                DailyEntry.publication_date,
                DailyEntry.payload,
                func.sum(case((EntryFeedback.vote == "like", 1), else_=0)).label("likes"),
                func.sum(case((EntryFeedback.vote == "dislike", 1), else_=0)).label("dislikes"),
            )
            .join(DailyEntry, DailyEntry.collection_id == DailyCollection.id)
            .join(EntryFeedback, EntryFeedback.entry_id == DailyEntry.id)
            .where(DailyCollection.active.is_(True))
            .group_by(
                DailyCollection.slug,
                DailyCollection.kind,
                DailyEntry.id,
                DailyEntry.publication_date,
                DailyEntry.payload,
            )
            .order_by(DailyCollection.slug, DailyEntry.publication_date)
        )
        if slug:
            statement = statement.where(DailyCollection.slug == slug)
        if since:
            statement = statement.where(func.date(EntryFeedback.updated_at) >= since)
        return [dict(row) for row in self.session.execute(statement).mappings()]
