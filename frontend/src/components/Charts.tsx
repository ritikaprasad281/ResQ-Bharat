import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import type { Damage, Rainfall } from "../types";

const SCENARIO_COLORS: Record<string, string> = {
  "1in10": "#eab308",
  "1in25": "#f97316",
  "1in100": "#ef4444",
};

export function DamageChart({ damage }: { damage: Damage }) {
  const data = Object.entries(damage.scenarios).map(([k, v]) => ({
    name: k.replace("1in", "1-in-"),
    crore: v.est_damage_crore,
    key: k,
  }));
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2740" />
        <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            background: "#0f1524",
            border: "1px solid #1e2740",
            borderRadius: 8,
            color: "#e5e7eb",
          }}
          formatter={(v: number) => [`₹${v} Cr`, "Est. damage"]}
        />
        <Bar dataKey="crore" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.key} fill={SCENARIO_COLORS[d.key] ?? "#f97316"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RainfallChart({ rainfall }: { rainfall: Rainfall }) {
  const data = rainfall.dates.map((d, i) => ({
    date: d.slice(5),
    mm: rainfall.daily_mm[i] ?? 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="rain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.7} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2740" />
        <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} />
        <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
        <Tooltip
          contentStyle={{
            background: "#0f1524",
            border: "1px solid #1e2740",
            borderRadius: 8,
            color: "#e5e7eb",
          }}
          formatter={(v: number) => [`${v} mm`, "Rainfall"]}
        />
        <Area
          type="monotone"
          dataKey="mm"
          stroke="#38bdf8"
          strokeWidth={2}
          fill="url(#rain)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
