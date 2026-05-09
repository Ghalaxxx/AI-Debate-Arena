"""Impartial judge agent for structured argument scores."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from config import SETTINGS
from scoring.engine import WEIGHTS, DebateScoringEngine
from scoring.models import Argument, ArgumentScore, DebateState, clamp_score

JUDGE_SYSTEM_PROMPT = """You are an impartial debate judge. Score the following argument across 6 dimensions.

DEBATE TOPIC: {topic}
DEBATER SIDE: {side} (PRO or CON)
ARGUMENT TO JUDGE:
---
{argument_text}
---

PREVIOUS ARGUMENT FROM OPPONENT (for counterargument scoring):
---
{opponent_last_argument}
---

Score each dimension from 0.0 to 1.0. Be rigorous and consistent.

SCORING RUBRIC:
- logical_coherence: Do the premises logically support the conclusion? Any fallacies?
- evidence_quality: Does it cite data, studies, statistics, or credible references?
- persuasiveness: Would a neutral audience find this convincing?
- relevance: Does it stay on-topic to "{topic}"?
- counterargument_strength: How effectively does it address the opponent's last point?
- originality: Does it introduce a new angle not yet used in this debate?

ALSO CHECK FOR FLAGS:
- "circular_reasoning": conclusion restates premise
- "ad_hominem": attacks person not argument
- "straw_man": misrepresents opponent's position
- "false_dichotomy": presents only two options when more exist
- "off_topic": argument is not about the debate topic

Return ONLY valid JSON, no other text:
{{
  "dimensions": {{
    "logical_coherence": 0.0,
    "evidence_quality": 0.0,
    "persuasiveness": 0.0,
    "relevance": 0.0,
    "counterargument_strength": 0.0,
    "originality": 0.0
  }},
  "reasoning": "2-3 sentences explaining the scores",
  "flags": []
}}"""


def _latest_opponent_argument(argument: Argument, state: DebateState) -> Argument | None:
    opponent = "CON" if argument.debater == "PRO" else "PRO"
    candidates = [
        item
        for item in state.arguments
        if item.debater == opponent and item.argument_id != argument.argument_id
    ]
    return candidates[-1] if candidates else None


def _extract_json_object(raw_text: str) -> dict[str, Any]:
    try:
        parsed = json.loads(raw_text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", raw_text, re.DOTALL)
    if not match:
        raise ValueError("Judge response did not contain JSON.")
    parsed = json.loads(match.group(0))
    if not isinstance(parsed, dict):
        raise ValueError("Judge JSON root must be an object.")
    return parsed


@dataclass(slots=True)
class JudgeAgent:
    """Scores arguments using an LLM when available, otherwise local metrics."""

    model: str = SETTINGS.judge_model
    scoring_engine: DebateScoringEngine = DebateScoringEngine()

    async def score_argument(self, argument: Argument, state: DebateState) -> ArgumentScore:
        """Return a strict ArgumentScore for the latest argument."""

        prompt = self._build_prompt(argument, state)
        if self.model != "local-fallback" and (SETTINGS.anthropic_api_key or SETTINGS.openai_api_key):
            for attempt in range(3):
                try:
                    raw_response = await self._call_llm(prompt, force_json=attempt > 0)
                    return self._score_from_payload(argument, raw_response)
                except Exception:
                    continue
        return self.scoring_engine.score_argument(argument, state)

    def _build_prompt(self, argument: Argument, state: DebateState) -> str:
        opponent = _latest_opponent_argument(argument, state)
        return JUDGE_SYSTEM_PROMPT.format(
            topic=state.topic,
            side=argument.debater,
            argument_text=argument.text,
            opponent_last_argument=opponent.text if opponent else "None.",
        )

    async def _call_llm(self, prompt: str, force_json: bool) -> dict[str, Any]:
        if SETTINGS.openai_api_key and self.model.lower().startswith("gpt"):
            return await self._call_openai(prompt, force_json)
        if SETTINGS.anthropic_api_key:
            return await self._call_anthropic(prompt, force_json)
        if SETTINGS.openai_api_key:
            return await self._call_openai(prompt, force_json)
        raise RuntimeError("No judge LLM credentials configured.")

    async def _call_anthropic(self, prompt: str, force_json: bool) -> dict[str, Any]:
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=SETTINGS.anthropic_api_key)
        reminder = "\nReturn ONLY JSON. No prose." if force_json else ""
        response: Any = await client.messages.create(
            model=self.model,
            max_tokens=600,
            temperature=0.1,
            system=prompt + reminder,
            messages=[{"role": "user", "content": "Score this argument now."}],
        )
        text_parts = [
            block.text for block in response.content if getattr(block, "type", "") == "text" and block.text
        ]
        return _extract_json_object(" ".join(text_parts))

    async def _call_openai(self, prompt: str, force_json: bool) -> dict[str, Any]:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=SETTINGS.openai_api_key)
        response_format: dict[str, str] | None = {"type": "json_object"} if force_json else None
        response = await client.chat.completions.create(
            model=self.model,
            temperature=0.1,
            response_format=response_format,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": "Score this argument now and return only JSON."},
            ],
        )
        content = response.choices[0].message.content or "{}"
        return _extract_json_object(content)

    def _score_from_payload(self, argument: Argument, payload: dict[str, Any]) -> ArgumentScore:
        dimensions_payload = payload.get("dimensions", {})
        if not isinstance(dimensions_payload, dict):
            raise ValueError("Judge dimensions must be an object.")
        dimensions = {
            "logical_coherence": clamp_score(float(dimensions_payload.get("logical_coherence", 0.0))),
            "evidence_quality": clamp_score(float(dimensions_payload.get("evidence_quality", 0.0))),
            "persuasiveness": clamp_score(float(dimensions_payload.get("persuasiveness", 0.0))),
            "relevance": clamp_score(float(dimensions_payload.get("relevance", 0.0))),
            "counterargument": clamp_score(
                float(
                    dimensions_payload.get(
                        "counterargument",
                        dimensions_payload.get("counterargument_strength", 0.0),
                    )
                )
            ),
            "originality": clamp_score(float(dimensions_payload.get("originality", 0.0))),
        }
        raw_flags = payload.get("flags", [])
        flags = [str(flag) for flag in raw_flags] if isinstance(raw_flags, list) else []
        final_score = clamp_score(sum(dimensions[dimension] * WEIGHTS[dimension] for dimension in WEIGHTS))
        return ArgumentScore(
            argument_id=argument.argument_id,
            debater=argument.debater,
            round_number=argument.round_number,
            dimensions=dimensions,
            final_score=final_score,
            judge_reasoning=str(payload.get("reasoning", "Judge returned structured scores.")),
            flags=flags,
        )
