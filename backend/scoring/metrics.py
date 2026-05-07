"""Individual argument-quality metric calculators."""

from __future__ import annotations

import math
import os
import re
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any, Sequence

import numpy as np

from scoring.models import clamp_score


@dataclass(frozen=True)
class MetricResult:
    """Metric score with a short explanation and optional judge flags."""

    score: float
    reason: str
    flags: list[str] = field(default_factory=list)


EVIDENCE_MARKERS = re.compile(
    r"\b(according to|research|study|studies show|data|survey|report|published|"
    r"peer-reviewed|evidence|statistics|analysis|cited by)\b",
    re.IGNORECASE,
)
STATISTICAL_CLAIM = re.compile(
    r"\b(\d+(?:\.\d+)?\s?%|\d+(?:,\d{3})+|\d+\s?(?:million|billion|trillion)|"
    r"one in \d+|\d+ out of \d+)\b",
    re.IGNORECASE,
)
EXPERT_REFERENCE = re.compile(
    r"\b(experts?|researchers?|scientists?|economists?|doctors?|professors?|"
    r"policy analysts?|court|government agency|university)\b",
    re.IGNORECASE,
)
ANECDOTAL_MARKER = re.compile(
    r"\b(for example|for instance|case study|in one case|personal experience|"
    r"historically|real-world example)\b",
    re.IGNORECASE,
)
YEAR_OR_SOURCE = re.compile(
    r"\b(19|20)\d{2}\b|\b(WHO|UN|OECD|Pew|CDC|NIH|World Bank|Nature|Science|"
    r"Supreme Court|United Nations)\b",
    re.IGNORECASE,
)
REFUTATION_MARKERS = re.compile(
    r"\b(however|but|yet|although|while|fails to|ignores|overlooks|misstates|"
    r"the flaw|this assumes|in contrast|rather than|counter)\b",
    re.IGNORECASE,
)
RHETORICAL_MARKERS = re.compile(
    r"\?|like|as if|imagine|must|should|cannot|clear|urgent|risk|benefit|"
    r"protect|freedom|fairness|justice",
    re.IGNORECASE,
)
CONTRADICTION_MARKERS = (
    ("always", "never"),
    ("must", "must not"),
    ("safe", "dangerous"),
    ("legal", "illegal"),
)


@lru_cache(maxsize=1)
def _spacy_nlp() -> Any | None:
    try:
        import spacy

        nlp = spacy.blank("en")
        nlp.add_pipe("sentencizer")
        return nlp
    except Exception:
        return None


@lru_cache(maxsize=1)
def _embedding_model() -> Any | None:
    """Load MiniLM only when it is already available locally.

    Local-only loading avoids surprising multi-hundred-megabyte downloads during
    quick demos while still supporting the requested sentence-transformers path
    in production containers that pre-cache models.
    """

    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
    except Exception:
        return None


@lru_cache(maxsize=1)
def _nli_model() -> Any | None:
    try:
        from sentence_transformers import CrossEncoder

        return CrossEncoder("sentence-transformers/nli-roberta-base", local_files_only=True)
    except Exception:
        return None


def split_sentences(text: str) -> list[str]:
    """Split text into sentences using spaCy when available, else regex."""

    nlp = _spacy_nlp()
    if nlp is not None:
        doc = nlp(text)
        sentences = [sentence.text.strip() for sentence in doc.sents if sentence.text.strip()]
        if sentences:
            return sentences
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]


def extract_main_claim(argument: str) -> str:
    """Use the final or strongest modal sentence as the argument claim."""

    sentences = split_sentences(argument)
    if not sentences:
        return argument.strip()
    modal_sentences = [
        sentence for sentence in sentences if re.search(r"\b(should|must|therefore|thus|so)\b", sentence, re.I)
    ]
    return modal_sentences[-1] if modal_sentences else sentences[-1]


