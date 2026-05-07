"use client";

import { GitBranch } from "lucide-react";

import type { Argument, ArgumentScore } from "@/lib/types";

interface ArgumentTreeProps {
  argumentsList: Argument[];
  scoresByArgument: Record<string, ArgumentScore>;
}

export default function ArgumentTree({ argumentsList, scoresByArgument }: ArgumentTreeProps) {
  const latest = argumentsList.slice(-6);

  return (
    <section className="rounded-lg border border-arena-line bg-arena-panel/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-arena-text">
          <GitBranch className="h-4 w-4 text-arena-teal" />
          Argument Tree
        </h2>
        <span className="font-mono text-xs text-arena-muted">{argumentsList.length} nodes</span>
      </div>
      <div className="grid gap-2">
        {latest.map((argument, index) => {
          const score = scoresByArgument[argument.argument_id];
          return (
            <div key={argument.argument_id} className="grid grid-cols-[64px_1fr_52px] items-center gap-2">
              <span
                className={`rounded-md border px-2 py-1 text-center font-mono text-xs ${
                  argument.debater === "PRO"
                    ? "border-arena-purple/40 text-arena-purple"
                    : "border-arena-coral/40 text-arena-coral"
                }`}
              >
                {argument.debater}
              </span>
              <div className="relative h-7 overflow-hidden rounded-md bg-arena-black/50">
                <div
                  className={`absolute left-0 top-0 h-full ${
                    argument.debater === "PRO" ? "bg-arena-purple/24" : "bg-arena-coral/24"
                  }`}
                  style={{ width: `${Math.max(16, (score?.final_score ?? 0.18) * 100)}%` }}
                />
                <p className="relative truncate px-3 py-1 text-xs text-arena-muted">
                  {index > 0 ? "answers " : "opens "}
                  {argument.text}
                </p>
              </div>
              <span className="text-right font-mono text-xs text-arena-muted">
                {score ? (score.final_score * 100).toFixed(0) : "--"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
