import { useState } from "react";
import type { ReactNode } from "react";
import {
  Building2,
  IndianRupee,
  Target,
  Users,
  ChevronDown,
  CloudRain,
  Activity,
  ShieldCheck,
  Info,
} from "lucide-react";
import type { Damage, FloodEvent, Risk, Validation } from "../types";
import { formatNumber, pct, timeAgo } from "../lib";
import { RainfallChart } from "./Charts";
import ForecastTimeline from "./ForecastTimeline";
import { useTranslation } from "react-i18next";

interface Props {
  pilot: string;
  damage?: Damage;
  risk?: Risk;
  events: FloodEvent[];
  validation?: Validation;
  onValidate: (event: string) => void;
  validating: boolean;
  scenario: string;
  onScenario: (s: string) => void;
}

export default function IntelligencePanel({
  pilot,
  damage,
  risk,
  events,
  validation,
  onValidate,
  validating,
  scenario,
  onScenario,
}: Props) {
  const { t } = useTranslation();
  const [outlook, setOutlook] = useState<"rainfall" | "risk">("rainfall");
  const [confOpen, setConfOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const sc = damage?.scenarios[scenario];
  const rpLabel = scenario.replace("1in", "1-in-");

  return (
    <div className="flex flex-col gap-4">
      {/* A. Exposure summary */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">
            {t("intel.panel.exposureDamage")}
          </p>
          <span className="text-[10px] text-slate-500">{t("intel.panel.estimates")}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat
            icon={<Users className="h-4 w-4" />}
            label={t("intel.panel.populationExposed")}
            value={damage ? formatNumber(damage.population_exposed) : "—"}
            tint="text-sky-400"
          />
          <Stat
            icon={<Building2 className="h-4 w-4" />}
            label={t("intel.panel.buildingsExposed")}
            value={damage ? formatNumber(damage.buildings_exposed) : "—"}
            tint="text-emerald-400"
          />
          <Stat
            icon={<IndianRupee className="h-4 w-4" />}
            label={t("intel.panel.damage", { rp: rpLabel })}
            value={sc ? `₹${sc.est_damage_crore} Cr` : "—"}
            tint="text-amber-400"
          />
          <Stat
            icon={<Target className="h-4 w-4" />}
            label={t("intel.panel.lifeRiskIndex", { rp: rpLabel })}
            value={sc ? `${sc.life_risk_index}` : "—"}
            tint="text-rose-400"
          />
        </div>

        {/* Return-period selector — drives the damage + life-risk figures */}
        {damage && (
          <div className="mt-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[10px] text-slate-500">{t("intel.panel.returnPeriod")}</span>
              <span
                className="text-slate-600"
                title={t("intel.panel.returnPeriodTip")}
              >
                <Info className="h-3 w-3" />
              </span>
            </div>
            <div className="inline-flex rounded-lg border border-white/10 bg-ink-900/60 p-0.5">
              {Object.keys(damage.scenarios).map((k) => (
                <button
                  key={k}
                  onClick={() => onScenario(k)}
                  className={`text-[11px] px-2.5 py-1 rounded-md transition ${
                    scenario === k
                      ? "bg-amber-500/20 text-amber-200"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {k.replace("1in", "1-in-")}
                </button>
              ))}
            </div>
            {sc && (
              <p className="mt-2 text-[10px] text-slate-500 leading-relaxed">
                {t("intel.panel.scenarioNote", { rp: rpLabel, depth: sc.depth_m, factor: Math.round(sc.damage_factor * 100) })}
              </p>
            )}
          </div>
        )}
      </section>

      {/* B. Rainfall & flood-risk outlook */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">
            {t("intel.panel.rainfallRiskOutlook")}
          </p>
          <div className="inline-flex rounded-lg border border-white/10 bg-ink-900/60 p-0.5">
            <SegBtn
              active={outlook === "rainfall"}
              onClick={() => setOutlook("rainfall")}
              icon={<CloudRain className="h-3.5 w-3.5" />}
              label={t("intel.panel.rainfall")}
            />
            <SegBtn
              active={outlook === "risk"}
              onClick={() => setOutlook("risk")}
              icon={<Activity className="h-3.5 w-3.5" />}
              label={t("intel.panel.risk")}
            />
          </div>
        </div>

        {outlook === "rainfall" ? (
          risk ? (
            <div className="rounded-xl bg-ink-800/60 border border-white/5 p-3">
              <RainfallChart rainfall={risk.rainfall} />
              <p className="mt-1.5 text-[10px] text-slate-500">
                {t("intel.panel.rainfallNote", { antecedent: risk.rainfall.antecedent_3d_mm, forecast: risk.rainfall.forecast_7d_mm })}
              </p>
            </div>
          ) : (
            <Empty label={t("intel.panel.rainfallUnavailable")} />
          )
        ) : (
          <ForecastTimeline pilot={pilot} />
        )}
      </section>

      {/* C. Model confidence — expandable */}
      <section>
        <button
          onClick={() => setConfOpen((v) => !v)}
          aria-expanded={confOpen}
          className="w-full flex items-center justify-between rounded-xl bg-ink-800/60 border border-white/5 px-3 py-2.5 hover:border-white/15 transition"
        >
          <span className="inline-flex items-center gap-2 text-[12px] font-medium">
            <ShieldCheck className="h-4 w-4 text-sky-400" />
            {t("intel.panel.modelConfidence")}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform ${
              confOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        {confOpen && (
          <div className="mt-2 rounded-xl bg-ink-900/40 border border-white/5 p-3">
            <p className="text-[11px] text-slate-400 mb-2.5 leading-relaxed">
              {t("intel.panel.confidenceNote")}
            </p>
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              {events.map((e) => (
                <button
                  key={e.id}
                  onClick={() => onValidate(e.id)}
                  disabled={validating}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-ink-800/60 border border-transparent hover:border-sky-600 text-slate-300 disabled:opacity-50"
                >
                  {e.label}
                </button>
              ))}
            </div>
            {validating && (
              <p className="text-[12px] text-slate-500">
                {t("intel.panel.validatingSar")}
              </p>
            )}
            {validation && !validating && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Metric label={t("intel.panel.precision")} value={pct(validation.precision)} />
                  <Metric label={t("intel.panel.recall")} value={pct(validation.recall)} />
                  <Metric label={t("intel.panel.iou")} value={pct(validation.iou)} />
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  {t("intel.panel.reference", { event: validation.event_label })}
                </p>
              </>
            )}
            {!validation && !validating && (
              <p className="text-[11px] text-slate-500">
                {t("intel.panel.selectReference")}
              </p>
            )}
          </div>
        )}
      </section>

      {/* D. Methodology & sources */}
      {risk?.methodology && (
        <section>
          <button
            onClick={() => setMethodOpen((v) => !v)}
            aria-expanded={methodOpen}
            className="w-full flex items-center justify-between rounded-xl bg-ink-800/60 border border-white/5 px-3 py-2.5 hover:border-white/15 transition"
          >
            <span className="inline-flex items-center gap-2 text-[12px] font-medium">
              <Info className="h-4 w-4 text-sky-400" />
              {t("intel.panel.methodologySources")}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-slate-400 transition-transform ${
                methodOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {methodOpen && (
            <div className="mt-2 rounded-xl bg-ink-900/40 border border-white/5 p-3 space-y-3">
              <div>
                <p className="font-mono text-[11px] text-sky-300 break-words">
                  {risk.methodology.formula}
                </p>
                <p className="mt-1 text-[10px] text-slate-500 leading-relaxed">
                  rainfall_pressure = {risk.methodology.rainfall_pressure}.
                </p>
                <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                  {risk.methodology.note}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
                  {t("intel.panel.dataSources")}
                </p>
                <ul className="space-y-1.5">
                  {(risk.sources ?? []).map((s) => (
                    <li key={s.name} className="text-[11px] leading-snug">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-200 hover:text-sky-300 underline decoration-dotted underline-offset-2"
                      >
                        {s.name}
                      </a>
                      <span className="text-slate-500">
                        {" "}
                        — {s.kind}, {s.temporal}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {risk.updated_at && (
                <p className="text-[10px] text-slate-500">
                  {t("intel.panel.rainfallFetched", { time: timeAgo(risk.updated_at) })}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {damage && (
        <p className="text-[10px] text-slate-600 leading-relaxed">
          {damage.disclaimer}
        </p>
      )}
    </div>
  );
}

function SegBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md transition ${
        active ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {icon}
      {label}
    </button>
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
      <div className="text-[10px] text-slate-500 leading-tight">{label}</div>
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

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-xl bg-ink-800/60 border border-white/5 p-4 text-center text-[12px] text-slate-500">
      {label}
    </div>
  );
}
