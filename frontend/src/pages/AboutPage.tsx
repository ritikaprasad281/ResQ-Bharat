import {
  Satellite,
  CloudRain,
  Mountain,
  ShieldCheck,
  History,
  Waves,
  BadgeCheck,
  Languages,
} from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AboutPage() {
  const { t } = useTranslation();
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-10 space-y-8">
        <header>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {t("about.title")}
          </h1>
          <p className="mt-2 text-slate-400">{t("about.intro")}</p>
        </header>

        <section className="grid sm:grid-cols-2 gap-4">
          {[
            {
              icon: Satellite,
              t: t("about.features.satelliteTitle"),
              d: t("about.features.satelliteDesc"),
            },
            {
              icon: Mountain,
              t: t("about.features.terrainTitle"),
              d: t("about.features.terrainDesc"),
            },
            {
              icon: CloudRain,
              t: t("about.features.weatherTitle"),
              d: t("about.features.weatherDesc"),
            },
            {
              icon: ShieldCheck,
              t: t("about.features.damageTitle"),
              d: t("about.features.damageDesc"),
            },
          ].map((f) => (
            <div key={f.t} className="glass rounded-2xl p-4">
              <f.icon className="h-6 w-6 text-sky-400" />
              <p className="mt-2 font-semibold">{f.t}</p>
              <p className="mt-1 text-sm text-slate-400">{f.d}</p>
            </div>
          ))}
        </section>

        {/* Rivers & regions covered */}
        <section className="glass rounded-2xl p-5">
          <h2 className="font-bold flex items-center gap-2">
            <Waves className="h-5 w-5 text-sky-400" /> {t("about.riversTitle")}
          </h2>
          <p className="mt-2 text-sm text-slate-400">{t("about.riversIntro")}</p>
          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-ink-900/50 border border-white/5 p-4">
              <p className="text-sm font-semibold text-slate-200">
                {t("about.riversNorthTitle")}
              </p>
              <p className="mt-1 text-[13px] text-slate-400 leading-snug">
                {t("about.riversNorthDesc")}
              </p>
            </div>
            <div className="rounded-xl bg-ink-900/50 border border-white/5 p-4">
              <p className="text-sm font-semibold text-slate-200">
                {t("about.riversSouthTitle")}
              </p>
              <p className="mt-1 text-[13px] text-slate-400 leading-snug">
                {t("about.riversSouthDesc")}
              </p>
            </div>
          </div>
        </section>

        {/* Data coverage tiers */}
        <section className="glass rounded-2xl p-5">
          <h2 className="font-bold flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-sky-400" />{" "}
            {t("about.maturityTitle")}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {t("about.maturityIntro")}
          </p>
          <div className="mt-4 space-y-3">
            <div className="flex gap-3">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
              <p className="text-[13px] text-slate-400">
                <span className="font-semibold text-slate-200">
                  {t("about.liveLabel")}
                </span>{" "}
                — {t("about.liveDesc")}
              </p>
            </div>
            <div className="flex gap-3">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400" />
              <p className="text-[13px] text-slate-400">
                <span className="font-semibold text-slate-200">
                  {t("about.modelledLabel")}
                </span>{" "}
                — {t("about.modelledDesc")}
              </p>
            </div>
            <div className="flex gap-3">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
              <p className="text-[13px] text-slate-400">
                <span className="font-semibold text-slate-200">
                  {t("about.partialLabel")}
                </span>{" "}
                — {t("about.partialDesc")}
              </p>
            </div>
          </div>
        </section>

        {/* Validation events */}
        <section className="glass rounded-2xl p-5 border border-amber-500/20">
          <h2 className="font-bold flex items-center gap-2">
            <History className="h-5 w-5 text-amber-400" />{" "}
            {t("about.validationTitle")}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {t("about.validationP1")}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            {t("about.validationP2")}
          </p>
        </section>

        {/* Guidance for people */}
        <section className="glass rounded-2xl p-5">
          <h2 className="font-bold flex items-center gap-2">
            <Languages className="h-5 w-5 text-sky-400" />{" "}
            {t("about.peopleTitle")}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {t("about.peopleDesc")}
          </p>
        </section>

        <p className="text-[11px] text-slate-600">
          {t("about.disclaimer")}
        </p>
      </div>
    </div>
  );
}

