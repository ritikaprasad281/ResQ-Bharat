import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Leaf,
  Loader2,
  MapPin,
  Search,
  Sprout,
  IndianRupee,
  LandPlot,
  Layers,
  X,
} from "lucide-react";
import { api } from "../api";
import type {
  AgriLoss,
  AgriLossSummary,
  Pilot,
  SeverityLevel,
  ZonesGeoJSON,
} from "../types";
import {
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  coverageOf,
  formatHa,
  formatINRCompact,
  formatINRFull,
  timeAgo,
} from "../lib";
import MapView from "../components/MapView";
import LocationSearch from "../components/LocationSearch";

const PAGE_SIZE = 10;
const SEVERITY_ORDER: SeverityLevel[] = ["severe", "high", "moderate", "low"];

type SortKey = "estimated_loss_inr" | "exposed_cropland_ha" | "damaged_cropland_ha";

/** Build a minimal Pilot from a summary row / detail for MapView + search. */
function rowToPilot(r: {
  aoi: string;
  name: string;
  tributary: string;
  basin: string;
  region: string;
  coverage: Pilot["coverage"];
  bbox: [number, number, number, number];
  center: [number, number];
}): Pilot {
  return {
    id: r.aoi,
    name: r.name,
    tributary: r.tributary,
    basin: r.basin,
    region: r.region,
    coverage: r.coverage,
    bbox: r.bbox,
    center: r.center,
  };
}

