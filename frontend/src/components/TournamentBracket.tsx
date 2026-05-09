"use client";

import { Trophy } from "lucide-react";

import type { TournamentState } from "@/lib/types";

interface TournamentBracketProps {
  tournament: TournamentState;
}

export default function TournamentBracket({ tournament }: TournamentBracketProps) {
  const rounds = [...new Set(tournament.matches.map((match) => match.round_number))].sort((a, b) => a - b);

  return (
    <section className="rounded-lg border border-arena-line bg-arena-panel/88 p-5 shadow-glow">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-xl font-bold text-arena-text">
          <Trophy className="h-5 w-5 text-arena-teal" />
          Tournament Bracket
        </h2>
        <span className="font-mono text-xs text-arena-muted">{tournament.size} topics</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {rounds.map((round) => (
          <div key={round} className="space-y-4">
            <h3 className="font-mono text-xs uppercase text-arena-muted">
              {round === rounds.length ? "Final" : `Round ${round}`}
            </h3>
            {tournament.matches
              .filter((match) => match.round_number === round)
              .map((match) => (
                <article key={match.match_id} className="rounded-lg border border-arena-line bg-arena-black/44 p-4">
                  <div className="space-y-2">
                    <div className="rounded-md border border-arena-purple/35 bg-arena-purple/10 px-3 py-2 text-sm text-arena-text">
                      {match.slot_a}
                    </div>
                    <div className="rounded-md border border-arena-coral/35 bg-arena-coral/10 px-3 py-2 text-sm text-arena-text">
                      {match.slot_b}
                    </div>
                  </div>
                  <div className="mt-3 font-mono text-[11px] text-arena-muted">{match.status}</div>
                </article>
              ))}
          </div>
        ))}
        <div className="rounded-lg border border-arena-teal/40 bg-arena-teal/10 p-4">
          <h3 className="font-mono text-xs uppercase text-arena-teal">Champion</h3>
          <p className="mt-3 text-sm leading-6 text-arena-text">
            {tournament.champion_topic ?? "Champion topic will appear after the final match."}
          </p>
        </div>
      </div>
    </section>
  );
}
