import { useEffect, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, CalendarClock, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import type { Forecast } from "../types";
import { riskColor, pct } from "../lib";

interface Props {
  pilot: string;
}

const TREND = {
  rising: { icon: TrendingUp, color: "text-rose-400", key: "rising" },
  falling: { icon: TrendingDown, color: "text-emerald-400", key: "falling" },
  steady: { icon: Minus, color: "text-slate-400", key: "steady" },
} as const;

export default function ForecastTimeline({ pilot }: Props) {
  const { t: tr } = useTranslation();
  const [data, setData] = useState<Forecast>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .forecast(pilot)
      .then((f) => active && setData(f))
      .catch(() => undefined)
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [pilot]);

  if (loading) {
    return (
      <div className="rounded-xl bg-ink-800/60 border border-white/5 p-4 flex items-center gap-2 text-[12px] text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
        {tr("forecast.projecting")}
      </div>
    );
  }
  if (!data || data.series.length === 0) return null;

  const chart = data.series.map((d) => ({
    date: d.date.slice(5),
    rain: d.rainfall_mm,
    risk: Math.round(d.risk * 100),
    color: riskColor(d.level),
  }));
  const t = TREND[data.trend];
  const TrendIcon = t.icon;
  const peak = data.peak_72h;

  return (
    <div className="rounded-xl bg-ink-800/60 border border-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-sky-400" />
          <span className="text-sm font-semibold">{tr("forecast.outlook")}</span>
        </div>
        <span className={`flex items-center gap-1 text-[11px] font-medium ${t.color}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          {tr(`forecast.trend.${t.key}`)}
        </span>
      </div>

      {peak && (
        <div
          className="mb-3 rounded-lg px-3 py-2 text-[12px]"
          style={{ background: `${riskColor(peak.level)}1a` }}
        >
          <span className="text-slate-300">{tr("forecast.peakPrefix")}</span>
          <span className="font-bold" style={{ color: riskColor(peak.level) }}>
            {pct(peak.risk)} ({tr(`risk.${peak.level}`, { defaultValue: peak.level })})
          </span>
          <span className="text-slate-400">{tr("forecast.peakOn", { date: peak.date.slice(5) })}</span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={170}>
        <ComposedChart data={chart} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2740" />
          <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} />
          <YAxis
            yAxisId="risk"
            domain={[0, 100]}
            tick={{ fill: "#94a3b8", fontSize: 10 }}
          />
          <YAxis yAxisId="rain" orientation="right" hide />
          <Tooltip
            contentStyle={{
              background: "#0f1524",
              border: "1px solid #1e2740",
              borderRadius: 8,
              color: "#e5e7eb",
              fontSize: 12,
            }}
            formatter={(v: number, name: string) =>
              name === "risk"
                ? [`${v}%`, tr("forecast.risk")]
                : [`${v} mm`, tr("forecast.rainfall")]
            }
          />
          <Bar
            yAxisId="rain"
            dataKey="rain"
            radius={[3, 3, 0, 0]}
            opacity={0.35}
            fill="#38bdf8"
          />
          <Line
            yAxisId="risk"
            type="monotone"
            dataKey="risk"
            stroke="#f472b6"
            strokeWidth={2.5}
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const { cx, cy, index } = props;
              const c = chart[index ?? 0]?.color ?? "#f472b6";
              return (
                <circle
                  key={index}
                  cx={cx}
                  cy={cy}
                  r={3.5}
                  fill={c}
                  stroke="#0a0e1a"
                  strokeWidth={1}
                />
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-1.5 text-[10px] text-slate-500">{tr("forecast.chartNote")}</p>
    </div>
  );
}
