"""Moderator agent for flow control and debate summaries."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from config import SETTINGS
from scoring.metrics import calculate_relevance
from scoring.models import Argument, DebateState

MODERATOR_SYSTEM_PROMPT = """You are a debate moderator ensuring fair and productive debate.

TOPIC: {topic}
ROUND: {current_round} of {max_rounds}
LATEST ARGUMENT:
---
{latest_argument}
---

Tasks:
1. Check if argument is on-topic (return is_on_topic: bool)
2. Check if debate should continue (return should_continue: bool)
   - Stop early if: 3+ consecutive off-topic arguments, same points repeated 3x
3. If this is the final round, generate a summary of the debate

Return ONLY valid JSON:
{{
  "is_on_topic": true,
  "should_continue": true,
  "flag_reason": null,
  "summary": null
}}"""


@dataclass(frozen=True, slots=True)
class ModerationDecision:
    """Structured moderation result."""

    is_on_topic: bool
    should_continue: bool
    flag_reason: str | None
    summary: str | None


def _extract_json(raw_text: str) -> dict[str, Any]:
    try:
        parsed = json.loads(raw_text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", raw_text, re.DOTALL)
    if not match:
        raise ValueError("Moderator response did not contain JSON.")
    parsed = json.loads(match.group(0))
    if not isinstance(parsed, dict):
        raise ValueError("Moderator JSON root must be an object.")
    return parsed


@dataclass(slots=True)
class ModeratorAgent:
    """Controls turn order, topic adherence, and debate-ending decisions."""

    model: str = SETTINGS.judge_model

    async def moderate(self, state: DebateState, latest_argument: Argument) -> ModerationDecision:
        """Validate the latest argument and decide whether debate continues."""

        language_note = (
            "\nThe debate language is Arabic. Read Arabic arguments normally, but return JSON keys in English."
            if state.language == "ar"
            else "\nThe debate language is English."
        )
        prompt = MODERATOR_SYSTEM_PROMPT.format(
            topic=state.topic,
            current_round=state.current_round,
            max_rounds=state.max_rounds,
            latest_argument=latest_argument.text,
        ) + language_note
        if self.model != "local-fallback" and SETTINGS.anthropic_api_key:
            try:
                return self._decision_from_payload(await self._call_anthropic(prompt))
            except Exception:
                pass
        return self._fallback_decision(state, latest_argument)

    async def final_summary(self, state: DebateState) -> str:
        """Generate a final debate summary."""

        if state.summary:
            return state.summary
        pro_best = self._best_argument_text(state, "PRO")
        con_best = self._best_argument_text(state, "CON")
        return (
            f"The debate on '{state.topic}' ended with PRO averaging {state.pro_total_score:.2f} "
            f"and CON averaging {state.con_total_score:.2f}. PRO's strongest line was: {pro_best} "
            f"CON's strongest response was: {con_best} The final winner is {state.winner or 'undecided'}."
        )

    async def _call_anthropic(self, prompt: str) -> dict[str, Any]:
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=SETTINGS.anthropic_api_key)
        response: Any = await client.messages.create(
            model=self.model,
            max_tokens=400,
            temperature=0.1,
            system=prompt,
            messages=[{"role": "user", "content": "Moderate this turn now."}],
        )
        text_parts = [
            block.text for block in response.content if getattr(block, "type", "") == "text" and block.text
        ]
        return _extract_json(" ".join(text_parts))

    def _decision_from_payload(self, payload: dict[str, Any]) -> ModerationDecision:
        return ModerationDecision(
            is_on_topic=bool(payload.get("is_on_topic", True)),
            should_continue=bool(payload.get("should_continue", True)),
            flag_reason=payload.get("flag_reason"),
            summary=payload.get("summary"),
        )

    def _fallback_decision(self, state: DebateState, latest_argument: Argument) -> ModerationDecision:
        relevance = calculate_relevance(state.topic, latest_argument.text)
        is_on_topic = relevance.score >= 0.25
        recent_off_topic = [
            argument
            for argument in state.arguments[-3:]
            if "off_topic" in argument.flags or (argument.argument_id == latest_argument.argument_id and not is_on_topic)
        ]
        should_continue = len(recent_off_topic) < 3 and state.current_round <= state.max_rounds
        summary = None
        if state.current_round >= state.max_rounds and latest_argument.debater == "CON":
            summary = "Final round completed; the judge will declare the winner from average argument scores."
        return ModerationDecision(
            is_on_topic=is_on_topic,
            should_continue=should_continue,
            flag_reason=None if is_on_topic else "Argument drifted away from the debate topic.",
            summary=summary,
        )

    def _best_argument_text(self, state: DebateState, side: str) -> str:
        side_scores = [score for score in state.scores if score.debater == side]
        if not side_scores:
            return "No scored argument."
        best_score = max(side_scores, key=lambda score: score.final_score)
        for argument in state.arguments:
            if argument.argument_id == best_score.argument_id:
                return argument.text
        return "No argument text found."
