"use client";

import { Send, UserRound } from "lucide-react";
import { useState } from "react";

import { submitHumanArgument } from "@/lib/api";

import { useDebateStore } from "@/hooks/useDebateStore";
import type { DebateLanguage } from "@/lib/types";

interface HumanArgumentComposerProps {
  debateId: string;
  language: DebateLanguage;
}

export default function HumanArgumentComposer({ debateId, language }: HumanArgumentComposerProps) {
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setError = useDebateStore((state) => state.setError);
  const remaining = 900 - text.length;
  const canSubmit = text.trim().length >= 10 && remaining >= 0 && !isSubmitting;
  const isArabic = language === "ar";

  async function handleSubmit(): Promise<void> {
    if (!canSubmit) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await submitHumanArgument(debateId, text.trim());
      setText("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not submit your argument.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-arena-line bg-arena-panel/88 p-4 shadow-glow">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-arena-text">
          <UserRound className="h-4 w-4 text-arena-teal" />
          {isArabic ? "دورك - اكتب حجة الطرف المؤيد" : "Your turn - write the next PRO argument"}
        </h2>
        <span className={`font-mono text-xs ${remaining < 80 ? "text-arena-amber" : "text-arena-muted"}`}>
          {remaining}
        </span>
      </div>
      <textarea
        value={text}
        maxLength={900}
        onChange={(event) => setText(event.target.value)}
        dir={isArabic ? "rtl" : "ltr"}
        placeholder={
          isArabic
            ? "اكتب ادعاء واضحا، ورد على الخصم، وادعم حجتك بدليل..."
            : "Make a clear claim, answer the opponent, and support it with evidence..."
        }
        className="min-h-28 w-full resize-none rounded-lg border border-arena-line bg-arena-black/70 p-4 text-sm leading-6 text-arena-text outline-none transition placeholder:text-arena-muted/54 focus:border-arena-teal focus:ring-2 focus:ring-arena-teal/20"
      />
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-lg border border-arena-teal/40 bg-arena-teal px-4 py-2 text-sm font-bold text-arena-black transition hover:bg-arena-teal/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          Submit argument
        </button>
      </div>
    </section>
  );
}
