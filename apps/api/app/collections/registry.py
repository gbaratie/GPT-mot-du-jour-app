from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

CollectionKind = Literal["word", "quote", "riddle"]


class Payload(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class WordPayload(Payload):
    term: str = Field(min_length=1)
    definition: str = Field(min_length=1)
    example: str = Field(min_length=1)


class QuotePayload(Payload):
    text: str = Field(min_length=1)
    author: str = Field(min_length=1)
    source: str | None = Field(default=None, min_length=1)


class RiddlePayload(Payload):
    question: str = Field(min_length=1)
    answer: str = Field(min_length=1)
    hint: str | None = Field(default=None, min_length=1)


PAYLOAD_MODELS: dict[str, type[Payload]] = {
    "word": WordPayload,
    "quote": QuotePayload,
    "riddle": RiddlePayload,
}


def validate_payload(kind: str, payload: dict) -> dict:
    return PAYLOAD_MODELS[kind].model_validate(payload).model_dump(mode="json")
