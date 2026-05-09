"use client";

import { Languages } from "lucide-react";

import type { DebateLanguage } from "@/lib/types";

interface LanguageSelectorProps {
  value: DebateLanguage;
  onChange: (value: DebateLanguage) => void;
}

export default function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase text-arena-muted">
        <Languages className="h-3.5 w-3.5" />
        Language
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { value: "en" as const, label: "English", meta: "LTR" },
          { value: "ar" as const, label: "Arabic", meta: "RTL" }
        ].map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-lg border px-3 py-3 text-left transition ${
                selected
                  ? "border-arena-teal bg-arena-teal/12"
                  : "border-arena-line bg-arena-black/54 hover:border-arena-purple/60"
              }`}
            >
              <span className="block text-sm font-semibold text-arena-text">{option.label}</span>
              <span className="mt-1 block font-mono text-[11px] text-arena-muted">{option.meta}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
