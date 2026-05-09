"""Conservative toxicity detection for debate arguments."""

from __future__ import annotations

import re

INSULT_PATTERN = re.compile(
    r"\b(idiot|moron|stupid|dumb|fool|clown|trash|pathetic|worthless)\b",
    re.IGNORECASE,
)
PERSONAL_ATTACK_PATTERN = re.compile(
    r"\b(you are|you're|they are|he is|she is)\s+(an?\s+)?"
    r"(idiot|moron|liar|fraud|coward|hypocrite|disgrace)\b",
    re.IGNORECASE,
)
AGGRESSIVE_PATTERN = re.compile(
    r"\b(shut up|destroy them|crush them|wipe them out|they deserve to suffer|"
    r"make them pay|violent revenge)\b",
    re.IGNORECASE,
)
OFF_TOPIC_ATTACK_PATTERN = re.compile(
    r"\b(your appearance|your family|your religion|your race|your nationality|"
    r"your gender|your disability)\b",
    re.IGNORECASE,
)

# Kept intentionally narrow to avoid over-classifying normal policy critique.
HATE_SPEECH_PATTERN = re.compile(
    r"\b(all|every)\s+(jews|muslims|christians|women|men|immigrants|"
    r"black people|white people|arabs|asians|disabled people)\s+"
    r"(are|should be|must be)\s+(inferior|removed|hated|banned|destroyed)\b",
    re.IGNORECASE,
)


def detect_toxicity_flags(text: str) -> list[str]:
    """Return safety flags for clearly toxic argument content."""

    flags: list[str] = []
    if INSULT_PATTERN.search(text):
        flags.append("insult")
    if PERSONAL_ATTACK_PATTERN.search(text):
        flags.append("personal_attack")
    if AGGRESSIVE_PATTERN.search(text):
        flags.append("aggressive_language")
    if OFF_TOPIC_ATTACK_PATTERN.search(text):
        flags.append("off_topic_attack")
    if HATE_SPEECH_PATTERN.search(text):
        flags.append("hate_speech")
    return flags
