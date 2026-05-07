"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


def _get_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        return int(raw_value)
    except ValueError:
        return default


def _get_list(name: str, default: list[str]) -> list[str]:
    raw_value = os.getenv(name)
    if not raw_value:
        return default
    return [item.strip() for item in raw_value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    """Typed view over runtime configuration."""

    anthropic_api_key: str | None
    openai_api_key: str | None
    redis_url: str
    debate_max_rounds: int
    debate_timeout_seconds: int
    argument_max_words: int
    log_level: str
    cors_origins: list[str]
    pro_model: str
    con_model: str
    judge_model: str


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings so modules share one stable config object."""

    return Settings(
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY") or None,
        openai_api_key=os.getenv("OPENAI_API_KEY") or None,
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379"),
        debate_max_rounds=_get_int("DEBATE_MAX_ROUNDS", 5),
        debate_timeout_seconds=_get_int("DEBATE_TIMEOUT_SECONDS", 300),
        argument_max_words=_get_int("ARGUMENT_MAX_WORDS", 150),
        log_level=os.getenv("LOG_LEVEL", "INFO"),
        cors_origins=_get_list("CORS_ORIGINS", ["http://localhost:3000"]),
        pro_model=os.getenv("PRO_MODEL", "claude-sonnet-4-20250514"),
        con_model=os.getenv("CON_MODEL", "claude-sonnet-4-20250514"),
        judge_model=os.getenv("JUDGE_MODEL", "claude-sonnet-4-20250514"),
    )


SETTINGS = get_settings()
