"use client";

import { Loader2, PlusCircle } from "lucide-react";
import { useState } from "react";

import TournamentBracket from "@/components/TournamentBracket";
import { createTournament } from "@/lib/api";
import type { TournamentState } from "@/lib/types";

const defaultTopics = [
  "Should governments regulate artificial intelligence development?",
  "Should social media platforms verify all political ads?",
  "Should cities ban private cars from downtown cores?",
  "Should universities require AI literacy courses?"
];

export default function TournamentPage() {
  const [topics, setTopics] = useState(defaultTopics);
  const [tournament, setTournament] = useState<TournamentState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setTopic(index: number, value: string): void {
    setTopics((current) => current.map((topic, itemIndex) => (itemIndex === index ? value : topic)));
  }

  function setSize(size: 4 | 8): void {
    setTopics((current) => {
      if (size === 4) {
        return current.slice(0, 4);
      }
      return [
        ...current,
        "Should public agencies use open-source AI models?",
        "Should autonomous vehicles be allowed in school zones?",
        "Should biometric surveillance be banned in public spaces?",
        "Should AI-generated media require visible labels?"
      ].slice(0, 8);
    });
  }

  async function handleCreate(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const created = await createTournament(topics);
      setTournament(created);
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Could not create tournament.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="premium-grid min-h-screen p-5 text-arena-text">
      <section className="mx-auto grid max-w-6xl gap-5">
        <header className="rounded-lg border border-arena-line bg-arena-panel/88 p-5 shadow-glow">
          <p className="font-mono text-xs text-arena-muted">Tournament Mode</p>
          <h1 className="mt-2 text-3xl font-bold text-arena-text">Create a debate bracket</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-arena-muted">
            Start with 4 or 8 topics. This phase builds the bracket model and visualization; automated match-running can
            be layered in next.
          </p>
        </header>

        <section className="rounded-lg border border-arena-line bg-arena-panel/88 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSize(4)}
                className={`rounded-md border px-3 py-2 font-mono text-xs ${
                  topics.length === 4 ? "border-arena-teal bg-arena-teal/12 text-arena-teal" : "border-arena-line"
                }`}
              >
                4 topics
              </button>
              <button
                type="button"
                onClick={() => setSize(8)}
                className={`rounded-md border px-3 py-2 font-mono text-xs ${
                  topics.length === 8 ? "border-arena-teal bg-arena-teal/12 text-arena-teal" : "border-arena-line"
                }`}
              >
                8 topics
              </button>
            </div>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-arena-teal/40 bg-arena-teal px-4 py-2 text-sm font-bold text-arena-black disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
              Build bracket
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {topics.map((topic, index) => (
              <label key={index} className="block">
                <span className="mb-2 block font-mono text-[11px] text-arena-muted">Seed {index + 1}</span>
                <input
                  value={topic}
                  onChange={(event) => setTopic(index, event.target.value)}
                  className="h-12 w-full rounded-lg border border-arena-line bg-arena-black/70 px-3 text-sm text-arena-text outline-none focus:border-arena-purple"
                />
              </label>
            ))}
          </div>
          {error ? <p className="mt-4 text-sm text-arena-red">{error}</p> : null}
        </section>

        {tournament ? <TournamentBracket tournament={tournament} /> : null}
      </section>
    </main>
  );
}
