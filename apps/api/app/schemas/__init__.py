from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.collections.registry import CollectionKind, QuotePayload, RiddlePayload, WordPayload


class CollectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    description: str
    kind: CollectionKind
    locale: str
    active: bool
    sort_order: int


class EntryBase(BaseModel):
    collection_slug: str
    publication_date: date


class WordEntry(EntryBase):
    kind: Literal["word"]
    payload: WordPayload


class QuoteEntry(EntryBase):
    kind: Literal["quote"]
    payload: QuotePayload


class RiddleEntry(EntryBase):
    kind: Literal["riddle"]
    payload: RiddlePayload


EntryRead = Annotated[WordEntry | QuoteEntry | RiddleEntry, Field(discriminator="kind")]


class TodayItem(BaseModel):
    collection: CollectionRead
    entry: EntryRead | None


class TodayRead(BaseModel):
    date: date
    items: list[TodayItem]
