"use client";

import { AlertTriangle, Bot, Loader2, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { getDebateState, startDebate } from "@/lib/api";
import type { Argument, ArgumentScore, DebateLanguage, DebaterSide, DimensionScores } from "@/lib/types";
import { DIMENSION_KEYS, modelLabel } from "@/lib/types";

import { currentVotes, useDebateStore } from "@/hooks/useDebateStore";
import { useDebateSocket } from "@/hooks/useDebateSocket";

import ArgumentCard from "./ArgumentCard";
import ArgumentTree from "./ArgumentTree";
import DebateAnalytics from "./DebateAnalytics";
import HumanArgumentComposer from "./HumanArgumentComposer";
import JudgeExplainabilityPanel from "./JudgeExplainabilityPanel";
import ScoreRadar, { emptyDimensionScores } from "./ScoreRadar";
import StatusBar from "./StatusBar";
import VotePanel from "./VotePanel";

interface DebateArenaProps {
  debateId: string;
}

function averageDimensions(scores: ArgumentScore[], side: DebaterSide): DimensionScores {
  const sideScores = scores.filter((score) => score.debater === side);
  if (sideScores.length === 0) {
    return emptyDimensionScores();
  }
  const averaged = emptyDimensionScores();
  for (const key of DIMENSION_KEYS) {
    averaged[key] = sideScores.reduce((sum, score) => sum + score.dimensions[key], 0) / sideScores.length;
  }
  return averaged;
}

function SidePanel({
  side,
  argumentsList,
  total,
  proScores,
  conScores,
  scoresByArgument,
  model,
  language
}: {
  side: DebaterSide;
  argumentsList: Argument[];
  total: number;
  proScores: DimensionScores;
  conScores: DimensionScores;
  scoresByArgument: Record<string, ArgumentScore>;
  model: string;
  language: DebateLanguage;
}) {
  const isPro = side === "PRO";
  const isRtl = language === "ar";
  return (
    <aside className="flex min-h-0 flex-col gap-4">
      <section className="rounded-lg border border-arena-line bg-arena-panel/84 p-4 shadow-glow">
        <div className="flex items-center gap-3">
          <div
            className={`grid h-12 w-12 place-items-center rounded-lg border ${
              isPro ? "border-arena-purple/50 bg-arena-purple/16" : "border-arena-coral/50 bg-arena-coral/16"
            }`}
          >
            <Bot className={isPro ? "h-6 w-6 text-arena-purple" : "h-6 w-6 text-arena-coral"} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-arena-text">{isPro ? "PRO Debater" : "CON Debater"}</h2>
            <p className={isPro ? "font-mono text-xs text-arena-purple" : "font-mono text-xs text-arena-coral"}>
              {modelLabel(model)}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="font-mono text-2xl font-bold text-arena-text">{(total * 100).toFixed(0)}</p>
            <p className="font-mono text-[11px] text-arena-muted">TOTAL</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-arena-line bg-arena-panel/70 p-4">
        <ScoreRadar proScores={proScores} conScores={conScores} />
      </section>

      <section className="arena-scroll min-h-0 flex-1 overflow-y-auto rounded-lg border border-arena-line bg-arena-panel/54 p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-arena-text">{side} History</h3>
          <span className="font-mono text-xs text-arena-muted">{argumentsList.length}</span>
        </div>
        <div className="space-y-3">
          {argumentsList.map((argument) => (
            <div key={argument.argument_id} className="rounded-lg border border-arena-line bg-arena-black/42 p-3">
              <p className={`line-clamp-4 text-xs leading-5 text-arena-muted ${isRtl ? "text-right" : "text-left"}`}>
                {argument.text}
              </p>
              <div className="mt-2 font-mono text-[11px] text-arena-muted">
                score {((scoresByArgument[argument.argument_id]?.final_score ?? 0) * 100).toFixed(0)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

export default function DebateArena({ debateId }: DebateArenaProps) {
  const startedRef = useRef(false);
  const [selectedScoreId, setSelectedScoreId] = useState<string | null>(null);
  const debate = useDebateStore((state) => state.debate);
  const argumentsList = useDebateStore((state) => state.arguments);
  const scoresByArgument = useDebateStore((state) => state.scoresByArgument);
  const status = useDebateStore((state) => state.status);
  const proTotal = useDebateStore((state) => state.proTotal);
  const conTotal = useDebateStore((state) => state.conTotal);
  const isConnected = useDebateStore((state) => state.isConnected);
  const error = useDebateStore((state) => state.error);
  const latestArgumentId = useDebateStore((state) => state.latestArgumentId);
  const setDebate = useDebateStore((state) => state.setDebate);
  const setError = useDebateStore((state) => state.setError);

  useDebateSocket(debateId);

  useEffect(() => {
    let cancelled = false;
    async function loadState(): Promise<void> {
      try {
        const state = await getDebateState(debateId);
        if (!cancelled) {
          setDebate(state);
        }
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Could not load debate state.";
        setError(message);
      }
    }
    void loadState();
    return () => {
      cancelled = true;
    };
  }, [debateId, setDebate, setError]);

  useEffect(() => {
    if (!debate || debate.status !== "WAITING" || !isConnected || startedRef.current) {
      return;
    }
    startedRef.current = true;
    startDebate(debateId).catch((startError: unknown) => {
      const message = startError instanceof Error ? startError.message : "Could not start debate.";
      setError(message);
    });
  }, [debate, debateId, isConnected, setError]);

  const scores = useMemo(() => Object.values(scoresByArgument), [scoresByArgument]);
  const proScores = useMemo(() => averageDimensions(scores, "PRO"), [scores]);
  const conScores = useMemo(() => averageDimensions(scores, "CON"), [scores]);
  const proArguments = argumentsList.filter((argument) => argument.debater === "PRO");
  const conArguments = argumentsList.filter((argument) => argument.debater === "CON");
  const votes = currentVotes(debate);
  const isJudging = status === "JUDGING";
  const isHumanTurn =
    debate !== null &&
    debate.mode === "HUMAN_VS_AI" &&
    debate.human_side === debate.turn &&
    status === (debate.turn === "PRO" ? "PRO_TURN" : "CON_TURN") &&
    debate.status !== "DEBATE_ENDED";
  const selectedArgument = selectedScoreId
    ? argumentsList.find((argument) => argument.argument_id === selectedScoreId) ?? null
    : null;
  const selectedScore = selectedScoreId ? scoresByArgument[selectedScoreId] ?? null : null;

  if (!debate) {
    return (
      <main className="grid min-h-screen place-items-center bg-arena-black text-arena-text">
        <div className="flex items-center gap-3 font-mono text-sm text-arena-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading debate
        </div>
      </main>
    );
  }

  return (
    <main
      className="premium-grid flex min-h-screen flex-col text-arena-text"
      dir={debate.language === "ar" ? "rtl" : "ltr"}
    >
      <div className="grid min-h-0 flex-1 gap-4 p-4 pb-0 lg:grid-cols-[minmax(260px,30%)_minmax(360px,40%)_minmax(260px,30%)]">
        <SidePanel
          side="PRO"
          argumentsList={proArguments}
          total={proTotal}
          proScores={proScores}
          conScores={conScores}
          scoresByArgument={scoresByArgument}
          model={debate.pro_model}
          language={debate.language}
        />

        <section className="relative flex min-h-0 flex-col gap-4">
          <header className="rounded-lg border border-arena-line bg-arena-panel/88 p-4 shadow-glow">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-bold text-arena-text">{debate.topic}</h1>
                <p className="mt-2 font-mono text-xs text-arena-muted">
                  PRO {modelLabel(debate.pro_model)} vs CON {modelLabel(debate.con_model)} / Judge{" "}
                  {modelLabel(debate.judge_model)} / {debate.language === "ar" ? "Arabic" : "English"}
                </p>
              </div>
              {debate.winner ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-md border border-arena-teal/40 bg-arena-teal/14 px-3 py-2 font-mono text-xs text-arena-teal">
                    <Trophy className="h-4 w-4" />
                    {debate.winner}
                  </div>
                  <Link
                    href={`/replay/${debate.debate_id}`}
                    className="rounded-md border border-arena-purple/40 bg-arena-purple/14 px-3 py-2 font-mono text-xs text-arena-purple transition hover:border-arena-purple"
                  >
                    Replay
                  </Link>
                </div>
              ) : null}
            </div>
          </header>

          <div className="arena-scroll min-h-[420px] flex-1 overflow-y-auto rounded-lg border border-arena-line bg-arena-black/58 p-4">
            <div className="space-y-4">
              {argumentsList.map((argument) => (
                <div
                  key={argument.argument_id}
                  className={`flex ${argument.debater === "PRO" ? "justify-start pr-8" : "justify-end pl-8"}`}
                >
                  <div className="w-full max-w-[88%]">
                    <ArgumentCard
                      argument={argument}
                      score={scoresByArgument[argument.argument_id] ?? null}
                      isLatest={argument.argument_id === latestArgumentId}
                      language={debate.language}
                      onInspect={() => setSelectedScoreId(argument.argument_id)}
                    />
                  </div>
                </div>
              ))}
              {argumentsList.length === 0 ? (
                <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-arena-line">
                  <div className="text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-arena-teal" />
                    <p className="mt-3 font-mono text-xs text-arena-muted">Preparing opening argument</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {isJudging ? (
            <div className="pointer-events-none absolute inset-x-6 top-28 z-10 rounded-lg border border-arena-purple/50 bg-arena-black/86 px-4 py-3 text-center font-mono text-sm text-arena-teal shadow-glow">
              JUDGING...
            </div>
          ) : null}

          <ArgumentTree argumentsList={argumentsList} scoresByArgument={scoresByArgument} />

          {status === "DEBATE_ENDED" ? (
            <DebateAnalytics
              argumentsList={argumentsList}
              scores={scores}
              proTotal={proTotal}
              conTotal={conTotal}
            />
          ) : null}

          {isHumanTurn ? <HumanArgumentComposer debateId={debateId} language={debate.language} /> : null}

          {error ? (
            <div className="flex items-center gap-2 rounded-lg border border-arena-red/40 bg-arena-red/12 p-3 text-sm text-arena-red">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          ) : null}
        </section>

        <SidePanel
          side="CON"
          argumentsList={conArguments}
          total={conTotal}
          proScores={proScores}
          conScores={conScores}
          scoresByArgument={scoresByArgument}
          model={debate.con_model}
          language={debate.language}
        />
      </div>

      {selectedArgument && selectedScore ? (
        <JudgeExplainabilityPanel
          argument={selectedArgument}
          score={selectedScore}
          onClose={() => setSelectedScoreId(null)}
        />
      ) : null}

      <div className="border-t border-arena-line bg-arena-black/94">
        <div className="grid gap-3 px-4 py-3 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div className="font-mono text-xs text-arena-muted">
            PRO {(proTotal * 100).toFixed(0)} / CON {(conTotal * 100).toFixed(0)}
          </div>
          <VotePanel debateId={debateId} votes={votes} />
          <div className="text-right font-mono text-xs text-arena-muted">
            {debate.summary ?? "Winner declared automatically after final judging"}
          </div>
        </div>
        <StatusBar
          status={status}
          currentRound={debate.current_round}
          maxRounds={debate.max_rounds}
          proTotal={proTotal}
          conTotal={conTotal}
          isConnected={isConnected}
        />
      </div>
    </main>
  );
}