def extract_supporting_premises(argument: str, claim: str) -> list[str]:
    """Return candidate premises that should support the main claim."""

    sentences = [sentence for sentence in split_sentences(argument) if sentence != claim]
    premise_sentences = [
        sentence
        for sentence in sentences
        if re.search(r"\b(because|since|as|given|when|if|data|evidence|research|for example)\b", sentence, re.I)
    ]
    return premise_sentences or sentences[:3] or [argument]


def _normalize_token(token: str) -> str:
    lowered = token.lower()
    if lowered.endswith("ies") and len(lowered) > 4:
        return f"{lowered[:-3]}y"
    for suffix in ("ing", "ed", "s"):
        if lowered.endswith(suffix) and len(lowered) > len(suffix) + 3:
            return lowered[: -len(suffix)]
    return lowered


def lexical_similarity(left: str, right: str) -> float:
    """Small fallback similarity measure when embedding models are unavailable."""

    left_tokens = {_normalize_token(token) for token in re.findall(r"[a-zA-Z]{3,}", left)}
    right_tokens = {_normalize_token(token) for token in re.findall(r"[a-zA-Z]{3,}", right)}
    if not left_tokens or not right_tokens:
        return 0.0
    overlap = len(left_tokens & right_tokens)
    union = len(left_tokens | right_tokens)
    jaccard = overlap / union
    short_text_coverage = overlap / min(len(left_tokens), len(right_tokens))
    return max(jaccard, short_text_coverage * 0.75)


def cosine_similarity(left: Sequence[float], right: Sequence[float]) -> float:
    """Compute cosine similarity in a numerically stable way."""

    left_vector = np.asarray(left, dtype=float)
    right_vector = np.asarray(right, dtype=float)
    denominator = float(np.linalg.norm(left_vector) * np.linalg.norm(right_vector))
    if math.isclose(denominator, 0.0):
        return 0.0
    return clamp_score((float(np.dot(left_vector, right_vector)) / denominator + 1.0) / 2.0)


def semantic_similarity(left: str, right: str) -> float:
    """Embed two texts and return normalized cosine similarity."""

    if not left.strip() or not right.strip():
        return 0.0
    model = _embedding_model()
    if model is None:
        return clamp_score(lexical_similarity(left, right) * 1.25)
    vectors = model.encode([left, right], convert_to_numpy=True)
    return cosine_similarity(vectors[0], vectors[1])


def _entailment_probability(premise: str, claim: str) -> float:
    model = _nli_model()
    if model is None:
        return clamp_score(0.35 + semantic_similarity(premise, claim) * 0.65)
    raw_scores = np.asarray(model.predict([(premise, claim)]), dtype=float)[0]
    if raw_scores.size == 1:
        return clamp_score(1.0 / (1.0 + math.exp(-float(raw_scores[0]))))
    probabilities = np.exp(raw_scores) / np.exp(raw_scores).sum()
    return clamp_score(float(probabilities[-1]))


def detect_circular_reasoning(argument: str, claim: str, premises: list[str]) -> bool:
    """Flag arguments where the premise mostly restates the claim."""

    return any(semantic_similarity(premise, claim) > 0.86 for premise in premises if premise != claim)


def detect_internal_contradiction(argument: str) -> bool:
    """Catch obvious contradictory marker pairs inside one argument."""

    lowered = argument.lower()
    return any(
        re.search(rf"\b{re.escape(first)}\b", lowered)
        and re.search(rf"\b{re.escape(second)}\b", lowered)
        for first, second in CONTRADICTION_MARKERS
    )


def calculate_logical_coherence(argument: str) -> MetricResult:
    """Score whether extracted premises entail the main claim."""

    claim = extract_main_claim(argument)
    premises = extract_supporting_premises(argument, claim)
    entailment_scores = [_entailment_probability(premise, claim) for premise in premises]
    score = sum(entailment_scores) / len(entailment_scores)
    flags: list[str] = []
    if detect_circular_reasoning(argument, claim, premises):
        score -= 0.2
        flags.append("circular_reasoning")
    if detect_internal_contradiction(argument):
        score -= 0.15
        flags.append("internal_contradiction")
    return MetricResult(
        score=clamp_score(score),
        reason=f"Premise-to-claim support averaged {clamp_score(sum(entailment_scores) / len(entailment_scores))}.",
        flags=flags,
    )


