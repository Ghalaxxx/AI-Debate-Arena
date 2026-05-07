"use client";

import { ArrowRight, History, Loader2, Swords } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createDebate } from "@/lib/api";

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
        pro_model: "claude-sonnet-4-20250514",
        con_model: "claude-sonnet-4-20250514",
        judge_model: "claude-sonnet-4-20250514"
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
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-5 py-10">
        <div className="mb-10 flex items-center justify-center gap-3">
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

        <div className="rounded-lg border border-arena-line bg-arena-panel/84 p-4 shadow-glow sm:p-6">
          <label htmlFor="topic" className="mb-3 block text-sm font-semibold text-arena-text">
            Debate topic
          </label>
          <textarea
            id="topic"
            value={topic}
            maxLength={200}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Should governments regulate artificial intelligence development?"
            className="min-h-44 w-full resize-none rounded-lg border border-arena-line bg-arena-black/70 p-5 text-xl leading-8 text-arena-text outline-none transition placeholder:text-arena-muted/54 focus:border-arena-purple focus:ring-2 focus:ring-arena-purple/24"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className={`font-mono text-xs ${remaining < 20 ? "text-arena-amber" : "text-arena-muted"}`}>
              {remaining} characters remaining
            </span>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              className="inline-flex min-w-40 items-center justify-center gap-2 rounded-lg border border-arena-teal/40 bg-arena-teal/16 px-5 py-3 text-sm font-bold text-arena-text transition hover:border-arena-teal hover:bg-arena-teal/24 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Start Debate
            </button>
          </div>
          {error ? <p className="mt-4 text-sm text-arena-red">{error}</p> : null}
        </div>

        <section className="mt-8 rounded-lg border border-arena-line bg-arena-panel/58 p-4">
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
      </section>
    </main>
  );
}
