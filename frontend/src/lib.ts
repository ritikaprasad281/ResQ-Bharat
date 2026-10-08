import type { RiskLevel } from "./types";

export const RISK_COLORS: Record<RiskLevel, string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f97316",
  severe: "#ef4444",
};

// Map confidence/risk class (1-4) to a fill color for the map polygons.
export const CLASS_COLORS = ["#3b82f6", "#eab308", "#f97316", "#ef4444"];

export function riskColor(level: RiskLevel): string {
  return RISK_COLORS[level];
}

export function formatCrore(crore: number): string {
  if (crore >= 1000) return `₹${(crore / 1000).toFixed(2)}k Cr`;
  return `₹${crore.toFixed(1)} Cr`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-IN");
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}
