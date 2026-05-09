"""Typed tournament bracket data models."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from scoring.models import DebaterSide, new_uuid, utc_now

TournamentSize = Literal[4, 8]
MatchStatus = Literal["PENDING", "READY", "COMPLETE"]


class TournamentTopic(BaseModel):
    """Seed topic entered by the user."""

    model_config = ConfigDict(extra="forbid")

    seed: int = Field(ge=1, le=8)
    topic: str = Field(min_length=3, max_length=200)

    @field_validator("topic")
    @classmethod
    def normalize_topic(cls, value: str) -> str:
        return " ".join(value.strip().split())


class TournamentMatch(BaseModel):
    """One bracket match between topic seeds or prior winners."""

    model_config = ConfigDict(extra="forbid")

    match_id: str = Field(default_factory=new_uuid)
    round_number: int = Field(ge=1)
    slot_a: str
    slot_b: str
    status: MatchStatus = "PENDING"
    winner_topic: str | None = None
    winner_side: DebaterSide | None = None


class TournamentState(BaseModel):
    """Complete tournament bracket state."""

    model_config = ConfigDict(extra="forbid")

    tournament_id: str = Field(default_factory=new_uuid)
    size: TournamentSize
    topics: list[TournamentTopic]
    matches: list[TournamentMatch]
    champion_topic: str | None = None
    champion_side: DebaterSide | None = None
    created_at: datetime = Field(default_factory=utc_now)


class TournamentCreateRequest(BaseModel):
    """Create a 4-topic or 8-topic tournament bracket."""

    model_config = ConfigDict(extra="forbid")

    topics: list[str] = Field(min_length=4, max_length=8)

    @field_validator("topics")
    @classmethod
    def validate_size(cls, value: list[str]) -> list[str]:
        cleaned = [" ".join(topic.strip().split()) for topic in value if topic.strip()]
        if len(cleaned) not in (4, 8):
            raise ValueError("Tournament requires exactly 4 or 8 topics.")
        return cleaned
