"use client";

import { ShieldCheck, ThumbsUp } from "lucide-react";
import { useState } from "react";

import { vote as sendVote } from "@/lib/api";
import type { AudienceVotes, DebaterSide } from "@/lib/types";

import { useDebateStore } from "@/hooks/useDebateStore";

interface VotePanelProps {
  debateId: string;
  votes: AudienceVotes;
}

export default function VotePanel({ debateId, votes }: VotePanelProps) {
  const [pendingSide, setPendingSide] = useState<DebaterSide | null>(null);
  const setAudienceVotes = useDebateStore((state) => state.setAudienceVotes);
  const setError = useDebateStore((state) => state.setError);

  async function handleVote(side: DebaterSide): Promise<void> {
    setPendingSide(side);
    try {
      const response = await sendVote(debateId, side);
      setAudienceVotes(response.audience_votes);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Vote failed.";
      setError(message);
    } finally {
      setPendingSide(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => void handleVote("PRO")}
        disabled={pendingSide !== null}
        className="inline-flex min-w-32 items-center justify-center gap-2 rounded-lg border border-arena-purple/40 bg-arena-purple/16 px-4 py-2 text-sm font-semibold text-arena-text transition hover:border-arena-purple hover:bg-arena-purple/24 disabled:opacity-60"
      >
        <ThumbsUp className="h-4 w-4" />
        PRO
        <span className="font-mono text-xs text-arena-muted">{votes.PRO}</span>
      </button>
      <button
        type="button"
        onClick={() => void handleVote("CON")}
        disabled={pendingSide !== null}
        className="inline-flex min-w-32 items-center justify-center gap-2 rounded-lg border border-arena-coral/40 bg-arena-coral/16 px-4 py-2 text-sm font-semibold text-arena-text transition hover:border-arena-coral hover:bg-arena-coral/24 disabled:opacity-60"
      >
        <ShieldCheck className="h-4 w-4" />
        CON
        <span className="font-mono text-xs text-arena-muted">{votes.CON}</span>
      </button>
    </div>
  );
}