def calculate_evidence_quality(argument: str) -> MetricResult:
    """Score citation, statistics, expert, and anecdotal evidence signals."""

    verified = min(len(EVIDENCE_MARKERS.findall(argument)), 3)
    statistical = min(len(STATISTICAL_CLAIM.findall(argument)), 3)
    expert = min(len(EXPERT_REFERENCE.findall(argument)), 3)
    anecdotal = min(len(ANECDOTAL_MARKER.findall(argument)), 3)
    weighted = verified * 0.4 + statistical * 0.3 + expert * 0.2 + anecdotal * 0.1
    score = weighted / 1.5
    if YEAR_OR_SOURCE.search(argument):
        score += 0.1
    return MetricResult(
        score=clamp_score(score),
        reason=(
            f"Evidence markers: citations={verified}, statistics={statistical}, "
            f"experts={expert}, examples={anecdotal}."
        ),
    )


def calculate_persuasiveness(argument: str) -> MetricResult:
    """Heuristic stand-in for the structured LLM persuasiveness rubric."""

    sentences = split_sentences(argument)
    word_count = len(argument.split())
    clarity = 1.0 if 45 <= word_count <= 160 else 0.65
    rhetoric = min(len(RHETORICAL_MARKERS.findall(argument)) / 6.0, 1.0)
    conclusion = 0.2 if sentences and re.search(r"\b(therefore|so|must|should|cannot|will)\b", sentences[-1], re.I) else 0.0
    score = 0.45 * clarity + 0.4 * rhetoric + conclusion
    return MetricResult(
        score=clamp_score(score),
        reason="Persuasiveness reflects clarity, rhetorical force, and closing strength.",
    )


def calculate_relevance(topic: str, argument: str) -> MetricResult:
    """Score semantic similarity between the topic and current argument."""

    similarity = semantic_similarity(topic, argument)
    flags: list[str] = []
    score = similarity
    if similarity < 0.3:
        score -= 0.3
        flags.append("off_topic")
    return MetricResult(
        score=clamp_score(score),
        reason=f"Topic-argument semantic similarity is {clamp_score(similarity)}.",
        flags=flags,
    )


def calculate_counterargument_strength(previous_opponent_argument: str | None, argument: str) -> MetricResult:
    """Score how directly the current argument answers the last opponent point."""

    if not previous_opponent_argument:
        return MetricResult(score=0.5, reason="No opponent argument exists yet, so counter strength is neutral.")
    similarity = semantic_similarity(previous_opponent_argument, argument)
    marker_bonus = 0.15 if REFUTATION_MARKERS.search(argument) else 0.0
    return MetricResult(
        score=clamp_score(similarity + marker_bonus),
        reason=f"Opponent-response semantic similarity is {clamp_score(similarity)}.",
    )


def calculate_originality(previous_same_side_arguments: list[str], argument: str) -> MetricResult:
    """Score novelty against the same debater's earlier arguments."""

    if not previous_same_side_arguments:
        return MetricResult(score=1.0, reason="First argument for this debater, so originality is maximal.")
    similarities = [semantic_similarity(previous_argument, argument) for previous_argument in previous_same_side_arguments]
    max_similarity = max(similarities)
    return MetricResult(
        score=clamp_score(1.0 - max_similarity),
        reason=f"Most similar prior same-side argument scored {clamp_score(max_similarity)} similarity.",
    )


def model_loading_mode() -> str:
    """Expose model loading behavior for diagnostics and tests."""

    return os.getenv("SENTENCE_TRANSFORMERS_HOME", "local-cache-or-heuristic")
