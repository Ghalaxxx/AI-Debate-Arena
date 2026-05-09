"use client";

import { Flag, Gauge, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { Argument, ArgumentScore, DebateLanguage } from "@/lib/types";

interface ArgumentCardProps {
  argument: Argument;
  score: ArgumentScore | null;
  isLatest: boolean;
  language?: DebateLanguage;
}

function scoreTone(score: number): string {
  if (score < 0.4) {
    return "bg-arena-red/18 text-arena-red border-arena-red/40";
  }
  if (score < 0.7) {
    return "bg-arena-amber/18 text-arena-amber border-arena-amber/40";
  }
  return "bg-arena-teal/18 text-arena-teal border-arena-teal/40";
}

export default function ArgumentCard({ argument, score, isLatest, language = "en" }: ArgumentCardProps) {
  const [visibleText, setVisibleText] = useState(argument.text);
  const isFlagged = argument.flags.length > 0 || (score?.flags.length ?? 0) > 0;
  const sideAccent = argument.debater === "PRO" ? "border-l-arena-purple" : "border-l-arena-coral";
  const isRtl = language === "ar";

  useEffect(() => {
    if (!isLatest || score) {
      setVisibleText(argument.text);
      return undefined;
    }

    const words = argument.text.split(" ");
    let index = 0;
    setVisibleText("");
    const interval = window.setInterval(() => {
      index += 1;
      setVisibleText(words.slice(0, index).join(" "));
      if (index >= words.length) {
        window.clearInterval(interval);
      }
    }, 26);

    return () => window.clearInterval(interval);
  }, [argument.text, isLatest, score]);

  const stateLabel = useMemo(() => {
    if (isFlagged) {
      return "FLAGGED";
    }
    if (score) {
      return "SCORED";
    }
    return isLatest ? "STREAMING" : "JUDGING";
  }, [isFlagged, isLatest, score]);

  return (
    <article
      className={`border-l-4 ${sideAccent} ${
        isFlagged ? "border-arena-red/70" : score ? "border-arena-line" : "animate-pulseBorder border-arena-purple/40"
      } rounded-lg border bg-arena-panel/82 p-4 shadow-glow`}
      title={isFlagged ? [...argument.flags, ...(score?.flags ?? [])].join(", ") : undefined}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-xs text-arena-muted">
          <span className={argument.debater === "PRO" ? "text-arena-purple" : "text-arena-coral"}>
            {argument.debater}
          </span>
          <span>ROUND {argument.round_number}</span>
        </div>
        <div className="flex items-center gap-2">
          {isFlagged ? <Flag className="h-4 w-4 text-arena-red" /> : <Sparkles className="h-4 w-4 text-arena-teal" />}
          <span className="font-mono text-[11px] text-arena-muted">{stateLabel}</span>
        </div>
      </div>

      <p className={`text-sm leading-7 text-arena-text ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"}>
        {visibleText}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] text-arena-muted">
          {new Date(argument.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
        {score ? (
          <span
            className={`animate-scoreIn inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs ${scoreTone(
              score.final_score
            )}`}
          >
            <Gauge className="h-3.5 w-3.5" />
            {(score.final_score * 100).toFixed(0)}
          </span>
        ) : (
          <span className="rounded-md border border-arena-line px-2 py-1 font-mono text-xs text-arena-muted">
            JUDGING
          </span>
        )}
      </div>
    </article>
  );
}
