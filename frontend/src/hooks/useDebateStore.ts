"use client";

import { create } from "zustand";

import type {
  Argument,
  ArgumentPayload,
  ArgumentScore,
  AudienceVotes,
  DebateMessage,
  DebateState,
  DebateStatus
} from "@/lib/types";

interface DebateStoreState {
  debate: DebateState | null;
  arguments: Argument[];
  scoresByArgument: Record<string, ArgumentScore>;
  status: DebateStatus;
  proTotal: number;
  conTotal: number;
  isConnected: boolean;
  error: string | null;
  latestArgumentId: string | null;
  setDebate: (debate: DebateState) => void;
  handleMessage: (message: DebateMessage) => void;
  setConnected: (isConnected: boolean) => void;
  setError: (message: string | null) => void;
  setAudienceVotes: (votes: AudienceVotes) => void;
  reset: () => void;
}

const emptyVotes: AudienceVotes = { PRO: 0, CON: 0 };

function argumentFromPayload(payload: ArgumentPayload): Argument {
  return {
    argument_id: payload.argument_id,
    debater: payload.debater,
    text: payload.text,
    round_number: payload.round,
    timestamp: payload.timestamp,
    flags: payload.flags ?? []
  };
}

function indexScores(scores: ArgumentScore[]): Record<string, ArgumentScore> {
  const indexed: Record<string, ArgumentScore> = {};
  for (const score of scores) {
    indexed[score.argument_id] = score;
  }
  return indexed;
}

export const useDebateStore = create<DebateStoreState>((set) => ({
  debate: null,
  arguments: [],
  scoresByArgument: {},
  status: "WAITING",
  proTotal: 0,
  conTotal: 0,
  isConnected: false,
  error: null,
  latestArgumentId: null,
  setDebate: (debate) =>
    set({
      debate,
      arguments: debate.arguments,
      scoresByArgument: indexScores(debate.scores),
      status: debate.status,
      proTotal: debate.pro_total_score,
      conTotal: debate.con_total_score,
      latestArgumentId: debate.arguments.at(-1)?.argument_id ?? null
    }),
  handleMessage: (message) =>
    set((state) => {
      if (message.type === "ARGUMENT") {
        const incoming = argumentFromPayload(message.payload);
        const exists = state.arguments.some((argument) => argument.argument_id === incoming.argument_id);
        const nextArguments = exists ? state.arguments : [...state.arguments, incoming];
        return {
          arguments: nextArguments,
          latestArgumentId: incoming.argument_id,
          debate: state.debate ? { ...state.debate, arguments: nextArguments } : state.debate
        };
      }
      if (message.type === "SCORE_UPDATE") {
        const nextScores = {
          ...state.scoresByArgument,
          [message.payload.argument_id]: message.payload.scores
        };
        const nextScoresList = Object.values(nextScores);
        return {
          scoresByArgument: nextScores,
          proTotal: message.payload.pro_total,
          conTotal: message.payload.con_total,
          debate: state.debate
            ? {
                ...state.debate,
                scores: nextScoresList,
                pro_total_score: message.payload.pro_total,
                con_total_score: message.payload.con_total
              }
            : state.debate
        };
      }
      if (message.type === "STATE_CHANGE") {
        return {
          status: message.payload.new_state,
          debate: state.debate
            ? {
                ...state.debate,
                status: message.payload.new_state,
                current_round: message.payload.round,
                turn: message.payload.turn ?? state.debate.turn
              }
            : state.debate
        };
      }
      if (message.type === "DEBATE_ENDED") {
        const votes: AudienceVotes = {
          PRO: message.payload.audience_votes.pro,
          CON: message.payload.audience_votes.con
        };
        return {
          status: "DEBATE_ENDED",
          proTotal: message.payload.pro_final_score,
          conTotal: message.payload.con_final_score,
          debate: state.debate
            ? {
                ...state.debate,
                status: "DEBATE_ENDED",
                winner: message.payload.winner,
                summary: message.payload.summary,
                pro_total_score: message.payload.pro_final_score,
                con_total_score: message.payload.con_final_score,
                is_active: false,
                audience_votes: votes
              }
            : state.debate
        };
      }
      if (message.type === "ERROR") {
        return { error: message.payload.message, status: "ERROR" };
      }
      return state;
    }),
  setConnected: (isConnected) => set({ isConnected }),
  setError: (message) => set({ error: message }),
  setAudienceVotes: (votes) =>
    set((state) => ({
      debate: state.debate ? { ...state.debate, audience_votes: votes } : state.debate
    })),
  reset: () =>
    set({
      debate: null,
      arguments: [],
      scoresByArgument: {},
      status: "WAITING",
      proTotal: 0,
      conTotal: 0,
      isConnected: false,
      error: null,
      latestArgumentId: null
    })
}));

export function currentVotes(debate: DebateState | null): AudienceVotes {
  return debate?.audience_votes ?? emptyVotes;
}
