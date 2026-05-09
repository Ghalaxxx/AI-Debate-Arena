import axios from "axios";

import type {
  DebateConfig,
  DebateCreateResponse,
  DebateStartResponse,
  DebateState,
  DebaterSide,
  HumanArgumentResponse,
  ScoresResponse,
  VoteResponse
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json"
  }
});

export async function createDebate(config: DebateConfig): Promise<DebateCreateResponse> {
  const response = await apiClient.post<DebateCreateResponse>("/api/debate/create", config);
  return response.data;
}

export async function startDebate(debateId: string): Promise<DebateStartResponse> {
  const response = await apiClient.post<DebateStartResponse>(`/api/debate/${debateId}/start`);
  return response.data;
}

export async function getDebateState(debateId: string): Promise<DebateState> {
  const response = await apiClient.get<DebateState>(`/api/debate/${debateId}/state`);
  return response.data;
}

export async function vote(debateId: string, voteFor: DebaterSide, argumentId?: string): Promise<VoteResponse> {
  const response = await apiClient.post<VoteResponse>(`/api/debate/${debateId}/vote`, {
    vote: voteFor,
    argument_id: argumentId ?? null
  });
  return response.data;
}

export async function submitHumanArgument(debateId: string, text: string): Promise<HumanArgumentResponse> {
  const response = await apiClient.post<HumanArgumentResponse>(`/api/debate/${debateId}/argument`, { text });
  return response.data;
}

export async function getScores(debateId: string): Promise<ScoresResponse> {
  const response = await apiClient.get<ScoresResponse>(`/api/debate/${debateId}/scores`);
  return response.data;
}

export function websocketUrlFor(debateId: string): string {
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  if (configured) {
    return `${configured.replace(/\/$/, "")}/ws/debate/${debateId}`;
  }
  return `${API_BASE_URL.replace(/^http/, "ws").replace(/\/$/, "")}/ws/debate/${debateId}`;
}
