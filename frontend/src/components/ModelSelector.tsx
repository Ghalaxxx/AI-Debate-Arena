"use client";

import { ChevronDown, Cpu } from "lucide-react";

import type { ModelOption } from "@/lib/types";
import { MODEL_OPTIONS } from "@/lib/types";

interface ModelSelectorProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export default function ModelSelector({ id, label, value, onChange }: ModelSelectorProps) {
  const selected = MODEL_OPTIONS.find((model) => model.id === value) ?? MODEL_OPTIONS[0];

  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] font-semibold uppercase text-arena-muted">{label}</span>
        <span className="font-mono text-[11px] text-arena-teal">{selected.provider}</span>
      </span>
      <div className="relative">
        <Cpu className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-arena-muted" />
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-full appearance-none rounded-lg border border-arena-line bg-arena-black/72 pl-10 pr-9 text-sm font-semibold text-arena-text outline-none transition focus:border-arena-purple focus:ring-2 focus:ring-arena-purple/24"
        >
          {MODEL_OPTIONS.map((option: ModelOption) => (
            <option key={option.id} value={option.id} className="bg-arena-panel text-arena-text">
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-arena-muted" />
      </div>
      <span className="mt-2 block min-h-4 text-xs leading-4 text-arena-muted">{selected.bestFor}</span>
    </label>
  );
}
