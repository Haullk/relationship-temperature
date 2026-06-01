import type { DailyTrendPoint } from "./types";

export interface ChartPoint {
  x: number;
  y: number;
  date: string;
  temperature: number;
}

export function chartPoints(trend: DailyTrendPoint[], width: number, height: number, padding = 28): ChartPoint[] {
  if (trend.length === 0) {
    return [];
  }
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const denominator = Math.max(trend.length - 1, 1);
  return trend.map((point, index) => ({
    x: padding + (index / denominator) * plotWidth,
    y: padding + ((100 - point.relationship_temperature) / 100) * plotHeight,
    date: point.date,
    temperature: point.relationship_temperature
  }));
}

export function chartPath(points: ChartPoint[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

