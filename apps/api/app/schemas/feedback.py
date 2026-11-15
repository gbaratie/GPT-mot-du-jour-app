from typing import Literal

from pydantic import BaseModel, ConfigDict

Vote = Literal["like", "dislike"]


class FeedbackWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    vote: Vote | None


class FeedbackRead(BaseModel):
    vote: Vote | None
