"""Tournament bracket construction helpers."""

from __future__ import annotations

from tournament.models import TournamentMatch, TournamentState, TournamentTopic


def create_tournament(topics: list[str]) -> TournamentState:
    """Create an initial single-elimination bracket."""

    seeded_topics = [TournamentTopic(seed=index + 1, topic=topic) for index, topic in enumerate(topics)]
    matches: list[TournamentMatch] = []
    first_round = 1
    for index in range(0, len(seeded_topics), 2):
        matches.append(
            TournamentMatch(
                round_number=first_round,
                slot_a=seeded_topics[index].topic,
                slot_b=seeded_topics[index + 1].topic,
                status="READY",
            )
        )
    semifinal_count = len(seeded_topics) // 4
    for index in range(semifinal_count):
        matches.append(
            TournamentMatch(
                round_number=2,
                slot_a=f"Winner R1-{index * 2 + 1}",
                slot_b=f"Winner R1-{index * 2 + 2}",
            )
        )
    if len(seeded_topics) == 8:
        matches.append(TournamentMatch(round_number=3, slot_a="Winner SF-1", slot_b="Winner SF-2"))
    return TournamentState(size=len(seeded_topics), topics=seeded_topics, matches=matches)
