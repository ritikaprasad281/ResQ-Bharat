import { useState } from "react";
import type { ReactNode } from "react";
import { Building2, IndianRupee, Target, Users } from "lucide-react";
import type { Damage, FloodEvent, Risk, Validation } from "../types";
import { formatNumber, pct } from "../lib";
import { DamageChart, RainfallChart } from "./Charts";
import AiPanel from "./AiPanel";

interface Props {
  pilot: string;
  damage?: Damage;
  risk?: Risk;
  events: FloodEvent[];
  validation?: Validation;
  onValidate: (event: string) => void;
  validating: boolean;
}

export default function DetailPanel({
  pilot,
  damage,
  risk,
  events,
  validation,
  onValidate,
  validating,
}: Props) {
  const [scenario, setScenario] = useState("1in25");
  const sc = damage?.scenarios[scenario];

  return (
    <div className="glass w-[360px] shrink-0 flex flex-col gap-4 p-4 overflow-y-auto">
      <section>
        <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">
          Exposure & damage
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Stat
            icon={<Users className="h-4 w-4" />}
            label="Population"
            value={damage ? formatNumber(damage.population_exposed) : "—"}
            tint="text-sky-400"
          />
          <Stat
            icon={<Building2 className="h-4 w-4" />}
            label="Buildings"
            value={damage ? formatNumber(damage.buildings_exposed) : "—"}
            tint="text-emerald-400"
          />
          <Stat
            icon={<IndianRupee className="h-4 w-4" />}
            label={`Damage (${scenario.replace("1in", "1-in-")})`}
            value={sc ? `₹${sc.est_damage_crore} Cr` : "—"}
            tint="text-amber-400"
          />
          <Stat
            icon={<Target className="h-4 w-4" />}
            label="Life-risk index"
            value={sc ? `${sc.life_risk_index}` : "—"}
            tint="text-rose-400"
          />
        </div>
      </section>

      <section>
        <div className="flex items-center gap-1.5 mb-2">
          {damage &&
            Object.keys(damage.scenarios).map((k) => (
              <button
                key={k}
                onClick={() => setScenario(k)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                  scenario === k
                    ? "bg-ink-600 border-amber-500/50 text-amber-300"
                    : "bg-ink-800/50 border-transparent text-slate-400 hover:border-slate-600"
                }`}
              >
                {k.replace("1in", "1-in-")}
              </button>
            ))}
        </div>
        {damage && <DamageChart damage={damage} />}
      </section>

      {risk && (
        <section>
          <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">
            Rainfall (past 3d + 7d forecast)
          </p>
          <RainfallChart rainfall={risk.rainfall} />
        </section>
      )}

      <section>
        <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">
          Model confidence
        </p>
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          {events.map((e) => (
            <button
              key={e.id}
              onClick={() => onValidate(e.id)}
              disabled={validating}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-ink-800/50 border border-transparent hover:border-sky-600 text-slate-300 disabled:opacity-50"
            >
              {e.label}
            </button>
          ))}
        </div>
        {validating && (
          <p className="text-[12px] text-slate-500">Validating against SAR…</p>
        )}
        {validation && (
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Precision" value={pct(validation.precision)} />
            <Metric label="Recall" value={pct(validation.recall)} />
            <Metric label="IoU" value={pct(validation.iou)} />
          </div>
        )}
      </section>

      <AiPanel pilot={pilot} />

      {damage && (
        <p className="text-[10px] text-slate-600 leading-relaxed">
          {damage.disclaimer}
        </p>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className="rounded-xl bg-ink-800/60 border border-white/5 p-3">
      <div className={`flex items-center gap-1.5 ${tint}`}>{icon}</div>
      <div className="text-base font-bold mt-1.5">{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-800/60 border border-white/5 p-2.5 text-center">
      <div className="text-lg font-bold text-sky-300">{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}
