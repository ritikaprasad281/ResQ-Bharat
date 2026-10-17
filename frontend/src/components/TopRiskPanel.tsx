import { motion } from "framer-motion";
import { Flame, Loader2 } from "lucide-react";
import type { TopRiskItem } from "../types";
import { pct, riskColor } from "../lib";

interface Props {
  items: TopRiskItem[];
  selected: string;
  loading: boolean;
  onSelect: (id: string) => void;
}

const RANK_BADGE = ["#ef4444", "#f97316", "#eab308"];

export default function TopRiskPanel({
  items,
  selected,
  loading,
  onSelect,
}: Props) {
  return (
    <section className="rounded-xl bg-ink-800/60 border border-white/5 p-3">
      <div className="flex items-center gap-2 mb-2.5">
        <Flame className="h-4 w-4 text-rose-400" />
        <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
          Top 3 flood-risk zones
        </p>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          live
        </span>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center gap-2 text-[12px] text-slate-500 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
          Ranking the basin…
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((it, i) => {
            const active = it.id === selected;
            return (
              <motion.button
                key={it.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onSelect(it.id)}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 border text-left transition ${
                  active
                    ? "bg-ink-600 border-sky-500/50"
                    : "bg-ink-900/40 border-transparent hover:border-slate-600"
                }`}
              >
                <span
                  className="grid place-items-center h-6 w-6 shrink-0 rounded-md text-[12px] font-bold text-ink-900"
                  style={{ background: RANK_BADGE[i] ?? "#64748b" }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-medium truncate">
                    {it.tributary} · {shortName(it.name)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    7d rain {it.forecast_7d_mm} mm
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className="text-sm font-bold"
                    style={{ color: riskColor(it.level) }}
                  >
                    {pct(it.probability)}
                  </div>
                  <div
                    className="text-[9px] uppercase tracking-wide capitalize"
                    style={{ color: riskColor(it.level) }}
                  >
                    {it.level}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function shortName(name: string): string {
  const parts = name.split("—");
  return (parts[1] ?? parts[0]).trim();
}
