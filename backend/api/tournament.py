"""REST endpoints for tournament brackets."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from tournament.engine import create_tournament
from tournament.models import TournamentCreateRequest, TournamentState

router = APIRouter()


class TournamentStore:
    """Simple process-local tournament store for the first bracket phase."""

    def __init__(self) -> None:
        self._memory: dict[str, TournamentState] = {}

    async def save(self, state: TournamentState) -> None:
        self._memory[state.tournament_id] = state

    async def get(self, tournament_id: str) -> TournamentState | None:
        return self._memory.get(tournament_id)


tournament_store = TournamentStore()


@router.post("/create", response_model=TournamentState, status_code=status.HTTP_201_CREATED)
async def create_tournament_endpoint(payload: TournamentCreateRequest) -> TournamentState:
    state = create_tournament(payload.topics)
    await tournament_store.save(state)
    return state


@router.get("/{tournament_id}", response_model=TournamentState)
async def get_tournament(tournament_id: str) -> TournamentState:
    state = await tournament_store.get(tournament_id)
    if state is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found.")
    return state
