"use client";

import { BarChart3, Medal, TrendingDown, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type { Argument, ArgumentScore } from "@/lib/types";

interface DebateAnalyticsProps {
  argumentsList: Argument[];
  scores: ArgumentScore[];
  proTotal: number;
  conTotal: number;
}

interface TrendRow {
  round: string;
  PRO: number | null;
  CON: number | null;
  evidence: number;
  originality: number;
}

function asPercent(value: number): number {
  return Math.round(value * 100);
}

function findArgument(argumentId: string, argumentsList: Argument[]): Argument | null {
  return argumentsList.find((argument) => argument.argument_id === argumentId) ?? null;
}

function buildTrend(scores: ArgumentScore[]): TrendRow[] {
  const rounds = [...new Set(scores.map((score) => score.round_number))].sort((a, b) => a - b);
  return rounds.map((round) => {
    const roundScores = scores.filter((score) => score.round_number === round);
    const pro = roundScores.find((score) => score.debater === "PRO");
    const con = roundScores.find((score) => score.debater === "CON");
    const evidence =
      roundScores.reduce((sum, score) => sum + score.dimensions.evidence_quality, 0) / Math.max(roundScores.length, 1);
    const originality =
      roundScores.reduce((sum, score) => sum + score.dimensions.originality, 0) / Math.max(roundScores.length, 1);
    return {
      round: `R${round}`,
      PRO: pro ? asPercent(pro.final_score) : null,
      CON: con ? asPercent(con.final_score) : null,
      evidence: asPercent(evidence),
      originality: asPercent(originality)
    };
  });
}

export default function DebateAnalytics({ argumentsList, scores, proTotal, conTotal }: DebateAnalyticsProps) {
  if (scores.length === 0) {
    return null;
  }

  const trend = buildTrend(scores);
  const bestScore = [...scores].sort((a, b) => b.final_score - a.final_score)[0];
  const weakestScore = [...scores].sort((a, b) => a.final_score - b.final_score)[0];
  const mostPersuasive = [...scores].sort((a, b) => b.dimensions.persuasiveness - a.dimensions.persuasiveness)[0];
  const bestArgument = findArgument(bestScore.argument_id, argumentsList);
  const weakestArgument = findArgument(weakestScore.argument_id, argumentsList);

  return (
    <section className="rounded-lg border border-arena-line bg-arena-panel/88 p-4 shadow-glow">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-arena-text">
          <BarChart3 className="h-5 w-5 text-arena-teal" />
          Debate Analytics
        </h2>
        <div className="font-mono text-xs text-arena-muted">
          PRO {asPercent(proTotal)} / CON {asPercent(conTotal)}
        </div>
      </div>

      <div className="h-56 rounded-lg border border-arena-line bg-arena-black/44 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend}>
            <CartesianGrid stroke="#292B38" strokeDasharray="3 3" />
            <XAxis dataKey="round" stroke="#A8ABB8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#A8ABB8" tick={{ fontSize: 11 }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: "#11141D", border: "1px solid #2A2E3C", borderRadius: 8 }}
              labelStyle={{ color: "#F4F2EC" }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="PRO" stroke="#7F77DD" strokeWidth={2} connectNulls />
            <Line type="monotone" dataKey="CON" stroke="#D85A30" strokeWidth={2} connectNulls />
            <Line type="monotone" dataKey="evidence" stroke="#5DCAA5" strokeWidth={1.8} />
            <Line type="monotone" dataKey="originality" stroke="#EF9F27" strokeWidth={1.8} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <article className="rounded-lg border border-arena-teal/35 bg-arena-teal/10 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-arena-teal">
            <Medal className="h-4 w-4" />
            Best argument
          </h3>
          <p className="mt-2 text-xs leading-5 text-arena-muted">
            {bestArgument?.debater} Round {bestArgument?.round_number}: {bestArgument?.text.slice(0, 110)}
          </p>
        </article>
        <article className="rounded-lg border border-arena-amber/35 bg-arena-amber/10 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-arena-amber">
            <TrendingDown className="h-4 w-4" />
            Weakest argument
          </h3>
          <p className="mt-2 text-xs leading-5 text-arena-muted">
            {weakestArgument?.debater} Round {weakestArgument?.round_number}: {weakestArgument?.text.slice(0, 110)}
          </p>
        </article>
        <article className="rounded-lg border border-arena-purple/35 bg-arena-purple/10 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-arena-purple">
            <TrendingUp className="h-4 w-4" />
            Most persuasive
          </h3>
          <p className="mt-2 text-xs leading-5 text-arena-muted">
            Round {mostPersuasive.round_number} went highest on persuasion at{" "}
            {asPercent(mostPersuasive.dimensions.persuasiveness)}.
          </p>
        </article>
      </div>
    </section>
  );
}
