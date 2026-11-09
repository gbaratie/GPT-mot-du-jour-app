from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_service, get_today
from app.schemas import CollectionRead, EntryRead, TodayRead
from app.services.collections import CollectionService

router = APIRouter(prefix="/api/v1", tags=["collections"])
Service = Annotated[CollectionService, Depends(get_service)]
Today = Annotated[date, Depends(get_today)]


@router.get("/collections", response_model=list[CollectionRead])
def collections(service: Service):
    return service.repository.collections()


@router.get("/today", response_model=TodayRead)
def today(service: Service, day: Today):
    return service.today(day)


@router.get("/collections/{slug}", response_model=CollectionRead)
def collection(slug: str, service: Service):
    return service.collection(slug)


@router.get("/collections/{slug}/today", response_model=EntryRead)
def collection_today(slug: str, service: Service, day: Today):
    return service.entry(slug, day)


@router.get("/collections/{slug}/discover", response_model=list[EntryRead])
def discover(
    slug: str,
    service: Service,
    day: Today,
    exclude: Annotated[list[date] | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=20)] = 12,
):
    return service.discover(slug, day, exclude or [], limit)


@router.get("/collections/{slug}/entries", response_model=list[EntryRead])
def entries(
    slug: str,
    service: Service,
    day: Today,
    before: date | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
):
    return service.entries(slug, before or day, limit)


@router.get("/collections/{slug}/entries/{entry_date}", response_model=EntryRead)
def entry(slug: str, entry_date: date, service: Service):
    return service.entry(slug, entry_date)
