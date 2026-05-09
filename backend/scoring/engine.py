"""Weighted argument scoring engine."""

from __future__ import annotations

from scoring.metrics import (
    MetricResult,
    calculate_counterargument_strength,
    calculate_evidence_quality,
    calculate_logical_coherence,
    calculate_originality,
    calculate_persuasiveness,
    calculate_relevance,
)
from scoring.models import Argument, ArgumentScore, DebaterSide, DebateState, clamp_score

WEIGHTS: dict[str, float] = {
    "logical_coherence": 0.25,
    "evidence_quality": 0.20,
    "persuasiveness": 0.20,
    "relevance": 0.15,
    "counterargument": 0.15,
    "originality": 0.05,
}


class DebateScoringEngine:
    """Evaluate an argument across all six requested dimensions."""

    def score_argument(self, argument: Argument, state: DebateState) -> ArgumentScore:
        """Score an argument using debate context from current state."""

        previous_opponent = self._latest_opponent_argument(argument, state)
        same_side_history = self._same_side_history(argument, state)
        metric_results = self._calculate_metrics(
            topic=state.topic,
            text=argument.text,
            previous_opponent_text=previous_opponent.text if previous_opponent else None,
            same_side_history=[item.text for item in same_side_history],
        )
        dimensions = {name: result.score for name, result in metric_results.items()}
        flags = sorted({flag for result in metric_results.values() for flag in result.flags} | set(argument.flags))
        final_score = clamp_score(sum(dimensions[name] * WEIGHTS[name] for name in WEIGHTS))
        reasoning = self._compose_reasoning(metric_results)
        strongest_point, weakest_point, score_explanation = self._explain_score(dimensions)
        return ArgumentScore(
            argument_id=argument.argument_id,
            debater=argument.debater,
            round_number=argument.round_number,
            dimensions=dimensions,
            final_score=final_score,
            judge_reasoning=reasoning,
            strongest_point=strongest_point,
            weakest_point=weakest_point,
            score_explanation=score_explanation,
            flags=flags,
        )

    def score_text(
        self,
        debate_id: str,
        topic: str,
        side: DebaterSide,
        text: str,
        round_number: int = 1,
        previous_arguments: list[Argument] | None = None,
    ) -> ArgumentScore:
        """Convenience helper used by smoke tests and fallback judge logic."""

        argument = Argument(debate_id=debate_id, debater=side, text=text, round_number=round_number)
        state = DebateState(
            debate_id=debate_id,
            topic=topic,
            current_round=round_number,
            max_rounds=max(round_number, 1),
            turn=side,
            arguments=[*(previous_arguments or []), argument],
        )
        return self.score_argument(argument, state)

    def _calculate_metrics(
        self,
        topic: str,
        text: str,
        previous_opponent_text: str | None,
        same_side_history: list[str],
    ) -> dict[str, MetricResult]:
        return {
            "logical_coherence": calculate_logical_coherence(text),
            "evidence_quality": calculate_evidence_quality(text),
            "persuasiveness": calculate_persuasiveness(text),
            "relevance": calculate_relevance(topic, text),
            "counterargument": calculate_counterargument_strength(previous_opponent_text, text),
            "originality": calculate_originality(same_side_history, text),
        }

    def _latest_opponent_argument(self, argument: Argument, state: DebateState) -> Argument | None:
        opponent: DebaterSide = "CON" if argument.debater == "PRO" else "PRO"
        candidates = [
            item
            for item in state.arguments
            if item.debater == opponent and item.argument_id != argument.argument_id
        ]
        return candidates[-1] if candidates else None

    def _same_side_history(self, argument: Argument, state: DebateState) -> list[Argument]:
        return [
            item
            for item in state.arguments
            if item.debater == argument.debater and item.argument_id != argument.argument_id
        ]

    def _compose_reasoning(self, metric_results: dict[str, MetricResult]) -> str:
        coherence = metric_results["logical_coherence"]
        evidence = metric_results["evidence_quality"]
        relevance = metric_results["relevance"]
        return (
            f"Coherence: {coherence.reason} Evidence: {evidence.reason} "
            f"Relevance: {relevance.reason}"
        )

    def _explain_score(self, dimensions: dict[str, float]) -> tuple[str, str, str]:
        labels = {
            "logical_coherence": "logical coherence",
            "evidence_quality": "evidence quality",
            "persuasiveness": "persuasiveness",
            "relevance": "topic relevance",
            "counterargument": "counterargument strength",
            "originality": "originality",
        }
        strongest_key = max(dimensions, key=dimensions.get)
        weakest_key = min(dimensions, key=dimensions.get)
        strongest = f"Strongest dimension was {labels[strongest_key]} at {dimensions[strongest_key]:.2f}."
        weakest = f"Weakest dimension was {labels[weakest_key]} at {dimensions[weakest_key]:.2f}."
        explanation = (
            f"The argument gained points from {labels[strongest_key]} and lost the most ground on "
            f"{labels[weakest_key]}. The final weighted score reflects the configured rubric weights."
        )
        return strongest, weakest, explanation


def build_dimension_breakdown(scores: list[ArgumentScore]) -> dict[DebaterSide, dict[str, float]]:
    """Average score dimensions by side for radar chart display."""

    breakdown: dict[DebaterSide, dict[str, float]] = {
        "PRO": {name: 0.0 for name in WEIGHTS},
        "CON": {name: 0.0 for name in WEIGHTS},
    }
    for side in ("PRO", "CON"):
        side_scores = [score for score in scores if score.debater == side]
        if not side_scores:
            continue
        for dimension in WEIGHTS:
            average = sum(score.dimensions[dimension] for score in side_scores) / len(side_scores)
            breakdown[side][dimension] = clamp_score(average)
    return breakdown
