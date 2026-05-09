"use client";

import { Bot, Construction, UserRound } from "lucide-react";

import type { DebateMode } from "@/lib/types";

interface ModeSelectorProps {
  value: DebateMode;
  onChange: (value: DebateMode) => void;
}

const modes: Array<{
  value: DebateMode;
  label: string;
  description: string;
  disabled?: boolean;
}> = [
  { value: "AI_VS_AI", label: "AI vs AI", description: "Both sides are generated live." },
  { value: "HUMAN_VS_AI", label: "Human vs AI", description: "You argue PRO, AI responds CON." },
  { value: "HUMAN_VS_HUMAN", label: "Human vs Human", description: "Bracket-ready placeholder.", disabled: true }
];

export default function ModeSelector({ value, onChange }: ModeSelectorProps) {
  return (
    <div>
      <div className="mb-2 font-mono text-[11px] font-semibold uppercase text-arena-muted">Debate mode</div>
      <div className="grid gap-3 md:grid-cols-3">
        {modes.map((mode) => {
          const selected = value === mode.value;
          const Icon = mode.value === "AI_VS_AI" ? Bot : mode.value === "HUMAN_VS_AI" ? UserRound : Construction;
          return (
            <button
              key={mode.value}
              type="button"
              disabled={mode.disabled}
              onClick={() => onChange(mode.value)}
              className={`min-h-24 rounded-lg border p-3 text-left transition ${
                selected
                  ? "border-arena-teal bg-arena-teal/12"
                  : "border-arena-line bg-arena-black/54 hover:border-arena-purple/60"
              } disabled:cursor-not-allowed disabled:opacity-45`}
            >
              <Icon className={selected ? "h-4 w-4 text-arena-teal" : "h-4 w-4 text-arena-muted"} />
              <div className="mt-3 text-sm font-semibold text-arena-text">{mode.label}</div>
              <div className="mt-1 text-xs leading-4 text-arena-muted">{mode.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
