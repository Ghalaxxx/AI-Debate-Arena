"use client";

import { Activity, Clock, Radio } from "lucide-react";
import { useEffect, useState } from "react";

import type { DebateStatus } from "@/lib/types";

interface StatusBarProps {
  status: DebateStatus;
  currentRound: number;
  maxRounds: number;
  proTotal: number;
  conTotal: number;
  isConnected: boolean;
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remaining = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

export default function StatusBar({
  status,
  currentRound,
  maxRounds,
  proTotal,
  conTotal,
  isConnected
}: StatusBarProps) {
  const [elapsed, setElapsed] = useState(0);
  const proWidth = Math.max(4, proTotal * 100);
  const conWidth = Math.max(4, conTotal * 100);

  useEffect(() => {
    const interval = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="grid gap-4 border-t border-arena-line bg-arena-black/92 px-4 py-3 lg:grid-cols-[1fr_auto_1fr]">
      <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-arena-muted">
        <span className="inline-flex items-center gap-2 rounded-md border border-arena-line bg-arena-panel px-3 py-2">
          <Radio className={isConnected ? "h-4 w-4 text-arena-teal" : "h-4 w-4 text-arena-red"} />
          {isConnected ? "LIVE" : "RECONNECTING"}
        </span>
        <span className="inline-flex items-center gap-2 rounded-md border border-arena-line bg-arena-panel px-3 py-2">
          <Clock className="h-4 w-4" />
          {formatElapsed(elapsed)}
        </span>
      </div>

      <div className="flex items-center justify-center gap-3 font-mono text-xs">
        <span className="rounded-md border border-arena-line bg-arena-panel px-3 py-2 text-arena-text">
          {status.replace("_", " ")}
        </span>
        <span className="rounded-md border border-arena-line bg-arena-panel px-3 py-2 text-arena-muted">
          Round {Math.min(currentRound, maxRounds)} of {maxRounds}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Activity className="h-4 w-4 text-arena-muted" />
        <div className="grid flex-1 grid-cols-2 gap-2">
          <div className="h-2 overflow-hidden rounded-md bg-arena-panel">
            <div className="h-full bg-arena-purple transition-all" style={{ width: `${proWidth}%` }} />
          </div>
          <div className="h-2 overflow-hidden rounded-md bg-arena-panel">
            <div className="ml-auto h-full bg-arena-coral transition-all" style={{ width: `${conWidth}%` }} />
          </div>
        </div>
        <span className="font-mono text-xs text-arena-muted">
          {(proTotal * 100).toFixed(0)}:{(conTotal * 100).toFixed(0)}
        </span>
      </div>
    </div>
  );
}
