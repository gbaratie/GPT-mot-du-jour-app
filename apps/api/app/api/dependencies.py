from datetime import datetime

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.repositories.collections import CollectionRepository
from app.services.collections import CollectionService


def get_session(request: Request):
    with request.app.state.session_factory() as session:
        yield session


def get_today(request: Request):
    return datetime.now(request.app.state.settings.timezone).date()


def get_service(session: Session = Depends(get_session)):  # noqa: B008
    return CollectionService(CollectionRepository(session))
