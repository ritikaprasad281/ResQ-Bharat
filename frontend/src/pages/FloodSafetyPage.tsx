import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ShieldCheck,
  Phone,
  CloudRain,
  Waves,
  LifeBuoy,
  Home,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Droplets,
  Package,
  Users,
  ListChecks,
  RotateCcw,
} from "lucide-react";

/* ---------- Static structure; text comes from i18n at render ---------- */

type Phase = {
  id: "before" | "during" | "trapped" | "after";
  icon: typeof CloudRain;
  tint: string;
  warn?: boolean;
};

const PHASES: Phase[] = [
  { id: "before", icon: CloudRain, tint: "text-sky-300" },
  { id: "during", icon: Waves, tint: "text-cyan-300", warn: true },
  { id: "trapped", icon: Home, tint: "text-amber-300", warn: true },
  { id: "after", icon: ShieldCheck, tint: "text-emerald-300" },
];

const KIT: { group: string; items: string[] }[] = [
  { group: "waterFood", items: ["drinkingWater", "nonPerishable", "purificationTablets"] },
  { group: "firstAid", items: ["firstAidKit", "prescriptionMeds", "sanitiserMasks"] },
  { group: "documents", items: ["idDocuments", "cash", "insurance"] },
  { group: "lighting", items: ["torch", "powerBank", "whistle", "radio"] },
  { group: "clothing", items: ["dryClothes", "raincoat", "footwear", "hygiene"] },
  { group: "vulnerable", items: ["babyFood", "mobilityAids", "spareAids"] },
  { group: "pets", items: ["petFood", "leash"] },
];

const PLAN_FIELDS: string[] = [
  "contact1",
  "meeting",
  "outOfArea",
  "route",
  "medical",
  "shelter",
];

