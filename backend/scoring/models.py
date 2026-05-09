"""Pydantic models shared by the backend API, graph, and scoring engine."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

DebaterSide = Literal["PRO", "CON"]
WinnerSide = Literal["PRO", "CON", "TIE"]
DebateMode = Literal["AI_VS_AI", "HUMAN_VS_AI", "HUMAN_VS_HUMAN"]
DebateStatus = Literal[
    "WAITING",
    "PRO_TURN",
    "CON_TURN",
    "JUDGING",
    "MODERATING",
    "ROUND_COMPLETE",
    "DEBATE_ENDED",
    "ERROR",
]

DIMENSION_NAMES: tuple[str, ...] = (
    "logical_coherence",
    "evidence_quality",
    "persuasiveness",
    "relevance",
    "counterargument",
    "originality",
)


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp."""

    return datetime.now(timezone.utc)


def new_uuid() -> str:
    """Generate string UUIDs so models serialize cleanly to Redis and JSON."""

    return str(uuid4())


def clamp_score(value: float) -> float:
    """Clamp scoring values to the closed interval expected by the UI."""

    return round(max(0.0, min(1.0, float(value))), 4)


class Argument(BaseModel):
    """Single argument produced by a debater during one round."""

    model_config = ConfigDict(extra="forbid")

    argument_id: str = Field(default_factory=new_uuid)
    debate_id: str
    debater: DebaterSide
    text: str = Field(min_length=1, max_length=4_000)
    round_number: int = Field(ge=1)
    timestamp: datetime = Field(default_factory=utc_now)
    flags: list[str] = Field(default_factory=list)

    @field_validator("text")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return " ".join(value.strip().split())


class ArgumentScore(BaseModel):
    """Judge score for one argument."""

    model_config = ConfigDict(extra="forbid")

    argument_id: str
    debater: DebaterSide
    round_number: int = Field(ge=1)
    dimensions: dict[str, float]
    final_score: float
    judge_reasoning: str
    timestamp: datetime = Field(default_factory=utc_now)
    flags: list[str] = Field(default_factory=list)

    @field_validator("dimensions")
    @classmethod
    def normalize_dimensions(cls, value: dict[str, float]) -> dict[str, float]:
        return {dimension: clamp_score(value.get(dimension, 0.0)) for dimension in DIMENSION_NAMES}

    @field_validator("final_score")
    @classmethod
    def normalize_final_score(cls, value: float) -> float:
        return clamp_score(value)


class DebateConfig(BaseModel):
    """User-controlled debate configuration."""

    model_config = ConfigDict(extra="forbid")

    topic: str = Field(min_length=3, max_length=200)
    max_rounds: int = Field(default=5, ge=1, le=10)
    pro_model: str = "claude-sonnet-4-20250514"
    con_model: str = "claude-sonnet-4-20250514"
    judge_model: str = "claude-sonnet-4-20250514"
    mode: DebateMode = "AI_VS_AI"
    human_side: DebaterSide | None = None

    @field_validator("topic")
    @classmethod
    def normalize_topic(cls, value: str) -> str:
        return " ".join(value.strip().split())

    @model_validator(mode="after")
    def normalize_mode(self) -> "DebateConfig":
        if self.mode == "HUMAN_VS_AI" and self.human_side is None:
            self.human_side = "PRO"
        if self.mode == "AI_VS_AI":
            self.human_side = None
        return self


class DebateState(BaseModel):
    """Complete debate session state persisted in Redis."""

    model_config = ConfigDict(extra="forbid")

    debate_id: str = Field(default_factory=new_uuid)
    topic: str = Field(min_length=3, max_length=200)
    current_round: int = Field(default=1, ge=1)
    max_rounds: int = Field(default=5, ge=1, le=10)
    pro_model: str = "claude-sonnet-4-20250514"
    con_model: str = "claude-sonnet-4-20250514"
    judge_model: str = "claude-sonnet-4-20250514"
    mode: DebateMode = "AI_VS_AI"
    human_side: DebaterSide | None = None
    turn: DebaterSide = "PRO"
    arguments: list[Argument] = Field(default_factory=list)
    scores: list[ArgumentScore] = Field(default_factory=list)
    pro_total_score: float = 0.0
    con_total_score: float = 0.0
    is_active: bool = False
    winner: WinnerSide | None = None
    summary: str | None = None
    status: DebateStatus = "WAITING"
    audience_votes: dict[DebaterSide, int] = Field(default_factory=lambda: {"PRO": 0, "CON": 0})

    @model_validator(mode="after")
    def normalize_vote_keys(self) -> "DebateState":
        self.audience_votes = {
            "PRO": int(self.audience_votes.get("PRO", 0)),
            "CON": int(self.audience_votes.get("CON", 0)),
        }
        if self.mode == "HUMAN_VS_AI" and self.human_side is None:
            self.human_side = "PRO"
        if self.mode == "AI_VS_AI":
            self.human_side = None
        return self

    def recompute_totals(self) -> None:
        """Recalculate side totals as average final score by debater."""

        pro_scores = [score.final_score for score in self.scores if score.debater == "PRO"]
        con_scores = [score.final_score for score in self.scores if score.debater == "CON"]
        self.pro_total_score = clamp_score(sum(pro_scores) / len(pro_scores)) if pro_scores else 0.0
        self.con_total_score = clamp_score(sum(con_scores) / len(con_scores)) if con_scores else 0.0

    def declare_winner(self) -> None:
        """Set the winner field from current totals."""

        if abs(self.pro_total_score - self.con_total_score) < 0.01:
            self.winner = "TIE"
        elif self.pro_total_score > self.con_total_score:
            self.winner = "PRO"
        else:
            self.winner = "CON"


class DebateCreateRequest(DebateConfig):
    """Request body for creating a debate."""


class DebateCreateResponse(BaseModel):
    """Response after a debate is created."""

    debate_id: str
    websocket_url: str
    status: DebateStatus


class DebateStartResponse(BaseModel):
    """Response after a debate starts."""

    debate_id: str
    status: DebateStatus
    message: str


class VoteRequest(BaseModel):
    """Audience vote request."""

    model_config = ConfigDict(extra="forbid")

    vote: DebaterSide
    argument_id: str | None = None


class HumanArgumentRequest(BaseModel):
    """Manual human argument submitted during Human vs AI debates."""

    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=10, max_length=4_000)

    @field_validator("text")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return " ".join(value.strip().split())


class HumanArgumentResponse(BaseModel):
    """Acknowledgement after a human argument is queued for judging."""

    debate_id: str
    argument_id: str
    status: DebateStatus
    message: str


class ScoresResponse(BaseModel):
    """Aggregate score response for the frontend."""

    pro_total: float
    con_total: float
    round_scores: list[ArgumentScore]
    dimension_breakdown: dict[DebaterSide, dict[str, float]]
