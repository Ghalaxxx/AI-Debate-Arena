"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { getDebateState } from "@/lib/api";
import type { Argument, ArgumentScore, DebateState } from "@/lib/types";

import ArgumentCard from "./ArgumentCard";

interface DebateReplayProps {
  debateId: string;
}

type ReplaySpeed = 1 | 1.5 | 2;

type ReplayEvent =
  | { type: "STATE"; label: string; argumentId?: string }
  | { type: "ARGUMENT"; argument: Argument }
  | { type: "JUDGING"; argument: Argument }
  | { type: "SCORE"; argument: Argument; score: ArgumentScore }
  | { type: "ENDED"; label: string };

function buildReplayEvents(state: DebateState): ReplayEvent[] {
  const events: ReplayEvent[] = [];
  for (const argument of state.arguments) {
    events.push({ type: "STATE", label: `${argument.debater} TURN`, argumentId: argument.argument_id });
    events.push({ type: "ARGUMENT", argument });
    events.push({ type: "JUDGING", argument });
    const score = state.scores.find((item) => item.argument_id === argument.argument_id);
    if (score) {
      events.push({ type: "SCORE", argument, score });
    }
  }
  events.push({ type: "ENDED", label: `Winner: ${state.winner ?? "pending"}` });
  return events;
}

function intervalFor(speed: ReplaySpeed): number {
  return Math.round(1600 / speed);
}

export default function DebateReplay({ debateId }: DebateReplayProps) {
  const [state, setState] = useState<DebateState | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const next = await getDebateState(debateId);
        if (!cancelled) {
          setState(next);
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Could not load replay.";
        setError(message);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [debateId]);

  const events = useMemo(() => (state ? buildReplayEvents(state) : []), [state]);
  const visibleEvents = events.slice(0, currentIndex + 1);
  const visibleArguments = visibleEvents
    .filter((event): event is Extract<ReplayEvent, { type: "ARGUMENT" | "JUDGING" | "SCORE" }> =>
      ["ARGUMENT", "JUDGING", "SCORE"].includes(event.type)
    )
    .map((event) => event.argument)
    .filter((argument, index, all) => all.findIndex((item) => item.argument_id === argument.argument_id) === index);
  const visibleScores = Object.fromEntries(
    visibleEvents
      .filter((event): event is Extract<ReplayEvent, { type: "SCORE" }> => event.type === "SCORE")
      .map((event) => [event.score.argument_id, event.score])
  );
  const activeEvent = events[currentIndex];
  const activeArgumentId =
    activeEvent?.type === "STATE"
      ? activeEvent.argumentId
      : activeEvent?.type === "ARGUMENT" || activeEvent?.type === "JUDGING" || activeEvent?.type === "SCORE"
        ? activeEvent.argument.argument_id
        : null;

  useEffect(() => {
    if (!isPlaying || events.length === 0) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setCurrentIndex((index) => {
        if (index >= events.length - 1) {
          setIsPlaying(false);
          return index;
        }
        return index + 1;
      });
    }, intervalFor(speed));
    return () => window.clearInterval(timer);
  }, [events.length, isPlaying, speed]);

  if (error) {
    return <main className="grid min-h-screen place-items-center bg-arena-black text-arena-red">{error}</main>;
  }

  if (!state) {
    return <main className="grid min-h-screen place-items-center bg-arena-black text-arena-muted">Loading replay</main>;
  }

  return (
    <main className="premium-grid min-h-screen p-5 text-arena-text" dir={state.language === "ar" ? "rtl" : "ltr"}>
      <section className="mx-auto grid max-w-6xl gap-5">
        <header className="rounded-lg border border-arena-line bg-arena-panel/88 p-5 shadow-glow">
          <p className="font-mono text-xs text-arena-muted">Replay Mode</p>
          <h1 className="mt-2 text-3xl font-bold text-arena-text">{state.topic}</h1>
          <p className="mt-2 font-mono text-xs text-arena-muted">
            Step {Math.min(currentIndex + 1, events.length)} of {events.length} / {activeEvent?.type ?? "READY"}
          </p>
        </header>

        <section className="rounded-lg border border-arena-line bg-arena-panel/88 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlaying((value) => !value)}
                className="inline-flex items-center gap-2 rounded-lg border border-arena-teal/40 bg-arena-teal px-4 py-2 text-sm font-bold text-arena-black"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentIndex(0);
                  setIsPlaying(false);
                }}
                className="grid h-10 w-10 place-items-center rounded-lg border border-arena-line bg-arena-black/50 text-arena-muted"
                aria-label="Reset replay"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {([1, 1.5, 2] as ReplaySpeed[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSpeed(item)}
                  className={`rounded-md border px-3 py-2 font-mono text-xs ${
                    speed === item
                      ? "border-arena-purple bg-arena-purple/18 text-arena-text"
                      : "border-arena-line bg-arena-black/50 text-arena-muted"
                  }`}
                >
                  {item}x
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="arena-scroll min-h-[560px] overflow-y-auto rounded-lg border border-arena-line bg-arena-black/58 p-5">
          <div className="space-y-4">
            {visibleArguments.map((argument) => (
              <div
                key={argument.argument_id}
                className={`flex ${argument.debater === "PRO" ? "justify-start pr-8" : "justify-end pl-8"}`}
              >
                <div className="w-full max-w-2xl">
                  <ArgumentCard
                    argument={argument}
                    score={visibleScores[argument.argument_id] ?? null}
                    isLatest={argument.argument_id === activeArgumentId}
                    language={state.language}
                  />
                </div>
              </div>
            ))}
            {activeEvent?.type === "JUDGING" ? (
              <div className="mx-auto w-fit rounded-lg border border-arena-purple/50 bg-arena-panel px-5 py-3 font-mono text-sm text-arena-teal">
                JUDGING...
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
