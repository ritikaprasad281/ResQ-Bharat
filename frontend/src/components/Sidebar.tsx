import { motion } from "framer-motion";
import { Droplets, MapPin, Waves } from "lucide-react";
import type { Pilot, Risk } from "../types";
import { pct, riskColor } from "../lib";

interface Props {
  pilots: Pilot[];
  selected: string;
  onSelect: (id: string) => void;
  risk?: Risk;
}

export default function Sidebar({ pilots, selected, onSelect, risk }: Props) {
  return (
    <aside className="glass w-72 shrink-0 flex flex-col gap-4 p-4 overflow-y-auto">
      <div className="flex items-center gap-2">
        <div className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700">
          <Waves className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold leading-tight">Ganga Flood</h1>
          <p className="text-[11px] text-slate-400">Intelligence Platform</p>
        </div>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">
          Pilot basins
        </p>
        <div className="flex flex-col gap-2">
          {pilots.map((p) => {
            const active = p.id === selected;
            return (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                className={`text-left rounded-xl px-3 py-2.5 border transition ${
                  active
                    ? "bg-ink-600 border-sky-500/50"
                    : "bg-ink-800/50 border-transparent hover:border-slate-600"
                }`}
              >
                <div className="flex items-center gap-2">
                  <MapPin
                    className={`h-4 w-4 ${
                      active ? "text-sky-400" : "text-slate-500"
                    }`}
                  />
                  <span className="text-sm font-medium">{p.tributary}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 pl-6">
                  {p.name}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {risk && (
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
                {pct(risk.probability)} probability
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
            <Droplets className="h-3.5 w-3.5 text-sky-400" />
            7-day forecast: {risk.rainfall.forecast_7d_mm} mm
          </div>
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
