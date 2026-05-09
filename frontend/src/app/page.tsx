"use client";

import { ArrowRight, History, Loader2, Radio, Swords } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import LanguageSelector from "@/components/LanguageSelector";
import ModeSelector from "@/components/ModeSelector";
import ModelSelector from "@/components/ModelSelector";
import { createDebate } from "@/lib/api";
import type { DebateLanguage, DebateMode } from "@/lib/types";
import { MODEL_OPTIONS } from "@/lib/types";

interface RecentDebate {
  debateId: string;
  topic: string;
  createdAt: string;
}

const RECENT_KEY = "ai-debate-arena:recent";

function readRecentDebates(): RecentDebate[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item: unknown): item is RecentDebate => {
        if (typeof item !== "object" || item === null) {
          return false;
        }
        const candidate = item as Partial<Record<keyof RecentDebate, unknown>>;
        return (
          typeof candidate.debateId === "string" &&
          typeof candidate.topic === "string" &&
          typeof candidate.createdAt === "string"
        );
      }
    );
  } catch {
    return [];
  }
}

function storeRecentDebate(debate: RecentDebate): RecentDebate[] {
  const next = [debate, ...readRecentDebates().filter((item) => item.debateId !== debate.debateId)].slice(0, 5);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export default function HomePage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [recent, setRecent] = useState<RecentDebate[]>([]);
  const [proModel, setProModel] = useState(MODEL_OPTIONS[0].id);
  const [conModel, setConModel] = useState(MODEL_OPTIONS[1].id);
  const [judgeModel, setJudgeModel] = useState(MODEL_OPTIONS[0].id);
  const [mode, setMode] = useState<DebateMode>("AI_VS_AI");
  const [language, setLanguage] = useState<DebateLanguage>("en");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = 200 - topic.length;
  const canSubmit = topic.trim().length >= 3 && remaining >= 0 && !isLoading;

  useEffect(() => {
    setRecent(readRecentDebates());
  }, []);

  async function handleSubmit(): Promise<void> {
    if (!canSubmit) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const created = await createDebate({
        topic: topic.trim(),
        max_rounds: 5,
        pro_model: proModel,
        con_model: conModel,
        judge_model: judgeModel,
        mode,
        human_side: mode === "HUMAN_VS_AI" ? "PRO" : null,
        language
      });
      const nextRecent = storeRecentDebate({
        debateId: created.debate_id,
        topic: topic.trim(),
        createdAt: new Date().toISOString()
      });
      setRecent(nextRecent);
      router.push(`/debate/${created.debate_id}`);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Could not create debate.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="premium-grid min-h-screen text-arena-text">
      <section className="mx-auto grid min-h-screen w-full max-w-7xl content-center gap-8 px-5 py-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-center">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-lg border border-arena-purple/40 bg-arena-purple/16">
              <Swords className="h-6 w-6 text-arena-purple" />
            </div>
            <div>
              <h1 className="font-display text-4xl font-black text-arena-text sm:text-6xl">AI Debate Arena</h1>
              <p className="animate-tagline font-mono text-sm text-arena-muted">
                Live agents. Real judging. Audience pressure.
              </p>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="font-display text-5xl font-black leading-tight text-arena-text">
              Configure a live model debate.
            </p>
            <p className="mt-5 text-base leading-7 text-arena-muted">
              Pick distinct models for each side and the judge, then watch the arena score reasoning quality in real time.
            </p>
          </div>

          <section className="mt-10 rounded-lg border border-arena-line bg-arena-panel/58 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-arena-text">
                <History className="h-4 w-4 text-arena-teal" />
                Recent debates
              </h2>
              <span className="font-mono text-xs text-arena-muted">{recent.length}/5</span>
            </div>
            <div className="grid gap-2 font-mono text-xs">
              {recent.length > 0 ? (
                recent.map((item) => (
                  <button
                    key={item.debateId}
                    type="button"
                    onClick={() => router.push(`/debate/${item.debateId}`)}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-arena-line bg-arena-black/44 px-3 py-3 text-left text-arena-muted transition hover:border-arena-purple/60 hover:text-arena-text"
                  >
                    <span className="truncate">{item.topic}</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </button>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-arena-line px-3 py-4 text-arena-muted">
                  No local debates yet.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="rounded-lg border border-arena-line bg-arena-panel/84 p-4 shadow-glow sm:p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-arena-text">Debate Control Room</h2>
              <p className="mt-2 text-sm text-arena-muted">
                Choose models, mode, and topic before the debate enters the arena.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-md border border-arena-teal/40 bg-arena-teal/12 px-3 py-2 font-mono text-xs text-arena-teal">
              <Radio className="h-4 w-4" />
              fallback ready
            </span>
          </div>

          <label htmlFor="topic" className="mb-3 block text-sm font-semibold text-arena-text">
            Debate topic
          </label>
          <textarea
            id="topic"
            value={topic}
            maxLength={200}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Should governments regulate artificial intelligence development?"
            className="min-h-40 w-full resize-none rounded-lg border border-arena-line bg-arena-black/70 p-5 text-xl leading-8 text-arena-text outline-none transition placeholder:text-arena-muted/54 focus:border-arena-purple focus:ring-2 focus:ring-arena-purple/24"
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <ModeSelector value={mode} onChange={setMode} />
            </div>
            <div className="md:col-span-2">
              <LanguageSelector value={language} onChange={setLanguage} />
            </div>
            <ModelSelector id="pro-model" label="PRO model" value={proModel} onChange={setProModel} />
            <ModelSelector id="con-model" label="CON model" value={conModel} onChange={setConModel} />
            <div className="md:col-span-2">
              <ModelSelector id="judge-model" label="Judge model" value={judgeModel} onChange={setJudgeModel} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <span className={`font-mono text-xs ${remaining < 20 ? "text-arena-amber" : "text-arena-muted"}`}>
              {remaining} characters remaining
            </span>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              className="inline-flex min-w-44 items-center justify-center gap-2 rounded-lg border border-arena-teal/40 bg-arena-teal px-5 py-3 text-sm font-bold text-arena-black transition hover:bg-arena-teal/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Start Debate
            </button>
          </div>
          {error ? <p className="mt-4 text-sm text-arena-red">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}
