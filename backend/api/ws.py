"""FastAPI WebSocket handler for live debate updates."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.debate import debate_store
from graph.debate_graph import DebateEvent, DebateGraphRunner
from scoring.models import DebateState

router = APIRouter()


class ConnectionManager:
    """Tracks active WebSocket clients per debate session."""

    def __init__(self) -> None:
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, debate_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(debate_id, []).append(websocket)

    def disconnect(self, debate_id: str, websocket: WebSocket) -> None:
        sockets = self._connections.get(debate_id, [])
        if websocket in sockets:
            sockets.remove(websocket)
        if not sockets:
            self._connections.pop(debate_id, None)

    async def broadcast(self, debate_id: str, message: dict[str, Any]) -> None:
        stale: list[WebSocket] = []
        for websocket in list(self._connections.get(debate_id, [])):
            try:
                await websocket.send_json(message)
            except Exception:
                stale.append(websocket)
        for websocket in stale:
            self.disconnect(debate_id, websocket)


class DebateRuntimeManager:
    """Owns one background debate task per active debate id."""

    def __init__(self, connections: ConnectionManager) -> None:
        self.connections = connections
        self._tasks: dict[str, asyncio.Task[None]] = {}

    async def start_debate(self, debate_id: str) -> None:
        task = self._tasks.get(debate_id)
        if task is not None and not task.done():
            return
        state = await debate_store.get(debate_id)
        if state is None or state.status == "DEBATE_ENDED":
            return
        self._tasks[debate_id] = asyncio.create_task(self._run(debate_id, state))

    async def _run(self, debate_id: str, state: DebateState) -> None:
        async def emit(event: DebateEvent, updated_state: DebateState) -> None:
            await debate_store.save(updated_state)
            await self.connections.broadcast(updated_state.debate_id, event)

        try:
            runner = DebateGraphRunner(state=state, on_event=emit)
            final_state = await runner.run()
            await debate_store.save(final_state)
        finally:
            self._tasks.pop(debate_id, None)


connection_manager = ConnectionManager()
runtime_manager = DebateRuntimeManager(connection_manager)


@router.websocket("/ws/debate/{debate_id}")
async def debate_websocket(websocket: WebSocket, debate_id: str) -> None:
    """Connect to a live debate, replay state, and stream future events."""

    state = await debate_store.get(debate_id)
    if state is None:
        await websocket.accept()
        await websocket.send_json(
            {"type": "ERROR", "payload": {"message": "Debate not found.", "code": "DEBATE_NOT_FOUND"}}
        )
        await websocket.close(code=4404)
        return

    await connection_manager.connect(debate_id, websocket)
    try:
        await _replay_state(websocket, state)
        while True:
            message = await websocket.receive_text()
            if message.lower() == "ping":
                await websocket.send_json({"type": "PONG", "payload": {"debate_id": debate_id}})
    except WebSocketDisconnect:
        connection_manager.disconnect(debate_id, websocket)
    except Exception as exc:
        await websocket.send_json({"type": "ERROR", "payload": {"message": str(exc), "code": "WS_ERROR"}})
        connection_manager.disconnect(debate_id, websocket)


async def _replay_state(websocket: WebSocket, state: DebateState) -> None:
    await websocket.send_json(
        {"type": "STATE_CHANGE", "payload": {"new_state": state.status, "round": state.current_round}}
    )
    for argument in state.arguments:
        await websocket.send_json(
            {
                "type": "ARGUMENT",
                "payload": {
                    "argument_id": argument.argument_id,
                    "debater": argument.debater,
                    "text": argument.text,
                    "round": argument.round_number,
                    "timestamp": argument.timestamp.isoformat(),
                    "flags": argument.flags,
                },
            }
        )
    for score in state.scores:
        await websocket.send_json(
            {
                "type": "SCORE_UPDATE",
                "payload": {
                    "argument_id": score.argument_id,
                    "scores": score.model_dump(mode="json"),
                    "pro_total": state.pro_total_score,
                    "con_total": state.con_total_score,
                },
            }
        )
    if state.status == "DEBATE_ENDED":
        await websocket.send_json(
            {
                "type": "DEBATE_ENDED",
                "payload": {
                    "winner": state.winner,
                    "pro_final_score": state.pro_total_score,
                    "con_final_score": state.con_total_score,
                    "summary": state.summary,
                    "audience_votes": {
                        "pro": state.audience_votes["PRO"],
                        "con": state.audience_votes["CON"],
                    },
                },
            }
        )
