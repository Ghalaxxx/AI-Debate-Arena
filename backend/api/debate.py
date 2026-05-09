"""REST endpoints and Redis-backed debate state storage."""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status

from config import SETTINGS
from scoring.engine import build_dimension_breakdown
from scoring.models import (
    DebateCreateRequest,
    DebateCreateResponse,
    DebateStartResponse,
    DebateState,
    HumanArgumentRequest,
    HumanArgumentResponse,
    ScoresResponse,
    VoteRequest,
    new_uuid,
)

router = APIRouter()


class DebateStateStore:
    """Persist debate state in Redis, with an in-memory fallback for local demos."""

    def __init__(self, redis_url: str) -> None:
        self.redis_url = redis_url
        self._redis: Any | None = None
        self._redis_failed = False
        self._memory: dict[str, str] = {}

    async def save(self, state: DebateState) -> None:
        payload = state.model_dump_json()
        client = await self._client()
        if client is None:
            self._memory[state.debate_id] = payload
            return
        await client.set(self._key(state.debate_id), payload)

    async def get(self, debate_id: str) -> DebateState | None:
        client = await self._client()
        raw_value: bytes | str | None
        if client is None:
            raw_value = self._memory.get(debate_id)
        else:
            raw_value = await client.get(self._key(debate_id))
        if raw_value is None:
            return None
        if isinstance(raw_value, bytes):
            raw_value = raw_value.decode("utf-8")
        return DebateState.model_validate_json(raw_value)

    async def delete(self, debate_id: str) -> None:
        client = await self._client()
        if client is None:
            self._memory.pop(debate_id, None)
            return
        await client.delete(self._key(debate_id))

    async def _client(self) -> Any | None:
        if self._redis_failed:
            return None
        if self._redis is not None:
            return self._redis
        try:
            from redis.asyncio import Redis

            self._redis = Redis.from_url(self.redis_url, decode_responses=False)
            await self._redis.ping()
            return self._redis
        except Exception:
            self._redis = None
            self._redis_failed = True
            return None

    def _key(self, debate_id: str) -> str:
        return f"debate:{debate_id}"


debate_store = DebateStateStore(SETTINGS.redis_url)


def _websocket_url(request: Request, debate_id: str) -> str:
    scheme = "wss" if request.url.scheme == "https" else "ws"
    return f"{scheme}://{request.url.netloc}/ws/debate/{debate_id}"


@router.post("/create", response_model=DebateCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_debate(payload: DebateCreateRequest, request: Request) -> DebateCreateResponse:
    """Create a debate in WAITING state."""

    debate_id = new_uuid()
    state = DebateState(
        debate_id=debate_id,
        topic=payload.topic,
        max_rounds=payload.max_rounds,
        pro_model=payload.pro_model,
        con_model=payload.con_model,
        judge_model=payload.judge_model,
        mode=payload.mode,
        human_side=payload.human_side,
        status="WAITING",
    )
    await debate_store.save(state)
    return DebateCreateResponse(
        debate_id=debate_id,
        websocket_url=_websocket_url(request, debate_id),
        status=state.status,
    )


@router.post("/{debate_id}/start", response_model=DebateStartResponse)
async def start_debate(debate_id: str) -> DebateStartResponse:
    """Start the debate loop in the background."""

    state = await debate_store.get(debate_id)
    if state is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Debate not found.")
    if state.status == "DEBATE_ENDED":
        return DebateStartResponse(debate_id=debate_id, status=state.status, message="Debate already ended")

    state.is_active = True
    state.status = "PRO_TURN"
    state.turn = "PRO"
    await debate_store.save(state)

    from api.ws import connection_manager, runtime_manager

    await connection_manager.broadcast(
        debate_id,
        {
            "type": "STATE_CHANGE",
            "payload": {"new_state": state.status, "round": state.current_round, "turn": state.turn},
        },
    )
    if state.mode == "AI_VS_AI" or state.human_side != state.turn:
        await runtime_manager.start_debate(debate_id)
    return DebateStartResponse(debate_id=debate_id, status=state.status, message="Debate started")


@router.post("/{debate_id}/argument", response_model=HumanArgumentResponse, status_code=status.HTTP_202_ACCEPTED)
async def submit_human_argument(debate_id: str, payload: HumanArgumentRequest) -> HumanArgumentResponse:
    """Submit a manual human argument during Human vs AI mode."""

    state = await debate_store.get(debate_id)
    if state is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Debate not found.")
    if state.mode != "HUMAN_VS_AI":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debate is not in Human vs AI mode.")
    if state.status == "DEBATE_ENDED":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Debate already ended.")
    if not state.is_active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Debate has not started.")
    if state.human_side != state.turn:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="It is not the human debater's turn.")

    from api.ws import runtime_manager

    argument_id = await runtime_manager.submit_human_argument(debate_id, payload.text)
    updated_state = await debate_store.get(debate_id)
    return HumanArgumentResponse(
        debate_id=debate_id,
        argument_id=argument_id,
        status=updated_state.status if updated_state else state.status,
        message="Human argument accepted for judging.",
    )


@router.get("/{debate_id}/state", response_model=DebateState)
async def get_debate_state(debate_id: str) -> DebateState:
    """Return the full debate state object."""

    state = await debate_store.get(debate_id)
    if state is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Debate not found.")
    return state


@router.post("/{debate_id}/vote")
async def vote(debate_id: str, payload: VoteRequest) -> dict[str, Any]:
    """Record an audience vote for one side."""

    state = await debate_store.get(debate_id)
    if state is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Debate not found.")
    state.audience_votes[payload.vote] += 1
    await debate_store.save(state)

    from api.ws import connection_manager

    await connection_manager.broadcast(
        debate_id,
        {
            "type": "STATE_CHANGE",
            "payload": {"new_state": state.status, "round": state.current_round, "turn": state.turn},
        },
    )
    return {
        "debate_id": debate_id,
        "vote": payload.vote,
        "argument_id": payload.argument_id,
        "audience_votes": state.audience_votes,
    }


@router.get("/{debate_id}/scores", response_model=ScoresResponse)
async def get_scores(debate_id: str) -> ScoresResponse:
    """Return score totals and radar-chart dimension breakdowns."""

    state = await debate_store.get(debate_id)
    if state is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Debate not found.")
    state.recompute_totals()
    return ScoresResponse(
        pro_total=state.pro_total_score,
        con_total=state.con_total_score,
        round_scores=state.scores,
        dimension_breakdown=build_dimension_breakdown(state.scores),
    )


def state_to_json(state: DebateState) -> dict[str, Any]:
    """Small helper for tests and diagnostic output."""

    return json.loads(state.model_dump_json())
