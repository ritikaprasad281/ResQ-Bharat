import { motion } from "framer-motion";
import { Droplets, Loader2, AlertTriangle } from "lucide-react";
import type { Pilot, Risk, TopRiskItem } from "../types";
import { pct, riskColor, coverageOf, timeAgo } from "../lib";
import TopRiskPanel from "./TopRiskPanel";
import LocationSearch from "./LocationSearch";

interface Props {
  pilots: Pilot[];
  selected: string;
  onSelect: (id: string) => void;
  risk?: Risk;
  topRisk: TopRiskItem[];
  topLoading: boolean;
}

export default function Sidebar({
  pilots,
  selected,
  onSelect,
  risk,
  topRisk,
  topLoading,
}: Props) {
  const sel = pilots.find((p) => p.id === selected);
  const cov = coverageOf(sel?.coverage);
  return (
    <aside className="glass w-full h-full shrink-0 flex flex-col gap-4 p-4 overflow-y-auto lg:border-r border-white/5">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">
          Select location
        </p>
        <LocationSearch pilots={pilots} value={selected} onSelect={onSelect} />
        {sel && (
          <div className="mt-2 rounded-lg bg-ink-800/50 border border-white/5 px-2.5 py-2">
            <div className="flex items-center gap-2 text-[11px]">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: cov.dot }}
              />
              <span className={`font-medium ${cov.text}`}>{cov.label}</span>
              {sel.region && (
                <span className="ml-auto text-[10px] text-slate-500">
                  {sel.region}
                </span>
              )}
            </div>
            <p className="mt-1 text-[10px] text-slate-500 leading-relaxed">
              {cov.note}
            </p>
          </div>
        )}
      </div>

      <TopRiskPanel
        items={topRisk}
        selected={selected}
        loading={topLoading}
        onSelect={onSelect}
      />

      {!risk ? (
        <div className="rounded-xl bg-ink-800/60 border border-white/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-3">
            Live flood risk
          </p>
          <div className="flex items-center gap-3 text-[12px] text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
            Computing risk…
          </div>
        </div>
      ) : (
        <motion.div
          key={risk.aoi + risk.probability}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-ink-800/60 border border-white/5 p-4"
        >
          <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-3">
            Live flood risk
          </p>
          <div className="flex items-center gap-4">
            <RiskRing value={risk.probability} level={risk.level} />
            <div>
              <div
                className="text-lg font-bold capitalize"
                style={{ color: riskColor(risk.level) }}
              >
                {risk.level}
              </div>
              <div className="text-[11px] text-slate-400">
                {pct(risk.probability)} modelled probability
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
            <Droplets className="h-3.5 w-3.5 text-sky-400" />
            7-day forecast: {risk.rainfall.forecast_7d_mm} mm
          </div>
          {risk.updated_at && (
            <div className="mt-1 text-[10px] text-slate-500">
              Rainfall updated {timeAgo(risk.updated_at)} · Open-Meteo
            </div>
          )}
          {risk.data_quality && !risk.data_quality.rainfall_complete && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-1.5 text-[10px] text-amber-200/90 leading-relaxed">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              Some rainfall days are missing from the feed, so this score may be
              understated. Treat it as provisional.
            </div>
          )}
          <p className="mt-2 text-[10px] text-slate-500 leading-relaxed">
            Model estimate from rainfall &amp; terrain susceptibility — a
            relative index, not a calibrated probability.
          </p>
        </motion.div>
      )}

      <p className="mt-auto text-[10px] text-slate-600 leading-relaxed">
        AI-generated analysis — validate before operational use.
      </p>
    </aside>
  );
}

function RiskRing({ value, level }: { value: number; level: string }) {
  const color = riskColor(level as never);
  const deg = Math.round(value * 360);
  return (
    <div
      className={`relative h-16 w-16 rounded-full grid place-items-center ${
        level === "severe" ? "animate-pulseRing" : ""
      }`}
      style={{
        background: `conic-gradient(${color} ${deg}deg, #1e2740 ${deg}deg)`,
      }}
    >
      <div className="h-12 w-12 rounded-full bg-ink-800 grid place-items-center">
        <span className="text-sm font-bold">{pct(value)}</span>
      </div>
    </div>
  );
}