export default function AgriLossPage() {
  const [params, setParams] = useSearchParams();
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [summary, setSummary] = useState<AgriLossSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgriLoss | null>(null);
  const [zones, setZones] = useState<ZonesGeoJSON | undefined>(undefined);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Filters / table controls
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [cropFilter, setCropFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("estimated_loss_inr");
  const [page, setPage] = useState(1);

  const mapRef = useRef<HTMLDivElement>(null);

  // --- initial load -------------------------------------------------------
  useEffect(() => {
    api
      .pilots()
      .then(setPilots)
      .catch(() => setPilots([]));
  }, []);

  const loadSummary = () => {
    setLoadingSummary(true);
    api
      .agriLossSummary()
      .then((s) => {
        setSummary(s);
        setSummaryError(false);
      })
      .catch(() => setSummaryError(true))
      .finally(() => setLoadingSummary(false));
  };
  useEffect(loadSummary, []);

  // Pick an initial selection: ?pilot= param, else the highest-loss location.
  useEffect(() => {
    if (selectedId) return;
    const fromUrl = params.get("pilot");
    if (fromUrl) {
      setSelectedId(fromUrl);
    } else if (summary && summary.locations.length) {
      setSelectedId(summary.locations[0].aoi);
    }
  }, [summary, params, selectedId]);

  // --- load the selected location's full breakdown + flood zones ----------
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    setZones(undefined);
    api
      .agriLoss(selectedId)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        // If this location was not yet in the summary, refresh so the table
        // and charts reflect the newly computed (and now cached) estimate.
        if (summary && !summary.locations.some((l) => l.aoi === selectedId)) {
          loadSummary();
        }
      })
      .catch(() => {
        if (!cancelled) setDetailError("Could not compute this estimate. Try again.");
      })
      .finally(() => !cancelled && setDetailLoading(false));
    api
      .zones(selectedId)
      .then((z) => !cancelled && setZones(z))
      .catch(() => !cancelled && setZones(undefined));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const onSelect = (id: string) => {
    setSelectedId(id);
    setParams({ pilot: id }, { replace: true });
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // --- filter option lists ------------------------------------------------
  const rows = summary?.locations ?? [];
  const states = useMemo(
    () => Array.from(new Set(rows.map((r) => r.region))).sort(),
    [rows]
  );
  const crops = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => r.primary_crop).filter(Boolean) as string[])
      ).sort(),
    [rows]
  );

  // --- filtered + sorted rows --------------------------------------------
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (stateFilter && r.region !== stateFilter) return false;
        if (cropFilter && r.primary_crop !== cropFilter) return false;
        if (severityFilter && r.severity !== severityFilter) return false;
        if (q) {
          const hay = `${r.name} ${r.region} ${r.tributary} ${r.basin}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0));
  }, [rows, query, stateFilter, cropFilter, severityFilter, sortKey]);

  useEffect(() => setPage(1), [query, stateFilter, cropFilter, severityFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // --- chart data (respond to filters) -----------------------------------
  const topLocations = useMemo(
    () =>
      filtered.slice(0, 8).map((r) => ({
        name: shortName(r.name),
        crore: round2(r.estimated_loss_inr / 1e7),
        aoi: r.aoi,
        severity: r.severity ?? "low",
      })),
    [filtered]
  );
  const byState = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered)
      m.set(r.region, (m.get(r.region) ?? 0) + r.exposed_cropland_ha);
    return Array.from(m.entries())
      .map(([name, ha]) => ({ name, ha: Math.round(ha) }))
      .sort((a, b) => b.ha - a.ha)
      .slice(0, 8);
  }, [filtered]);
  const scatterData = useMemo(
    () =>
      filtered.map((r) => ({
        name: shortName(r.name),
        ha: Math.round(r.damaged_cropland_ha),
        crore: round2(r.estimated_loss_inr / 1e7),
        severity: r.severity ?? "low",
      })),
    [filtered]
  );
  const cropBreakdown = useMemo(
    () =>
      (detail?.crops ?? [])
        .filter((c) => c.loss_inr > 0)
        .map((c) => ({ name: c.label, inr: c.loss_inr, lakh: round2(c.loss_inr / 1e5) })),
    [detail]
  );

  const selectedPilot: Pilot | null = detail
    ? rowToPilot(detail)
    : (() => {
        const r = rows.find((x) => x.aoi === selectedId);
        return r ? rowToPilot(r) : null;
      })();

  const sev = summary?.severity_counts;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <header className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold uppercase tracking-wide">
                <Sprout className="h-4 w-4" /> Agricultural Loss Assessment
              </div>
              <h1 className="text-2xl font-bold mt-1">
                Flood-related crop loss across India
              </h1>
              <p className="text-sm text-slate-400 max-w-2xl mt-1">
                Model-estimated agricultural damage from flood exposure —
                hectares of affected farmland and indicative monetary loss in ₹,
                derived from satellite land cover and the ResQ&nbsp;Bharat flood
                model. All figures are estimates, not official damage surveys.
              </p>
            </div>
            <div className="w-full sm:w-72">
              <LocationSearch
                pilots={pilots}
                value={selectedId ?? undefined}
                onSelect={onSelect}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Estimates are indicative and must not be used as a substitute for
            official agricultural damage surveys or compensation assessments.
          </div>
        </header>

        {/* KPI strip */}
        {summaryError ? (
          <ErrorBox onRetry={loadSummary} />
        ) : loadingSummary && !summary ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-xl bg-ink-800/40 border border-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : (
          summary && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <Kpi
                  icon={<LandPlot className="h-4 w-4" />}
                  label="Exposed cropland"
                  value={formatHa(summary.total_exposed_cropland_ha)}
                  sub="satellite-measured"
                  tone="sky"
                />
                <Kpi
                  icon={<Leaf className="h-4 w-4" />}
                  label="Est. damaged area"
                  value={formatHa(summary.total_damaged_cropland_ha)}
                  sub="model estimate"
                  tone="amber"
                />
                <Kpi
                  icon={<IndianRupee className="h-4 w-4" />}
                  label="Est. monetary loss"
                  value={formatINRCompact(summary.total_estimated_loss_inr)}
                  sub="indicative"
                  tone="rose"
                  title={formatINRFull(summary.total_estimated_loss_inr)}
                />
                <Kpi
                  icon={<MapPin className="h-4 w-4" />}
                  label="Affected locations"
                  value={`${summary.locations_analysed}`}
                  sub={`of ${summary.locations_total} monitored`}
                  tone="emerald"
                />
                <Kpi
                  icon={<Sprout className="h-4 w-4" />}
                  label="Crop types affected"
                  value={`${summary.crop_types_affected}`}
                  sub={`${summary.rivers_affected} rivers`}
                  tone="violet"
                />
              </div>

              {/* Severity distribution */}
              {sev && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-400">Loss severity:</span>
                  {SEVERITY_ORDER.map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() =>
                        setSeverityFilter((s) => (s === lvl ? "" : lvl))
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border transition ${
                        severityFilter === lvl
                          ? "border-white/30 bg-ink-700"
                          : "border-white/10 bg-ink-800/50 hover:bg-ink-700/60"
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: SEVERITY_COLORS[lvl] }}
                      />
                      {SEVERITY_LABELS[lvl]}
                      <span className="text-slate-400">{sev[lvl] ?? 0}</span>
                    </button>
                  ))}
                  {summary.locations_pending > 0 && (
                    <span className="text-slate-500">
                      · {summary.locations_pending} not yet computed
                    </span>
                  )}
                </div>
              )}
            </>
          )
        )}

        {/* Empty state when nothing computed yet */}
        {summary && summary.locations_analysed === 0 && !loadingSummary && (
          <div className="rounded-xl border border-white/10 bg-ink-800/40 p-6 text-center text-sm text-slate-300">
            <Info className="h-5 w-5 mx-auto mb-2 text-sky-300" />
            No agricultural-loss estimates have been computed yet. Select a
            location above to generate its first estimate — it will then appear
            in the table, map and charts below.
          </div>
        )}

        {/* Map + selected detail */}
        <div ref={mapRef} className="grid lg:grid-cols-[1fr_380px] gap-4">
          {/* Map */}
          <div className="relative rounded-xl overflow-hidden border border-white/10 bg-ink-900 min-h-[360px] h-[clamp(360px,52vh,560px)]">
            {selectedPilot ? (
              <>
                <MapView
                  pilot={selectedPilot}
                  zones={zones}
                  showStation
                  focus={selectedPilot.bbox}
                />
                {detail && (
                  <div className="absolute left-3 top-3 max-w-[18rem] rounded-xl bg-ink-900/90 backdrop-blur border border-white/10 p-3 text-xs space-y-1.5 shadow-lg">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm">{detail.name}</span>
                      <SeverityPill level={detail.severity.level} />
                    </div>
                    <Row label="Exposed cropland" value={formatHa(detail.exposed_cropland_ha)} />
                    <Row label="Est. damaged" value={formatHa(detail.damaged_cropland_ha)} />
                    <Row
                      label="Est. loss"
                      value={formatINRCompact(detail.estimated_loss_inr)}
                      title={formatINRFull(detail.estimated_loss_inr)}
                    />
                    <Row label="Primary crop" value={detail.primary_crop ?? "—"} />
                    <div className="pt-1 text-[10px] text-slate-400 flex items-center gap-1">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: coverageOf(detail.coverage).dot }}
                      />
                      {detail.data_confidence}
                    </div>
                  </div>
                )}
                <div className="absolute right-3 bottom-3 rounded-lg bg-ink-900/85 border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-300 flex items-center gap-2">
                  <Layers className="h-3 w-3" /> Flood-prone zones (context)
                </div>
              </>
            ) : (
              <div className="h-full grid place-items-center text-slate-500 text-sm">
                Select a location to view its flood-prone farmland
              </div>
            )}
          </div>

          {/* Selected detail breakdown */}
          <div className="rounded-xl border border-white/10 bg-ink-800/40 p-4 space-y-3 overflow-y-auto max-h-[560px]">
            {detailLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Computing estimate…
              </div>
            ) : detailError ? (
              <div className="text-sm text-rose-300 py-6 text-center">
                {detailError}
              </div>
            ) : detail ? (
              <>
                <div>
                  <div className="text-sm font-semibold">{detail.name}</div>
                  <div className="text-xs text-slate-400">
                    {detail.region} · {detail.basin} basin · {detail.tributary}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Stat label="Total cropland" value={formatHa(detail.cropland_ha)} />
                  <Stat
                    label="Exposed to flooding"
                    value={formatHa(detail.exposed_cropland_ha)}
                  />
                  <Stat
                    label="Est. damaged"
                    value={formatHa(detail.damaged_cropland_ha)}
                    hint={`${Math.round(detail.damage_fraction_range.low * 100)}–${Math.round(
                      detail.damage_fraction_range.high * 100
                    )}% damage range`}
                  />
                  <Stat
                    label="Loss per hectare"
                    value={formatINRCompact(detail.loss_per_hectare_inr)}
                  />
                </div>

                <div className="rounded-lg bg-ink-900/60 border border-white/5 p-2.5">
                  <div className="text-[11px] text-slate-400">Estimated crop loss</div>
                  <div
                    className="text-lg font-bold"
                    title={formatINRFull(detail.estimated_loss_inr)}
                  >
                    {formatINRCompact(detail.estimated_loss_inr)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    range {formatINRCompact(detail.estimated_loss_range_inr.low)} –{" "}
                    {formatINRCompact(detail.estimated_loss_range_inr.high)}
                  </div>
                </div>

                {/* Crop-wise breakdown */}
                <div>
                  <div className="text-[11px] text-slate-400 mb-1">
                    Crop-wise estimate (regional cropping-mix assumption)
                  </div>
                  <div className="space-y-1">
                    {detail.crops
                      .filter((c) => c.damaged_area_ha > 0)
                      .map((c) => (
                        <div
                          key={c.crop}
                          className="flex items-center justify-between text-xs bg-ink-900/40 rounded px-2 py-1.5"
                        >
                          <span>
                            {c.label}
                            <span className="text-slate-500">
                              {" "}
                              · {c.season}
                            </span>
                          </span>
                          <span className="text-right">
                            <span className="text-slate-300">
                              {formatHa(c.damaged_area_ha)}
                            </span>
                            <span
                              className="block text-[10px] text-slate-400"
                              title={formatINRFull(c.loss_inr)}
                            >
                              {formatINRCompact(c.loss_inr)}
                            </span>
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Assumptions & provenance */}
                <details className="text-[11px] text-slate-400">
                  <summary className="cursor-pointer text-slate-300">
                    Assumptions, methodology &amp; sources
                  </summary>
                  <div className="mt-2 space-y-2">
                    <p>
                      Severity <strong>{SEVERITY_LABELS[detail.severity.level]}</strong>{" "}
                      — based on {detail.severity.basis} (
                      {Math.round(detail.severity.share_of_cropland * 100)}% of
                      cropland damaged).
                    </p>
                    {Object.entries(detail.methodology).map(([k, v]) => (
                      <p key={k}>
                        <span className="text-slate-300 capitalize">
                          {k.replace(/_/g, " ")}:
                        </span>{" "}
                        {v}
                      </p>
                    ))}
                    <div className="pt-1">
                      {detail.sources.map((s) => (
                        <a
                          key={s.name}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sky-300 hover:underline"
                        >
                          {s.name}
                          <span className="text-slate-500">
                            {" "}
                            · {s.role}
                          </span>
                        </a>
                      ))}
                    </div>
                    <p className="text-slate-500 italic">{detail.disclaimer}</p>
                    {detail.updated_at && (
                      <p className="text-slate-500">
                        Computed {timeAgo(detail.updated_at)}
                      </p>
                    )}
                  </div>
                </details>
              </>
            ) : (
              <div className="text-sm text-slate-500 py-8 text-center">
                Select a location to see its full breakdown.
              </div>
            )}
          </div>
        </div>

        {/* Charts */}
        {filtered.length > 0 && (
          <div className="grid lg:grid-cols-3 gap-4">
            <ChartCard title="Top locations by estimated loss (₹ crore)">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={topLocations}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2740" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={78}
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [`₹${v} Cr`, "Est. loss"]}
                    cursor={{ fill: "#ffffff08" }}
                  />
                  <Bar dataKey="crore" radius={[0, 4, 4, 0]}>
                    {topLocations.map((d) => (
                      <Cell key={d.aoi} fill={SEVERITY_COLORS[d.severity]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="State-wise exposed cropland (ha)">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={byState}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2740" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={78}
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [`${v.toLocaleString("en-IN")} ha`, "Exposed"]}
                    cursor={{ fill: "#ffffff08" }}
                  />
                  <Bar dataKey="ha" radius={[0, 4, 4, 0]} fill="#38bdf8" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title={
                detail
                  ? `Crop-wise loss — ${shortName(detail.name)} (₹ lakh)`
                  : "Crop-wise loss (select a location)"
              }
            >
              {cropBreakdown.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={cropBreakdown}
                    margin={{ top: 4, right: 8, left: -14, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2740" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#94a3b8", fontSize: 9 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={46}
                    />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number) => [`₹${v} lakh`, "Est. loss"]}
                      cursor={{ fill: "#ffffff08" }}
                    />
                    <Bar dataKey="lakh" radius={[4, 4, 0, 0]} fill="#34d399" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] grid place-items-center text-xs text-slate-500">
                  No crop-wise data for this selection
                </div>
              )}
            </ChartCard>

            <ChartCard
              title="Damaged area vs estimated loss by location"
              className="lg:col-span-3"
            >
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2740" />
                  <XAxis
                    type="number"
                    dataKey="ha"
                    name="Damaged area"
                    unit=" ha"
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="crore"
                    name="Est. loss"
                    unit=" Cr"
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                  />
                  <ZAxis range={[40, 40]} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ strokeDasharray: "3 3" }}
                    formatter={(v: number, n: string) => [
                      n === "Est. loss" ? `₹${v} Cr` : `${v} ha`,
                      n,
                    ]}
                  />
                  <Scatter data={scatterData}>
                    {scatterData.map((d, i) => (
                      <Cell key={i} fill={SEVERITY_COLORS[d.severity]} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}

        {/* Table */}
        <section className="rounded-xl border border-white/10 bg-ink-800/40">
          <div className="p-3 border-b border-white/10 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search state, district, river…"
                className="w-full bg-ink-900/60 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm outline-none focus:border-sky-500/50"
              />
            </div>
            <Select value={stateFilter} onChange={setStateFilter} label="All states" options={states} />
            <Select value={cropFilter} onChange={setCropFilter} label="All crops" options={crops} />
            <Select
              value={severityFilter}
              onChange={setSeverityFilter}
              label="All severity"
              options={SEVERITY_ORDER}
              render={(o) => SEVERITY_LABELS[o] ?? o}
            />
            <button
              onClick={() =>
                setSortKey((k) =>
                  k === "estimated_loss_inr"
                    ? "exposed_cropland_ha"
                    : k === "exposed_cropland_ha"
                    ? "damaged_cropland_ha"
                    : "estimated_loss_inr"
                )
              }
              className="inline-flex items-center gap-1.5 text-xs bg-ink-900/60 border border-white/10 rounded-lg px-2.5 py-1.5 hover:bg-ink-700/60"
              title="Change sort column"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortKey === "estimated_loss_inr"
                ? "Loss"
                : sortKey === "exposed_cropland_ha"
                ? "Exposed area"
                : "Damaged area"}
            </button>
            {(query || stateFilter || cropFilter || severityFilter) && (
              <button
                onClick={() => {
                  setQuery("");
                  setStateFilter("");
                  setCropFilter("");
                  setSeverityFilter("");
                }}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-400 border-b border-white/10">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">State</th>
                  <th className="px-3 py-2 font-medium">District / River</th>
                  <th className="px-3 py-2 font-medium">Primary crop</th>
                  <th className="px-3 py-2 font-medium text-right">Exposed (ha)</th>
                  <th className="px-3 py-2 font-medium text-right">Damaged (ha)</th>
                  <th className="px-3 py-2 font-medium text-right">Est. loss</th>
                  <th className="px-3 py-2 font-medium text-right">₹/ha</th>
                  <th className="px-3 py-2 font-medium">Severity</th>
                  <th className="px-3 py-2 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr
                    key={r.aoi}
                    onClick={() => onSelect(r.aoi)}
                    className={`border-b border-white/5 cursor-pointer transition hover:bg-ink-700/40 ${
                      r.aoi === selectedId ? "bg-ink-700/50" : ""
                    }`}
                  >
                    <td className="px-3 py-2">{r.region}</td>
                    <td className="px-3 py-2">
                      {shortName(r.name)}
                      <span className="block text-[10px] text-slate-500">
                        {r.tributary}
                      </span>
                    </td>
                    <td className="px-3 py-2">{r.primary_crop ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {Math.round(r.exposed_cropland_ha).toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Math.round(r.damaged_cropland_ha).toLocaleString("en-IN")}
                    </td>
                    <td
                      className="px-3 py-2 text-right"
                      title={formatINRFull(r.estimated_loss_inr)}
                    >
                      {formatINRCompact(r.estimated_loss_inr)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400">
                      {formatINRCompact(r.loss_per_hectare_inr)}
                    </td>
                    <td className="px-3 py-2">
                      {r.severity ? <SeverityPill level={r.severity} /> : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: coverageOf(r.coverage).dot }}
                        />
                        estimated
                      </span>
                    </td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                      {rows.length === 0
                        ? "No estimates computed yet."
                        : "No locations match the current filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > PAGE_SIZE && (
            <div className="p-3 flex items-center justify-between text-xs text-slate-400 border-t border-white/10">
              <span>
                {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded bg-ink-900/60 border border-white/10 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span>
                  {page} / {pageCount}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page === pageCount}
                  className="p-1.5 rounded bg-ink-900/60 border border-white/10 disabled:opacity-40"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </section>

        <p className="text-[11px] text-slate-500 pb-4">
          {summary?.disclaimer} AI-generated analysis — please validate.
        </p>
      </div>
    </div>
  );
}

// --- small presentational helpers ----------------------------------------
const tooltipStyle = {
  background: "#0f1524",
  border: "1px solid #1e2740",
  borderRadius: 8,
  color: "#e5e7eb",
  fontSize: 12,
};

const TONES: Record<string, string> = {
  sky: "text-sky-300",
  amber: "text-amber-300",
  rose: "text-rose-300",
  emerald: "text-emerald-300",
  violet: "text-violet-300",
};

function Kpi({
  icon,
  label,
  value,
  sub,
  tone,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: string;
  title?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink-800/40 p-3" title={title}>
      <div className={`flex items-center gap-1.5 text-[11px] ${TONES[tone]}`}>
        {icon}
        {label}
      </div>
      <div className="text-lg font-bold mt-1 leading-tight">{value}</div>
      <div className="text-[10px] text-slate-500">{sub}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg bg-ink-900/50 border border-white/5 p-2">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="font-semibold text-slate-100">{value}</div>
      {hint && <div className="text-[9px] text-slate-500">{hint}</div>}
    </div>
  );
}

function Row({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="flex justify-between gap-3" title={title}>
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}

function SeverityPill({ level }: { level: SeverityLevel }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        color: SEVERITY_COLORS[level],
        background: `${SEVERITY_COLORS[level]}1f`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: SEVERITY_COLORS[level] }}
      />
      {SEVERITY_LABELS[level]}
    </span>
  );
}

function ChartCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-white/10 bg-ink-800/40 p-3 ${className}`}>
      <div className="text-xs font-medium text-slate-300 mb-2">{title}</div>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  label,
  options,
  render,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: string[];
  render?: (o: string) => string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-ink-900/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-sky-500/50"
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {render ? render(o) : o}
        </option>
      ))}
    </select>
  );
}

function ErrorBox({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200 flex items-center justify-between">
      <span>Could not load the agricultural-loss summary.</span>
      <button
        onClick={onRetry}
        className="rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-white text-xs"
      >
        Retry
      </button>
    </div>
  );
}

// Strip the "River — " prefix for compact labels, keeping the place name.
function shortName(name: string): string {
  const parts = name.split("—");
  return (parts[parts.length - 1] ?? name).trim();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
