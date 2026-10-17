import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ShieldCheck,
  Satellite,
  ArrowRight,
  ArrowUpRight,
  Droplets,
  MapPin,
  Loader2,
  Building2,
  Users,
  IndianRupee,
  Waves,
  Clock,
  FileWarning,
  Layers,
  Gauge,
  CalendarClock,
  Phone,
  LifeBuoy,
  ExternalLink,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "../api";
import type {
  AlertItem,
  Alerts,
  Forecast,
  ForecastHorizon,
  Impact,
  Pilot,
  TopRiskItem,
  ZonesGeoJSON,
} from "../types";
import { riskColor, pct, formatNumber, CLASS_COLORS } from "../lib";
import LocationSearch from "../components/LocationSearch";
import MapView from "../components/MapView";
import ForecastTimeline from "../components/ForecastTimeline";

function timeAgo(iso?: string | null): string {
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

function isStale(iso?: string | null, maxMinutes = 90): boolean {
  if (!iso) return true;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return true;
  return (Date.now() - then) / 60000 > maxMinutes;
}

export default function HomePage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [alertsData, setAlertsData] = useState<Alerts>();
  const [alertsError, setAlertsError] = useState(false);
  const [top, setTop] = useState<TopRiskItem[]>([]);
  const [impact, setImpact] = useState<Impact>();
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  // Hero map overlays.
  const [zones, setZones] = useState<ZonesGeoJSON>();
  const [zonesLoading, setZonesLoading] = useState(false);
  const [showZones, setShowZones] = useState(true);
  const [showStation, setShowStation] = useState(true);

  // Short-range forecast for the highest-risk monitored location.
  const [forecast, setForecast] = useState<Forecast>();
  const [forecastLoading, setForecastLoading] = useState(true);

  const regionalRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);
  const forecastRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.pilots().then(setPilots).catch(() => undefined);
    api
      .alerts()
      .then(setAlertsData)
      .catch(() => setAlertsError(true))
      .finally(() => setLoadingAlerts(false));
    api.topRisk(6).then((r) => setTop(r.top)).catch(() => undefined);
    api.impact().then(setImpact).catch(() => undefined);
  }, []);

  const alerts: AlertItem[] = alertsData?.alerts ?? [];
  // Hero map tracks the current highest live-risk location; Patna is only the
  // placeholder shown until the ranking arrives.
  const heroPilot = useMemo(() => {
    const topId = top[0]?.id;
    const topMatch = topId ? pilots.find((p) => p.id === topId) : undefined;
    return topMatch ?? pilots.find((p) => p.id === "patna") ?? pilots[0];
  }, [pilots, top]);
  // Forecast focuses on the same highest live-risk location.
  const focusPilot = heroPilot?.id;
  const go = (id: string) => nav(`/explore?pilot=${id}`);

  // Lazily fetch cached flood-risk zones for the hero map (served from cache).
  useEffect(() => {
    if (!heroPilot) return;
    setZonesLoading(true);
    api
      .zones(heroPilot.id)
      .then(setZones)
      .catch(() => undefined)
      .finally(() => setZonesLoading(false));
  }, [heroPilot]);

  // Fetch the short-range forecast once we know the focus location.
  useEffect(() => {
    if (!focusPilot) return;
    let active = true;
    setForecastLoading(true);
    api
      .forecast(focusPilot)
      .then((f) => active && setForecast(f))
      .catch(() => undefined)
      .finally(() => active && setForecastLoading(false));
    return () => {
      active = false;
    };
  }, [focusPilot]);

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) =>
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const alertsStale = !alertsError && isStale(alertsData?.generated_at);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* ===== Hero ===== */}
      <section className="relative px-4 sm:px-6 pt-10 lg:pt-14 pb-10 max-w-6xl mx-auto w-full">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 text-[11px] font-semibold text-cyan-300 tracking-wide">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
              </span>
              FLOOD INTELLIGENCE · INDIA
            </span>

            <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.04]">
              <span className="block bg-gradient-to-r from-cyan-300 via-sky-300 to-teal-300 bg-clip-text text-transparent">
                {t("home.headline")}
              </span>
            </h1>
            <p className="mt-4 text-slate-400 text-sm sm:text-base max-w-lg leading-relaxed">
              {t("home.subhead")}
            </p>

            <div className="mt-6 max-w-md">
              <LocationSearch pilots={pilots} onSelect={go} />
              <p className="mt-2 text-[11px] text-slate-500">
                {t("home.searchPlaceholder")}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => nav("/explore")}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-ink-900 px-4 py-2.5 text-sm font-bold transition"
              >
                {t("home.ctaExplore")} <ArrowUpRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => nav("/report")}
                className="inline-flex items-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2.5 text-sm font-semibold transition"
              >
                <AlertTriangle className="h-4 w-4 text-rose-400" />{" "}
                {t("home.ctaReport")}
              </button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
              <span className="text-slate-400 font-medium">{t("home.builtOn")}</span>
              {["Earth Engine", "Gemini", "Cloud Run", "Pub/Sub"].map((b) => (
                <span key={b} className="inline-flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-cyan-400/70" />
                  {b}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40 h-[300px] sm:h-[380px] lg:h-[440px]"
          >
            {heroPilot ? (
              <MapView
                pilot={heroPilot}
                zones={showZones ? zones : undefined}
                showStation={showStation}
              />
            ) : (
              <div className="h-full grid place-items-center bg-ink-800/60">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-ink-900/80 to-transparent" />

            {/* Top-left: basemap label */}
            <div className="absolute top-3 left-3 flex items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-900/70 backdrop-blur px-2.5 py-1 border border-white/10">
                <Satellite className="h-3 w-3 text-cyan-400" />
                {t("home.esriBasemap")}
              </span>
            </div>

            {/* Top-right: layer controls + open-map */}
            <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
              {heroPilot && (
                <button
                  onClick={() => go(heroPilot.id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-cyan-500/90 hover:bg-cyan-400 text-ink-900 px-2.5 py-1 text-[11px] font-bold transition"
                >
                  {t("actions.openMap")} <ArrowRight className="h-3 w-3" />
                </button>
              )}
              <div className="rounded-xl bg-ink-900/75 backdrop-blur border border-white/10 p-2 w-[168px]">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">
                  <Layers className="h-3 w-3" /> {t("home.layers")}
                </div>
                <LayerToggle
                  label={t("home.layerZones")}
                  checked={showZones}
                  onChange={() => setShowZones((v) => !v)}
                  disabled={!zones}
                  hint={
                    zonesLoading
                      ? t("home.mapLoading")
                      : zones
                      ? undefined
                      : t("home.mapUnavailable")
                  }
                />
                <LayerToggle
                  label={t("home.layerStation")}
                  checked={showStation}
                  onChange={() => setShowStation((v) => !v)}
                />
              </div>
            </div>

            {/* Bottom-left: legend (kept clear of bottom-right attribution) */}
            {showZones && zones && (
              <div className="absolute bottom-3 left-3 rounded-xl bg-ink-900/75 backdrop-blur border border-white/10 px-3 py-2">
                <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">
                  {t("home.floodProneConfidence")}
                </p>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {(["low", "medium", "high", "severe"] as const).map((lvl, i) => (
                    <div key={lvl} className="flex items-center gap-1">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ background: CLASS_COLORS[i] }}
                      />
                      <span className="text-[10px] text-slate-300">{t(`risk.${lvl}`)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ===== Conditions overview ===== */}
      <section className="px-4 sm:px-6 pb-8 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="text-lg font-bold">
            {t("home.conditionsTitle")}
          </h2>
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] ${
              alertsError || alertsStale ? "text-amber-400" : "text-slate-500"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            {alertsError
              ? t("home.riskFeedUnavailable")
              : loadingAlerts
              ? t("home.checkingConditions")
              : alertsStale
              ? t("home.riskRefreshedStale", { time: timeAgo(alertsData?.generated_at) })
              : t("home.riskRefreshed", { time: timeAgo(alertsData?.generated_at) })}
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={MapPin}
            color="text-cyan-300"
            value={pilots.length ? String(pilots.length) : "—"}
            label={t("home.stat.districts")}
            sub={t("home.stat.districtsSub")}
            onClick={() => nav("/explore")}
          />
          <StatCard
            icon={Waves}
            color="text-teal-300"
            value={impact ? String(impact.rivers_monitored) : "—"}
            label={t("home.stat.rivers")}
            sub={t("home.stat.riversSub")}
            onClick={() => nav("/explore")}
          />
          <StatCard
            icon={AlertTriangle}
            color={alerts.length ? "text-rose-300" : "text-emerald-300"}
            value={
              alertsError ? "—" : loadingAlerts ? "…" : String(alerts.length)
            }
            label={
              alertsError
                ? t("home.stat.alertsFeedUnavailable")
                : t("home.stat.alerts")
            }
            sub={
              alertsError
                ? t("home.stat.alertsNotConfirm")
                : alerts.length === 0
                ? t("home.stat.alertsSafe")
                : t("home.stat.alertsTap")
            }
            onClick={() => scrollTo(alertsRef)}
          />
          <StatCard
            icon={Gauge}
            color="text-amber-300"
            value={top.length ? String(top.length) : "—"}
            label={t("home.stat.ranked")}
            sub={t("home.stat.rankedSub")}
            onClick={() => scrollTo(regionalRef)}
          />
        </div>
      </section>

      {/* ===== Regional risk (immediately below metrics) ===== */}
      <section
        ref={regionalRef}
        className="px-4 sm:px-6 pb-8 max-w-6xl mx-auto w-full scroll-mt-20"
      >
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-bold">{t("home.regionsTitle")}</h2>
          </div>
          <span className="text-[11px] text-slate-500">
            {t("home.regionsRanked", { time: timeAgo(alertsData?.generated_at) })}
          </span>
        </div>

        {top.length === 0 ? (
          <div className="glass rounded-2xl p-6 flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
            {t("home.rankingLoading")}
          </div>
        ) : (
          <div className="glass rounded-2xl overflow-hidden border border-white/5">
            <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5">
              <span className="col-span-1">#</span>
              <span className="col-span-4">{t("home.table.location")}</span>
              <span className="col-span-3">{t("home.table.riskCategory")}</span>
              <span className="col-span-3">{t("home.table.latestRainfall")}</span>
              <span className="col-span-1 text-right">{t("home.table.map")}</span>
            </div>
            {top.map((t, i) => (
              <RegionalRow key={t.id} t={t} rank={i + 1} onClick={() => go(t.id)} />
            ))}
          </div>
        )}
        <p className="mt-2 text-[10px] text-slate-600 leading-relaxed">
          {t("home.riskScoreNote")}
        </p>
      </section>

      {/* ===== Short-range forecast ===== */}
      {forecast &&
        ((forecast.horizons && forecast.horizons.length > 0) ||
          forecast.series.length > 0) && (
          <section
            ref={forecastRef}
            className="px-4 sm:px-6 pb-8 max-w-6xl mx-auto w-full scroll-mt-20"
          >
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-sky-400" />
                <h2 className="text-lg font-bold">
                  {t("home.forecastTitle", { name: forecast.name })}
                </h2>
              </div>
              <span className="text-[11px] text-slate-500">
                {forecast.source ?? "Open-Meteo"} ·{" "}
                {forecast.issued_at
                  ? t("home.forecastIssued", { time: timeAgo(forecast.issued_at) })
                  : t("home.forecastDaily")}
              </span>
            </div>

            <div className="grid lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2 grid grid-cols-3 gap-2 content-start">
                {forecast.horizons && forecast.horizons.length > 0 ? (
                  forecast.horizons.map((h) => <HorizonCard key={h.window} h={h} />)
                ) : (
                  <div className="col-span-3 glass rounded-xl p-4 text-[11px] text-slate-400">
                    {t("home.subDailyUnavailable")}
                  </div>
                )}
                {typeof forecast.observed_3d_mm === "number" && (
                  <div className="col-span-3 rounded-xl bg-ink-800/60 border border-white/5 px-3 py-2 text-[11px] text-slate-400">
                    <span className="text-slate-500">{t("home.observed")} </span>
                    {t("home.observedNote", { mm: forecast.observed_3d_mm })}
                  </div>
                )}
              </div>
              <div className="lg:col-span-3">
                {focusPilot && <ForecastTimeline pilot={focusPilot} />}
              </div>
            </div>
          </section>
        )}
      {forecastLoading && !forecast && (
        <section className="px-4 sm:px-6 pb-8 max-w-6xl mx-auto w-full">
          <div className="glass rounded-2xl p-6 flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
            {t("home.forecastLoading")}
          </div>
        </section>
      )}

      {/* ===== Live alerts ===== */}
      <section
        ref={alertsRef}
        className="px-4 sm:px-6 pb-8 max-w-6xl mx-auto w-full scroll-mt-20"
      >
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-rose-400" />
          <h2 className="text-lg font-bold">{t("home.alertsTitle")}</h2>
          <span className="text-[11px] text-slate-500">
            {t("home.alertsSub")}
          </span>
        </div>

        {alertsError ? (
          <div className="glass rounded-2xl p-6 flex items-center gap-3 border border-amber-500/20">
            <FileWarning className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold text-amber-300">
                {t("home.alertsUnavailableTitle")}
              </p>
              <p className="text-sm text-slate-400">
                {t("home.alertsUnavailableBody")}
              </p>
            </div>
          </div>
        ) : loadingAlerts ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass rounded-2xl p-4 h-24 animate-pulse" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="glass rounded-2xl p-6 flex items-center gap-3">
            <div className="grid place-items-center h-10 w-10 rounded-xl bg-emerald-500/15">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-emerald-300">
                {t("home.noAlertsTitle")}
              </p>
              <p className="text-sm text-slate-400">
                {t("home.noAlertsBody", {
                  count: pilots.length,
                  refreshed: alertsData?.generated_at
                    ? t("home.refreshedParens", { time: timeAgo(alertsData.generated_at) })
                    : "",
                  stale: alertsStale ? t("home.staleSuffix") : "",
                })}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {alerts.map((a) => (
              <AlertCard key={a.id} a={a} onClick={() => go(a.id)} />
            ))}
          </div>
        )}
      </section>

      {/* ===== Exposure / impact ===== */}
      {impact && (
        <section className="px-4 sm:px-6 pb-8 max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Building2 className="h-5 w-5 text-pink-400" />
            <h2 className="text-lg font-bold">{t("home.exposureTitle")}</h2>
            <span className="text-[11px] text-slate-500">
              {t("home.exposureSub")}
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                icon: Building2,
                label: t("home.exposure.newBuildings"),
                value: formatNumber(impact.new_buildings_in_corridor),
                color: "text-pink-300",
                tint: "from-pink-500/10",
              },
              {
                icon: Users,
                label: t("home.exposure.peopleExposed"),
                value: formatNumber(impact.people_newly_exposed),
                color: "text-sky-300",
                tint: "from-sky-500/10",
              },
              {
                icon: IndianRupee,
                label: t("home.exposure.assetValue"),
                value: `₹${formatNumber(impact.asset_value_crore)} Cr`,
                color: "text-amber-300",
                tint: "from-amber-500/10",
              },
              {
                icon: Waves,
                label: t("home.exposure.newBuiltUp"),
                value: `${formatNumber(impact.new_built_area_ha)} ha`,
                color: "text-teal-300",
                tint: "from-teal-500/10",
              },
            ].map((s) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className={`glass rounded-2xl p-4 bg-gradient-to-b ${s.tint} to-transparent`}
              >
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <div className="mt-2 text-2xl font-extrabold tracking-tight">
                  {s.value}
                </div>
                <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                  {s.label}
                </div>
              </motion.div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-600 leading-relaxed">
            {t("home.exposureNote", { count: impact.locations_analysed })}
          </p>
        </section>
      )}

      {/* ===== Community CTA ===== */}
      <section className="px-4 sm:px-6 pb-12 max-w-6xl mx-auto w-full">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-transparent to-teal-500/10 p-6 sm:p-8">
          <h2 className="text-xl font-bold">{t("home.communityTitle")}</h2>
          <p className="mt-1.5 text-sm text-slate-400 max-w-2xl">
            {t("home.communityBody")}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: AlertTriangle,
                t: t("home.community.reportHazard"),
                d: t("home.community.reportHazardDesc"),
                to: "/report",
              },
              {
                icon: MapPin,
                t: t("home.community.floodIntel"),
                d: t("home.community.floodIntelDesc"),
                to: "/explore",
              },
              {
                icon: LifeBuoy,
                t: t("home.community.aiHelp"),
                d: t("home.community.aiHelpDesc"),
                to: "/ai-help",
              },
              {
                icon: Droplets,
                t: t("home.community.floodSafety"),
                d: t("home.community.floodSafetyDesc"),
                to: "/flood-safety",
              },
              {
                icon: Building2,
                t: t("home.community.floodplain"),
                d: t("home.community.floodplainDesc"),
                to: "/floodplain",
              },
              {
                icon: ShieldCheck,
                t: t("home.community.about"),
                d: t("home.community.aboutDesc"),
                to: "/about",
              },
            ].map((c) => (
              <button
                key={c.t}
                onClick={() => nav(c.to)}
                className="text-left rounded-xl bg-ink-900/50 border border-white/5 hover:border-cyan-500/40 p-4 transition group"
              >
                <c.icon className="h-5 w-5 text-cyan-300" />
                <p className="mt-2 font-semibold text-sm flex items-center gap-1">
                  {c.t}
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition" />
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">{c.d}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Emergency resources ===== */}
      <section className="px-4 sm:px-6 pb-12 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-1">
          <LifeBuoy className="h-5 w-5 text-rose-400" />
          <h2 className="text-lg font-bold">{t("home.emergencyTitle")}</h2>
        </div>
        <p className="text-sm text-slate-400 mb-3 max-w-2xl">
          {t("home.emergencyBody")}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <a
            href="tel:112"
            className="glass rounded-2xl p-4 border border-rose-500/20 hover:border-rose-500/50 transition block"
          >
            <Phone className="h-5 w-5 text-rose-300" />
            <p className="mt-2 text-xl font-extrabold">112</p>
            <p className="text-[11px] text-slate-400">
              {t("home.emergency.national")}
            </p>
          </a>
          <a
            href="tel:1078"
            className="glass rounded-2xl p-4 border border-amber-500/20 hover:border-amber-500/50 transition block"
          >
            <Phone className="h-5 w-5 text-amber-300" />
            <p className="mt-2 text-xl font-extrabold">1078</p>
            <p className="text-[11px] text-slate-400">
              {t("home.emergency.ndma")}
            </p>
          </a>
          <a
            href="https://ffs.india-water.gov.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="glass rounded-2xl p-4 border border-white/5 hover:border-cyan-500/40 transition block"
          >
            <ExternalLink className="h-5 w-5 text-cyan-300" />
            <p className="mt-2 font-semibold text-sm">{t("home.emergency.cwc")}</p>
            <p className="text-[11px] text-slate-400">
              {t("home.emergency.cwcDesc")}
            </p>
          </a>
          <a
            href="https://mausam.imd.gov.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="glass rounded-2xl p-4 border border-white/5 hover:border-cyan-500/40 transition block"
          >
            <ExternalLink className="h-5 w-5 text-cyan-300" />
            <p className="mt-2 font-semibold text-sm">{t("home.emergency.imd")}</p>
            <p className="text-[11px] text-slate-400">
              {t("home.emergency.imdDesc")}
            </p>
          </a>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-white/5 px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            <span className="font-bold">ResQ Bharat</span>
            <span className="text-slate-500">· {t("home.footer.tagline")}</span>
          </div>
          <p className="text-[11px] text-slate-500">
            {t("home.footer.data")}
          </p>
        </div>
        <p className="mt-3 text-[11px] text-slate-600 leading-relaxed">
          {t("home.footer.disclaimer")}
        </p>
      </footer>
    </div>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  color,
  sub,
  onClick,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  color: string;
  sub?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <Icon className={`h-5 w-5 ${color}`} />
      <div className="mt-2 text-2xl font-extrabold tracking-tight">{value}</div>
      <div className="text-[11px] text-slate-300 leading-tight mt-0.5">
        {label}
      </div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </>
  );
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="text-left glass rounded-2xl p-4 border border-white/5 hover:border-cyan-500/40 transition group"
      >
        {inner}
        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-cyan-300/0 group-hover:text-cyan-300 transition">
          View <ArrowRight className="h-3 w-3" />
        </span>
      </button>
    );
  }
  return <div className="glass rounded-2xl p-4 border border-white/5">{inner}</div>;
}

function RegionalRow({
  t,
  rank,
  onClick,
}: {
  t: TopRiskItem;
  rank: number;
  onClick: () => void;
}) {
  const { t: tr } = useTranslation();
  return (
    <button
      onClick={onClick}
      className="w-full text-left grid grid-cols-2 sm:grid-cols-12 gap-2 items-center px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition"
    >
      <span className="hidden sm:block col-span-1 text-slate-500 font-mono text-sm">
        {rank}
      </span>
      <div className="sm:col-span-4">
        <p className="font-semibold text-sm flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
          {t.name}
        </p>
        <p className="text-[11px] text-slate-500">{t.tributary}</p>
      </div>
      <div className="sm:col-span-3 flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ background: riskColor(t.level) }}
        />
        <span
          className="text-xs font-bold capitalize"
          style={{ color: riskColor(t.level) }}
        >
          {tr(`risk.${t.level}`, { defaultValue: t.level })}
        </span>
        <span className="text-[11px] text-slate-400">{pct(t.probability)}</span>
      </div>
      <div className="sm:col-span-3 text-[11px] text-slate-400">
        <span className="text-slate-500">7d</span> {t.forecast_7d_mm} mm ·{" "}
        <span className="text-slate-500">3d</span> {t.antecedent_3d_mm} mm
      </div>
      <span className="col-span-2 sm:col-span-1 text-right text-cyan-300 text-[11px] inline-flex items-center justify-end gap-1">
        {tr("home.table.map")} <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

function HorizonCard({ h }: { h: ForecastHorizon }) {
  const { t: tr } = useTranslation();
  const c = riskColor(h.level);
  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: `${c}40`, background: `${c}12` }}
    >
      <p className="text-[10px] uppercase tracking-wider text-slate-400">
        {tr("home.next", { window: h.window })}
      </p>
      <p className="mt-1 text-lg font-extrabold" style={{ color: c }}>
        {pct(h.risk)}
      </p>
      <p className="text-[10px] capitalize" style={{ color: c }}>
        {tr(`risk.${h.level}`, { defaultValue: h.level })}
      </p>
      <p className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
        <Droplets className="h-3 w-3 text-sky-400" />
        {h.rainfall_mm} mm
      </p>
    </div>
  );
}

function LayerToggle({
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`w-full flex items-center justify-between gap-2 py-1 text-[11px] ${
        disabled ? "opacity-50 cursor-not-allowed" : "hover:text-white"
      }`}
    >
      <span className="flex items-center gap-1.5">
        <span
          className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${
            checked
              ? "bg-cyan-500 border-cyan-500"
              : "border-white/30 bg-transparent"
          }`}
        >
          {checked && (
            <span className="h-1.5 w-1.5 rounded-sm bg-ink-900" />
          )}
        </span>
        {label}
      </span>
      {hint && <span className="text-[9px] text-slate-500">{hint}</span>}
    </button>
  );
}


function AlertCard({ a, onClick }: { a: AlertItem; onClick: () => void }) {
  const { t: tr } = useTranslation();
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="text-left glass rounded-2xl p-4 border border-white/5 hover:border-rose-500/40 transition"
      style={{ boxShadow: `inset 0 0 0 1px ${riskColor(a.level)}22` }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
          style={{
            color: riskColor(a.level),
            background: `${riskColor(a.level)}1a`,
          }}
        >
          {tr(`risk.${a.level}`, { defaultValue: a.level })}
        </span>
        <span className="text-xs text-slate-400">{pct(a.probability)}</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <MapPin className="h-4 w-4 text-rose-400" />
        <span className="font-semibold">{a.name}</span>
      </div>
      <p className="mt-1 text-[11px] text-slate-400 flex items-center gap-1.5">
        <Droplets className="h-3.5 w-3.5 text-sky-400" />
        {tr("home.alertRain", { f7: a.forecast_7d_mm, a3: a.antecedent_3d_mm })}
      </p>
    </motion.button>
  );
}
