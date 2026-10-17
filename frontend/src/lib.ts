import type { RiskLevel, Coverage } from "./types";

export const RISK_COLORS: Record<RiskLevel, string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f97316",
  severe: "#ef4444",
};

// Data-coverage status shown in the region selector and status badges.
export const COVERAGE_META: Record<
  Coverage,
  { label: string; short: string; dot: string; text: string; note: string }
> = {
  live: {
    label: "Live data available",
    short: "Live",
    dot: "#22c55e",
    text: "text-emerald-300",
    note: "Live rainfall, modelled susceptibility and satellite observations; model validated against recorded floods in this basin.",
  },
  modelled: {
    label: "Modelled coverage",
    short: "Modelled",
    dot: "#38bdf8",
    text: "text-sky-300",
    note: "Live rainfall, modelled susceptibility and satellite observations are computed for this area, but there is no local flood-event validation yet.",
  },
  partial: {
    label: "Partial coverage",
    short: "Partial",
    dot: "#f59e0b",
    text: "text-amber-300",
    note: "Selectable and rainfall-aware, but precise river geometry and local flood-hazard mapping are still being integrated for this steep corridor.",
  },
};

export function coverageOf(c?: Coverage) {
  return COVERAGE_META[c ?? "live"];
}

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

// Compact Indian-unit currency, e.g. ₹1.25 crore / ₹12.4 lakh / ₹45,000.
export function formatINRCompact(inr: number): string {
  if (!Number.isFinite(inr) || inr <= 0) return "₹0";
  if (inr >= 1e7) return `₹${(inr / 1e7).toFixed(2)} crore`;
  if (inr >= 1e5) return `₹${(inr / 1e5).toFixed(1)} lakh`;
  return `₹${Math.round(inr).toLocaleString("en-IN")}`;
}

// Full rupee value with Indian digit grouping (for tooltips / detail rows).
export function formatINRFull(inr: number): string {
  return `₹${Math.round(inr).toLocaleString("en-IN")}`;
}

// Hectares with Indian grouping and unit suffix.
export function formatHa(ha: number): string {
  return `${Math.round(ha).toLocaleString("en-IN")} ha`;
}

// Severity palette for the agricultural-loss dashboard.
export const SEVERITY_COLORS: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f97316",
  severe: "#ef4444",
};

export const SEVERITY_LABELS: Record<string, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe",
};

// Short human-readable "time ago" for data-freshness labels.
export function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} d ago`;
}
