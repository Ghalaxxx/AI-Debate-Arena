export type DebaterSide = "PRO" | "CON";

export type WinnerSide = DebaterSide | "TIE";

export type DebateStatus =
  | "WAITING"
  | "PRO_TURN"
  | "CON_TURN"
  | "JUDGING"
  | "MODERATING"
  | "ROUND_COMPLETE"
  | "DEBATE_ENDED"
  | "ERROR";

export type DimensionKey =
  | "logical_coherence"
  | "evidence_quality"
  | "persuasiveness"
  | "relevance"
  | "counterargument"
  | "originality";

export type DimensionScores = Record<DimensionKey, number>;

export type AudienceVotes = Record<DebaterSide, number>;

export interface ModelOption {
  id: string;
  label: string;
  provider: "Anthropic" | "OpenAI" | "Local";
  bestFor: string;
}

export interface DebateConfig {
  topic: string;
  max_rounds: number;
  pro_model?: string;
  con_model?: string;
  judge_model?: string;
}

export interface DebateCreateResponse {
  debate_id: string;
  websocket_url: string;
  status: DebateStatus;
}

export interface DebateStartResponse {
  debate_id: string;
  status: DebateStatus;
  message: string;
}

export interface Argument {
  argument_id: string;
  debate_id?: string;
  debater: DebaterSide;
  text: string;
  round_number: number;
  timestamp: string;
  flags: string[];
}

export interface ArgumentPayload {
  argument_id: string;
  debater: DebaterSide;
  text: string;
  round: number;
  timestamp: string;
  flags?: string[];
}

export interface ArgumentScore {
  argument_id: string;
  debater: DebaterSide;
  round_number: number;
  dimensions: DimensionScores;
  final_score: number;
  judge_reasoning: string;
  timestamp: string;
  flags: string[];
}

export interface DebateState {
  debate_id: string;
  topic: string;
  current_round: number;
  max_rounds: number;
  pro_model: string;
  con_model: string;
  judge_model: string;
  turn: DebaterSide;
  arguments: Argument[];
  scores: ArgumentScore[];
  pro_total_score: number;
  con_total_score: number;
  is_active: boolean;
  winner: WinnerSide | null;
  summary: string | null;
  status: DebateStatus;
  audience_votes: AudienceVotes;
}

export interface ScoresResponse {
  pro_total: number;
  con_total: number;
  round_scores: ArgumentScore[];
  dimension_breakdown: Record<DebaterSide, DimensionScores>;
}

export interface VoteResponse {
  debate_id: string;
  vote: DebaterSide;
  argument_id: string | null;
  audience_votes: AudienceVotes;
}

export type DebateMessage =
  | { type: "ARGUMENT"; payload: ArgumentPayload }
  | {
      type: "SCORE_UPDATE";
      payload: {
        argument_id: string;
        scores: ArgumentScore;
        pro_total: number;
        con_total: number;
      };
    }
  | { type: "STATE_CHANGE"; payload: { new_state: DebateStatus; round: number } }
  | {
      type: "DEBATE_ENDED";
      payload: {
        winner: WinnerSide;
        pro_final_score: number;
        con_final_score: number;
        summary: string;
        audience_votes: { pro: number; con: number };
      };
    }
  | { type: "ERROR"; payload: { message: string; code: string } }
  | { type: "PONG"; payload: { debate_id: string } };

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  logical_coherence: "Coherence",
  evidence_quality: "Evidence",
  persuasiveness: "Persuasion",
  relevance: "Relevance",
  counterargument: "Counter",
  originality: "Originality"
};

export const DIMENSION_KEYS = Object.keys(DIMENSION_LABELS) as DimensionKey[];

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "claude-sonnet-4-20250514",
    label: "Claude Sonnet 4",
    provider: "Anthropic",
    bestFor: "Nuanced long-form reasoning"
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "OpenAI",
    bestFor: "Fast counterarguments"
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini",
    provider: "OpenAI",
    bestFor: "Low-latency judging"
  },
  {
    id: "local-fallback",
    label: "Local Fallback",
    provider: "Local",
    bestFor: "Credential-free demos"
  }
];

export function modelLabel(modelId: string): string {
  return MODEL_OPTIONS.find((model) => model.id === modelId)?.label ?? modelId;
}
