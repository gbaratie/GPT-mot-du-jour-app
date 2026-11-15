from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Response

from app.api.dependencies import get_feedback_service
from app.schemas import EntryRead
from app.schemas.feedback import FeedbackRead, FeedbackWrite
from app.services.feedback import FeedbackService

router = APIRouter(prefix="/api/v1", tags=["feedback"])
Service = Annotated[FeedbackService, Depends(get_feedback_service)]
Reader = Annotated[UUID, Header(alias="X-Reader-Id")]


@router.get("/collections/{slug}/entries/{entry_date}/feedback", response_model=FeedbackRead)
def feedback(
    slug: str, entry_date: date, service: Service, x_reader_id: Reader, response: Response
):
    response.headers["Cache-Control"] = "no-store"
    return service.read(slug, entry_date, x_reader_id)


@router.put("/collections/{slug}/entries/{entry_date}/feedback", response_model=FeedbackRead)
def save_feedback(
    slug: str,
    entry_date: date,
    body: FeedbackWrite,
    service: Service,
    x_reader_id: Reader,
    response: Response,
):
    response.headers["Cache-Control"] = "no-store"
    return service.save(slug, entry_date, x_reader_id, body.vote)


@router.get("/feedback/favorites", response_model=list[EntryRead])
def favorites(
    service: Service,
    x_reader_id: Reader,
    response: Response,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0, le=10000)] = 0,
):
    response.headers["Cache-Control"] = "no-store"
    return service.favorites(x_reader_id, limit, offset)