const KIT_STORE = "resq.floodkit.v1";
const PLAN_STORE = "resq.floodplan.v1";

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function FloodSafetyPage() {
  const { t } = useTranslation();
  const allItems = useMemo(() => KIT.flatMap((g) => g.items), []);
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    loadJson(KIT_STORE, {})
  );
  const [plan, setPlan] = useState<Record<string, string>>(() =>
    loadJson(PLAN_STORE, {})
  );

  useEffect(() => {
    try {
      localStorage.setItem(KIT_STORE, JSON.stringify(checked));
    } catch {
      /* storage unavailable — checklist still works for this session */
    }
  }, [checked]);

  useEffect(() => {
    try {
      localStorage.setItem(PLAN_STORE, JSON.stringify(plan));
    } catch {
      /* storage unavailable */
    }
  }, [plan]);

  const packed = allItems.filter((i) => checked[i]).length;
  const progress = allItems.length ? Math.round((packed / allItems.length) * 100) : 0;

  const toggle = (item: string) =>
    setChecked((c) => ({ ...c, [item]: !c[item] }));
  const resetKit = () => setChecked({});

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                {t("safety.title")}
              </h1>
              <p className="text-[13px] text-slate-400">
                {t("safety.subtitle")}
              </p>
            </div>
          </div>
          <a
            href="tel:112"
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2.5 text-sm font-bold text-white transition"
          >
            <Phone className="h-4 w-4" /> {t("safety.call112")}
          </a>
        </header>

        {/* Urgent — most important actions first */}
        <section className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-rose-300" />
            <h2 className="text-sm font-bold text-rose-100">
              {t("safety.urgentTitle")}
            </h2>
          </div>
          <ul className="grid sm:grid-cols-2 gap-x-5 gap-y-1.5">
            {(t("safety.urgent", { returnObjects: true }) as string[]).map((u) => (
              <li
                key={u}
                className="flex items-start gap-2 text-[13px] text-rose-50/90"
              >
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />
                {u}
              </li>
            ))}
          </ul>
        </section>

        {/* Section jump nav */}
        <nav className="flex flex-wrap gap-2">
          {PHASES.map((p) => (
            <a
              key={p.id}
              href={`#${p.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-900/60 hover:border-white/25 px-3 py-1.5 text-[12px] text-slate-300"
            >
              <p.icon className={`h-3.5 w-3.5 ${p.tint}`} />
              {t(`safety.phase.${p.id}.title`)}
            </a>
          ))}
          <a
            href="#kit"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-900/60 hover:border-white/25 px-3 py-1.5 text-[12px] text-slate-300"
          >
            <Package className="h-3.5 w-3.5 text-violet-300" /> {t("safety.kitNav")}
          </a>
          <a
            href="#plan"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-900/60 hover:border-white/25 px-3 py-1.5 text-[12px] text-slate-300"
          >
            <Users className="h-3.5 w-3.5 text-cyan-300" /> {t("safety.planNav")}
          </a>
        </nav>

        {/* Phase guides */}
        <div className="grid md:grid-cols-2 gap-4">
          {PHASES.map((p) => (
            <section
              key={p.id}
              id={p.id}
              className="glass rounded-2xl p-4 scroll-mt-20"
            >
              <div className="flex items-center gap-2 mb-2.5">
                <p.icon className={`h-5 w-5 ${p.tint}`} />
                <h2 className="font-bold">{t(`safety.phase.${p.id}.title`)}</h2>
              </div>
              <ul className="space-y-1.5">
                {(
                  t(`safety.phase.${p.id}.items`, { returnObjects: true }) as string[]
                ).map((it) => (
                  <li
                    key={it}
                    className="flex items-start gap-2 text-[13px] text-slate-300 leading-relaxed"
                  >
                    <CheckCircle2
                      className={`h-4 w-4 ${p.tint} shrink-0 mt-0.5`}
                    />
                    {it}
                  </li>
                ))}
              </ul>
              {p.warn && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-[12px] text-amber-100/90 leading-relaxed">
                  <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-px" />
                  {t(`safety.phase.${p.id}.warn`)}
                </p>
              )}
            </section>
          ))}
        </div>

        {/* Emergency kit checklist */}
        <section id="kit" className="glass rounded-2xl p-4 scroll-mt-20">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-violet-300" />
              <h2 className="font-bold">{t("safety.kit.title")}</h2>
            </div>
            <button
              onClick={resetKit}
              className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200"
            >
              <RotateCcw className="h-3.5 w-3.5" /> {t("safety.kit.reset")}
            </button>
          </div>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-[12px] mb-1">
              <span className="text-slate-400">
                {t("safety.kit.packed", { packed, total: allItems.length })}
              </span>
              <span className="font-semibold text-violet-300">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
            {KIT.map((g) => (
              <div key={g.group}>
                <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">
                  {t(`safety.kit.groups.${g.group}`)}
                </p>
                <ul className="space-y-1">
                  {g.items.map((it) => {
                    const on = !!checked[it];
                    return (
                      <li key={it}>
                        <button
                          onClick={() => toggle(it)}
                          className="w-full flex items-center gap-2 text-left text-[13px] py-1 group"
                        >
                          {on ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Circle className="h-4 w-4 text-slate-600 group-hover:text-slate-400 shrink-0" />
                          )}
                          <span
                            className={
                              on ? "text-slate-500 line-through" : "text-slate-200"
                            }
                          >
                            {t(`safety.kit.items.${it}`)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
            <Droplets className="h-3.5 w-3.5 text-sky-400 shrink-0" />
            {t("safety.kit.savedNote")}
          </p>
        </section>

        {/* Family emergency plan */}
        <section id="plan" className="glass rounded-2xl p-4 scroll-mt-20">
          <div className="flex items-center gap-2 mb-1.5">
            <Users className="h-5 w-5 text-cyan-300" />
            <h2 className="font-bold">{t("safety.plan.title")}</h2>
          </div>
          <p className="text-[12px] text-slate-500 mb-3 leading-relaxed">
            {t("safety.plan.note")}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {PLAN_FIELDS.map((f) => (
              <label key={f} className="block">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">
                  {t(`safety.plan.fields.${f}`)}
                </span>
                <input
                  value={plan[f] ?? ""}
                  onChange={(e) =>
                    setPlan((pl) => ({ ...pl, [f]: e.target.value }))
                  }
                  placeholder={t(`safety.plan.fields.${f}Ph`)}
                  className="mt-1 w-full rounded-lg bg-ink-900/70 border border-white/10 px-3 py-2 text-[13px] outline-none focus:border-cyan-500 placeholder:text-slate-600"
                />
              </label>
            ))}
          </div>
        </section>

        {/* Footer note */}
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-transparent to-emerald-500/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <LifeBuoy className="h-6 w-6 text-cyan-300 shrink-0" />
          <p className="flex-1 text-[13px] text-slate-300 leading-relaxed">
            {t("safety.footerNote", { phone: "112" })
              .split("112")
              .flatMap((part, i) =>
                i === 0
                  ? [part]
                  : [
                      <a
                        key="tel"
                        href="tel:112"
                        className="font-semibold text-rose-300 underline"
                      >
                        112
                      </a>,
                      part,
                    ]
              )}
          </p>
        </section>
      </div>
    </div>
  );
}
