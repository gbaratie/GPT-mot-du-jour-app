from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import DailyCollection, DailyEntry


class CollectionRepository:
    def __init__(self, session: Session):
        self.session = session

    def collections(self):
        return self.session.scalars(
            select(DailyCollection)
            .where(DailyCollection.active.is_(True))
            .order_by(DailyCollection.sort_order, DailyCollection.slug)
        ).all()

    def collection(self, slug: str):
        return self.session.scalar(
            select(DailyCollection).where(
                DailyCollection.slug == slug, DailyCollection.active.is_(True)
            )
        )

    def entry(self, collection_id: int, day: date):
        return self.session.scalar(
            select(DailyEntry).where(
                DailyEntry.collection_id == collection_id, DailyEntry.publication_date == day
            )
        )

    def entries(self, collection_id: int, before: date, limit: int):
        return self.session.scalars(
            select(DailyEntry)
            .where(DailyEntry.collection_id == collection_id, DailyEntry.publication_date < before)
            .order_by(DailyEntry.publication_date.desc())
            .limit(limit)
        ).all()

    def discover(self, collection_id: int, day: date, exclude: list[date], limit: int):
        return self.session.scalars(
            select(DailyEntry)
            .where(
                DailyEntry.collection_id == collection_id,
                DailyEntry.publication_date <= day,
                DailyEntry.publication_date.not_in(exclude),
            )
            .order_by(func.random())
            .limit(limit)
        ).all()

    def today_entries(self, day: date):
        return {
            entry.collection_id: entry
            for entry in self.session.scalars(
                select(DailyEntry).where(DailyEntry.publication_date == day)
            )
        }
