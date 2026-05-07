"""LangGraph state machine and executable debate runner."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any, TypedDict

from agents.debater import ConDebater, ProDebater
from agents.judge import JudgeAgent
from agents.moderator import ModeratorAgent
from config import SETTINGS
from scoring.models import Argument, DebaterSide, DebateState, DebateStatus

AGENT_CALL_TIMEOUT_SECONDS = min(30, SETTINGS.debate_timeout_seconds)


class DebateGraphSnapshot(TypedDict, total=False):
    """Serializable snapshot used by LangGraph transition definitions."""

    debate_id: str
    topic: str
    current_round: int
    max_rounds: int
    turn: DebaterSide
    status: str
    last_debater: DebaterSide
    should_continue: bool


class DebateEvent(TypedDict):
    """Message emitted to WebSocket clients."""

    type: str
    payload: dict[str, Any]


EventCallback = Callable[[DebateEvent, DebateState], Awaitable[None]]


def build_debate_graph() -> Any:
    """Build the requested LangGraph state machine.

    The compiled graph describes legal transitions. The `DebateGraphRunner`
    below performs the side-effectful LLM calls, state persistence, and
    WebSocket emission around the same transition model.
    """

    from langgraph.graph import END, StateGraph

    def mark(status: str) -> Callable[[DebateGraphSnapshot], DebateGraphSnapshot]:
        def _node(snapshot: DebateGraphSnapshot) -> DebateGraphSnapshot:
            return {**snapshot, "status": status}

        return _node

    def after_moderating(snapshot: DebateGraphSnapshot) -> str:
        if not snapshot.get("should_continue", True):
            return "DEBATE_ENDED"
        if snapshot.get("last_debater") == "PRO":
            return "CON_TURN"
        if snapshot.get("current_round", 1) >= snapshot.get("max_rounds", 5):
            return "ROUND_COMPLETE"
        return "ROUND_COMPLETE"

    def after_round(snapshot: DebateGraphSnapshot) -> str:
        if snapshot.get("current_round", 1) >= snapshot.get("max_rounds", 5):
            return "DEBATE_ENDED"
        return "PRO_TURN"

    graph = StateGraph(DebateGraphSnapshot)
    for status in (
        "WAITING",
        "PRO_TURN",
        "CON_TURN",
        "JUDGING",
        "MODERATING",
        "ROUND_COMPLETE",
        "DEBATE_ENDED",
        "ERROR",
    ):
        graph.add_node(status, mark(status))

    graph.set_entry_point("WAITING")
    graph.add_edge("WAITING", "PRO_TURN")
    graph.add_edge("PRO_TURN", "JUDGING")
    graph.add_edge("CON_TURN", "JUDGING")
    graph.add_edge("JUDGING", "MODERATING")
    graph.add_conditional_edges(
        "MODERATING",
        after_moderating,
        {
            "CON_TURN": "CON_TURN",
            "ROUND_COMPLETE": "ROUND_COMPLETE",
            "DEBATE_ENDED": "DEBATE_ENDED",
        },
    )
    graph.add_conditional_edges(
        "ROUND_COMPLETE",
        after_round,
        {"PRO_TURN": "PRO_TURN", "DEBATE_ENDED": "DEBATE_ENDED"},
    )
    graph.add_edge("DEBATE_ENDED", END)
    graph.add_edge("ERROR", END)
    return graph.compile()


class DebateGraphRunner:
    """Executable debate loop used by REST start and WebSocket broadcasts."""

    def __init__(self, state: DebateState, on_event: EventCallback) -> None:
        self.state = state
        self.on_event = on_event
        self.pro_debater = ProDebater(model=state.pro_model)
        self.con_debater = ConDebater(model=state.con_model)
        self.judge = JudgeAgent(model=state.judge_model)
        self.moderator = ModeratorAgent(model=state.judge_model)

    async def run(self) -> DebateState:
        """Run a debate until all rounds complete, moderation stops, or an error occurs."""

        self.state.is_active = True
        try:
            while self.state.current_round <= self.state.max_rounds and self.state.is_active:
                should_continue = await self._run_turn("PRO")
                if not should_continue:
                    break

                should_continue = await self._run_turn("CON")
                await self._emit_state("ROUND_COMPLETE")
                if not should_continue or self.state.current_round >= self.state.max_rounds:
                    break

                self.state.current_round += 1

            await self._end_debate()
        except Exception as exc:
            self.state.status = "ERROR"
            self.state.is_active = False
            await self.on_event(
                {"type": "ERROR", "payload": {"message": str(exc), "code": "DEBATE_RUNTIME_ERROR"}},
                self.state,
            )
        return self.state

    async def _run_turn(self, side: DebaterSide) -> bool:
        self.state.turn = side
        await self._emit_state("PRO_TURN" if side == "PRO" else "CON_TURN")

        argument_text = await asyncio.wait_for(
            self._debater_for_side(side).generate_argument(
                topic=self.state.topic,
                pro_history=[argument for argument in self.state.arguments if argument.debater == "PRO"],
                con_history=[argument for argument in self.state.arguments if argument.debater == "CON"],
                latest_opponent_argument=self._latest_opponent_argument(side),
                round_number=self.state.current_round,
            ),
            timeout=AGENT_CALL_TIMEOUT_SECONDS,
        )
        argument = Argument(
            debate_id=self.state.debate_id,
            debater=side,
            text=argument_text,
            round_number=self.state.current_round,
        )
        self.state.arguments.append(argument)
        await self.on_event({"type": "ARGUMENT", "payload": self._argument_payload(argument)}, self.state)

        await self._emit_state("JUDGING")
        score = await asyncio.wait_for(
            self.judge.score_argument(argument, self.state),
            timeout=AGENT_CALL_TIMEOUT_SECONDS,
        )
        argument.flags = sorted(set(argument.flags) | set(score.flags))
        self.state.scores.append(score)
        self.state.recompute_totals()
        await self.on_event(
            {
                "type": "SCORE_UPDATE",
                "payload": {
                    "argument_id": argument.argument_id,
                    "scores": score.model_dump(mode="json"),
                    "pro_total": self.state.pro_total_score,
                    "con_total": self.state.con_total_score,
                },
            },
            self.state,
        )

        await self._emit_state("MODERATING")
        decision = await asyncio.wait_for(
            self.moderator.moderate(self.state, argument),
            timeout=AGENT_CALL_TIMEOUT_SECONDS,
        )
        if not decision.is_on_topic:
            argument.flags = sorted(set(argument.flags) | {"off_topic"})
            score.flags = sorted(set(score.flags) | {"off_topic"})
        if decision.summary:
            self.state.summary = decision.summary
        return decision.should_continue

    async def _emit_state(self, status: DebateStatus) -> None:
        self.state.status = status
        await self.on_event(
            {
                "type": "STATE_CHANGE",
                "payload": {"new_state": status, "round": self.state.current_round},
            },
            self.state,
        )

    async def _end_debate(self) -> None:
        self.state.is_active = False
        self.state.recompute_totals()
        self.state.declare_winner()
        if not self.state.summary:
            self.state.summary = await self.moderator.final_summary(self.state)
        self.state.status = "DEBATE_ENDED"
        await self.on_event(
            {
                "type": "DEBATE_ENDED",
                "payload": {
                    "winner": self.state.winner,
                    "pro_final_score": self.state.pro_total_score,
                    "con_final_score": self.state.con_total_score,
                    "summary": self.state.summary,
                    "audience_votes": {
                        "pro": self.state.audience_votes["PRO"],
                        "con": self.state.audience_votes["CON"],
                    },
                },
            },
            self.state,
        )

    def _debater_for_side(self, side: DebaterSide) -> ProDebater | ConDebater:
        return self.pro_debater if side == "PRO" else self.con_debater

    def _latest_opponent_argument(self, side: DebaterSide) -> Argument | None:
        opponent: DebaterSide = "CON" if side == "PRO" else "PRO"
        candidates = [argument for argument in self.state.arguments if argument.debater == opponent]
        return candidates[-1] if candidates else None

    def _argument_payload(self, argument: Argument) -> dict[str, Any]:
        return {
            "argument_id": argument.argument_id,
            "debater": argument.debater,
            "text": argument.text,
            "round": argument.round_number,
            "timestamp": argument.timestamp.isoformat(),
            "flags": argument.flags,
        }


async def run_terminal_demo(topic: str = "We should subsidize renewable energy", rounds: int = 2) -> DebateState:
    """Run a complete debate in the terminal without API or WebSocket clients."""

    async def print_event(event: DebateEvent, _: DebateState) -> None:
        print(f"{event['type']}: {event['payload']}")

    state = DebateState(topic=topic, max_rounds=rounds)
    runner = DebateGraphRunner(state=state, on_event=print_event)
    return await runner.run()
