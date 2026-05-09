"use client";

import { AlertTriangle, CheckCircle2, X, Zap } from "lucide-react";

import type { Argument, ArgumentScore } from "@/lib/types";
import { DIMENSION_KEYS, DIMENSION_LABELS } from "@/lib/types";

interface JudgeExplainabilityPanelProps {
  argument: Argument;
  score: ArgumentScore;
  onClose: () => void;
}

function scoreColor(value: number): string {
  if (value < 0.4) {
    return "text-arena-red";
  }
  if (value < 0.7) {
    return "text-arena-amber";
  }
  return "text-arena-teal";
}

export default function JudgeExplainabilityPanel({ argument, score, onClose }: JudgeExplainabilityPanelProps) {
  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-xl border-l border-arena-line bg-arena-panel shadow-glow">
      <div className="flex h-full flex-col">
        <header className="border-b border-arena-line p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs text-arena-muted">
                {argument.debater} / Round {argument.round_number}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-arena-text">Judge Explainability</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-lg border border-arena-line bg-arena-black/50 text-arena-muted transition hover:text-arena-text"
              aria-label="Close explainability panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="arena-scroll flex-1 overflow-y-auto p-5">
          <section className="grid gap-4 sm:grid-cols-[150px_1fr]">
            <div className="rounded-lg border border-arena-teal/40 bg-arena-teal/12 p-4 text-center">
              <p className={`text-5xl font-black ${scoreColor(score.final_score)}`}>
                {(score.final_score * 100).toFixed(0)}
              </p>
              <p className="mt-1 font-mono text-xs text-arena-muted">FINAL SCORE</p>
            </div>
            <div className="rounded-lg border border-arena-line bg-arena-black/44 p-4">
              <p className="text-sm leading-6 text-arena-muted">{score.judge_reasoning}</p>
            </div>
          </section>

          <section className="mt-5 rounded-lg border border-arena-line bg-arena-black/44 p-4">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-arena-text">
              <Zap className="h-4 w-4 text-arena-teal" />
              Dimension breakdown
            </h3>
            <div className="space-y-3">
              {DIMENSION_KEYS.map((key) => (
                <div key={key} className="grid grid-cols-[120px_1fr_42px] items-center gap-3">
                  <span className="text-xs text-arena-muted">{DIMENSION_LABELS[key]}</span>
                  <div className="h-2 overflow-hidden rounded-md bg-arena-panel">
                    <div className="h-full bg-arena-teal" style={{ width: `${score.dimensions[key] * 100}%` }} />
                  </div>
                  <span className={`text-right font-mono text-xs ${scoreColor(score.dimensions[key])}`}>
                    {(score.dimensions[key] * 100).toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-5 grid gap-3">
            <div className="rounded-lg border border-arena-teal/35 bg-arena-teal/10 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-arena-teal">
                <CheckCircle2 className="h-4 w-4" />
                Strongest point
              </h3>
              <p className="mt-2 text-sm leading-6 text-arena-text">{score.strongest_point}</p>
            </div>
            <div className="rounded-lg border border-arena-amber/35 bg-arena-amber/10 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-arena-amber">
                <AlertTriangle className="h-4 w-4" />
                Weakest point
              </h3>
              <p className="mt-2 text-sm leading-6 text-arena-text">{score.weakest_point}</p>
            </div>
            <div className="rounded-lg border border-arena-line bg-arena-black/44 p-4">
              <h3 className="text-sm font-semibold text-arena-text">Why points changed</h3>
              <p className="mt-2 text-sm leading-6 text-arena-muted">{score.score_explanation}</p>
            </div>
          </section>

          <section className="mt-5 rounded-lg border border-arena-line bg-arena-black/44 p-4">
            <h3 className="text-sm font-semibold text-arena-text">Detected flags</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {score.flags.length > 0 ? (
                score.flags.map((flag) => (
                  <span key={flag} className="rounded-md border border-arena-red/40 bg-arena-red/12 px-2 py-1 font-mono text-xs text-arena-red">
                    {flag}
                  </span>
                ))
              ) : (
                <span className="rounded-md border border-arena-teal/40 bg-arena-teal/12 px-2 py-1 font-mono text-xs text-arena-teal">
                  no flags
                </span>
              )}
            </div>
          </section>
        </div>
      </div>
    </aside>
  );
}
