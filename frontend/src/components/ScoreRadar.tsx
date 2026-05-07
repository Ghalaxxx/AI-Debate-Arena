"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer
} from "recharts";

import type { DimensionScores } from "@/lib/types";
import { DIMENSION_KEYS, DIMENSION_LABELS } from "@/lib/types";

interface ScoreRadarProps {
  proScores: DimensionScores;
  conScores: DimensionScores;
  size?: number;
}

export function emptyDimensionScores(): DimensionScores {
  return {
    logical_coherence: 0,
    evidence_quality: 0,
    persuasiveness: 0,
    relevance: 0,
    counterargument: 0,
    originality: 0
  };
}

export default function ScoreRadar({ proScores, conScores, size = 200 }: ScoreRadarProps) {
  const data = DIMENSION_KEYS.map((key) => ({
    axis: DIMENSION_LABELS[key],
    PRO: Math.round(proScores[key] * 100),
    CON: Math.round(conScores[key] * 100)
  }));

  return (
    <div style={{ width: size, height: size }} className="mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="68%">
          <PolarGrid stroke="#292B38" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: "#A8ABB8", fontSize: 11 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="PRO"
            dataKey="PRO"
            stroke="#7F77DD"
            fill="#7F77DD"
            fillOpacity={0.24}
            animationDuration={420}
          />
          <Radar
            name="CON"
            dataKey="CON"
            stroke="#D85A30"
            fill="#D85A30"
            fillOpacity={0.22}
            animationDuration={420}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
