import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  Users,
  IndianRupee,
  TrendingUp,
  LandPlot,
  Loader2,
  Satellite,
  Download,
  MapPin,
  Waves,
  Info,
  CalendarRange,
  ShieldAlert,
  SlidersHorizontal,
  Ruler,
  Search,
  Copy,
  Map as MapIcon,
  GitCompareArrows,
  Maximize2,
  Crosshair,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  X,
  Circle,
} from "lucide-react";
import { api } from "../api";
import type {
  ConstructionGeoJSON,
  Imagery,
  NewConstruction,
  Pilot,
} from "../types";
import MapView from "../components/MapView";
import LocationSearch from "../components/LocationSearch";
import BeforeAfterSlider, {
  type OverlayShape,
} from "../components/BeforeAfterSlider";

const DEFAULT_PILOT = "patna";
const PAGE_SIZE = 12;

function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h} h ago`;
}

type Priority = "high" | "review" | "lower";
type CatKey = "new" | "settlement" | "uncertain";

type Change = {
  idx: number;
  lon: number;
  lat: number;
  area_ha: number;
  area_km2: number;
  est_buildings: number;
  confidence: number;
  dist_river_m: number;
  in_hazard: boolean;
  catKey: CatKey;
  priority: Priority;
  score: number;
  reasons: string[];
  bbox: [number, number, number, number];
};

function centroid(ring: number[][]): [number, number] {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  return [sx / ring.length, sy / ring.length];
}

function bounds(ring: number[][]): [number, number, number, number] {
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  for (const [x, y] of ring) {
    if (x < w) w = x;
    if (x > e) e = x;
    if (y < s) s = y;
    if (y > n) n = y;
  }
  return [w, s, e, n];
}

function catKeyOf(conf: number): CatKey {
  return conf >= 3 ? "new" : conf === 2 ? "settlement" : "uncertain";
}

const CAT_META: Record<CatKey, { label: string; color: string; dot: string }> = {
  new: {
    label: "Potential new construction",
    color: "text-pink-300",
    dot: "bg-pink-500",
  },
  settlement: {
    label: "Possible settlement expansion",
    color: "text-amber-300",
    dot: "bg-amber-500",
  },
  uncertain: {
    label: "Uncertain land-cover change",
    color: "text-slate-300",
    dot: "bg-slate-400",
  },
};

const PRIORITY_META: Record<
  Priority,
  { label: string; text: string; ring: string; dot: string; rank: number }
> = {
  high: {
    label: "High priority",
    text: "text-rose-300",
    ring: "border-rose-500/40 bg-rose-500/10",
    dot: "bg-rose-500",
    rank: 0,
  },
  review: {
    label: "Review",
    text: "text-amber-300",
    ring: "border-amber-500/40 bg-amber-500/10",
    dot: "bg-amber-500",
    rank: 1,
  },
  lower: {
    label: "Lower priority",
    text: "text-slate-300",
    ring: "border-white/10 bg-white/5",
    dot: "bg-slate-500",
    rank: 2,
  },
};

// Transparent, evidence-based priority. Confidence (signal agreement) and
// flood risk are kept as separate inputs; proximity alone is never treated as
// "safe" or as a confirmed building.
function priorityOf(c: {
  in_hazard: boolean;
  dist_river_m: number;
  confidence: number;
}): { level: Priority; reasons: string[] } {
  const reasons: string[] = [];
  if (c.in_hazard) reasons.push("Intersects modelled flood-hazard area");
  if (c.dist_river_m <= 100)
    reasons.push("Within 100 m of the mapped river channel");
  else if (c.dist_river_m <= 250)
    reasons.push("Within 250 m of the mapped river channel");
  else if (c.dist_river_m <= 500)
    reasons.push("Within 500 m of the mapped river channel");
  else reasons.push(`${Math.round(c.dist_river_m)} m from the river channel`);
  if (c.confidence >= 3)
    reasons.push("Strong agreement between independent change signals");
  else if (c.confidence === 2)
    reasons.push("Two independent change signals agree");
  else reasons.push("Single signal — requires manual verification");

  let level: Priority = "lower";
  if (c.in_hazard || (c.dist_river_m <= 100 && c.confidence >= 2))
    level = "high";
  else if (c.dist_river_m <= 500 || c.confidence >= 2) level = "review";
  return { level, reasons };
}

function band(d: number): string {
  if (d <= 100) return "≤100 m";
  if (d <= 250) return "100–250 m";
  if (d <= 500) return "250–500 m";
  return `${Math.round(d)} m`;
}

type ProxKey = "all" | "le500" | "0-100" | "100-250" | "250-500" | "500+";
type SortKey = "distance" | "area" | "priority" | "confidence";
type Tab = "overview" | "diagnostics" | "exposure" | "methodology";

export default function GrowthPage() {
  const { t } = useTranslation();
  const catLabel = (k: CatKey) => t(`growth.cat.${k}`);
  const prioLabel = (p: Priority) => t(`growth.priority.${p}`);
  const [params, setParams] = useSearchParams();
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [selected, setSelected] = useState<string>(params.get("pilot") ?? "");
  const [data, setData] = useState<NewConstruction>();
  const [dataAt, setDataAt] = useState<Date | null>(null);
  const [imagery, setImagery] = useState<Imagery>();
  const [imageryLoading, setImageryLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fatal, setFatal] = useState("");

  // Explorer state
  const [query, setQuery] = useState("");
  const [dquery, setDquery] = useState("");
  const [catFilter, setCatFilter] = useState<"all" | CatKey>("all");
  const [proxFilter, setProxFilter] = useState<ProxKey>("all");
  const [hazardOnly, setHazardOnly] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [minHa, setMinHa] = useState(0);
  const [sortBy, setSortBy] = useState<SortKey>("priority");
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<number | null>(null);

  // Workspace state
  const [view, setView] = useState<"comparison" | "map">("comparison");
  const [mobilePanel, setMobilePanel] = useState<"map" | "list">("map");
  const [legendOpen, setLegendOpen] = useState(true);
  const [focus, setFocus] = useState<
    [number, number, number, number] | null
  >(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [copied, setCopied] = useState<number | null>(null);

  function select(id: string) {
    setSelected(id);
    setParams({ pilot: id }, { replace: true });
  }

  useEffect(() => {
    api
      .pilots()
      .then((ps) => {
        setPilots(ps);
        const wanted = params.get("pilot");
        const valid = wanted && ps.some((p) => p.id === wanted);
        setSelected(
          (valid ? wanted : null) ??
            ps.find((p) => p.id === DEFAULT_PILOT)?.id ??
            ps[0]?.id ??
            ""
        );
      })
      .catch(() => setFatal("Cannot reach the backend API."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    setLoading(true);
    setError("");
    setData(undefined);
    setDataAt(null);
    setPicked(null);
    setFocus(null);
    setCatFilter("all");
    setProxFilter("all");
    setHazardOnly(false);
    setPriorityFilter("all");
    setQuery("");
    api
      .newConstruction(selected)
      .then((d) => {
        if (active) {
          setData(d);
          setDataAt(new Date());
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Satellite analysis is taking too long for this location — please retry in a moment."
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    setImageryLoading(true);
    setImagery(undefined);
    api
      .imagery(selected)
      .then((im) => {
        if (active) setImagery(im);
      })
      .catch(() => {
        if (active) setImagery(undefined);
      })
      .finally(() => {
        if (active) setImageryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected]);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setDquery(query.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [query]);

  const pilot = pilots.find((p) => p.id === selected);

  const totalKm2 = useMemo(
    () =>
      data?.geojson.features.reduce(
        (s, f) => s + (f.properties.area_km2 || 0),
        0
      ) ?? 0,
    [data]
  );

  const changes = useMemo<Change[]>(() => {
    if (!data || totalKm2 <= 0) return [];
    return data.geojson.features.map((f, idx) => {
      const ring = f.geometry.coordinates[0] as number[][];
      const [lon, lat] = centroid(ring);
      const p = f.properties;
      const area_km2 = p.area_km2 || 0;
      const confidence = p.confidence ?? 1;
      const dist_river_m = p.dist_river_m ?? 0;
      const in_hazard = Boolean(p.in_hazard);
      const { level, reasons } = priorityOf({
        in_hazard,
        dist_river_m,
        confidence,
      });
      // Prefer the backend's normalised, documented priority as the source of
      // truth; fall back to the local heuristic for older cached payloads.
      const level2 = p.priority_level ?? level;
      const score =
        typeof p.priority === "number"
          ? p.priority
          : level === "high"
          ? 0.6
          : level === "review"
          ? 0.4
          : 0.1;
      return {
        idx,
        lon,
        lat,
        area_km2,
        area_ha: area_km2 * 100,
        est_buildings: Math.round(data.new_buildings * (area_km2 / totalKm2)),
        confidence,
        dist_river_m,
        in_hazard,
        catKey: catKeyOf(confidence),
        priority: level2,
        score,
        reasons,
        bbox: bounds(ring),
      };
    });
  }, [data, totalKm2]);

  const kpi = useMemo(() => {
    return {
      detected: changes.length,
      near: changes.filter((c) => c.dist_river_m <= 500).length,
      hazard: changes.filter((c) => c.in_hazard).length,
      areaHa: data?.new_built_area_ha ?? 0,
      high: changes.filter((c) => c.priority === "high").length,
    };
  }, [changes, data]);

  // Full filtered + sorted set (drives the map/slider AND the paged list).
  const visible = useMemo(() => {
    const list = changes.filter((c) => {
      if (c.area_ha < minHa) return false;
      if (catFilter !== "all" && c.catKey !== catFilter) return false;
      if (hazardOnly && !c.in_hazard) return false;
      if (priorityFilter !== "all" && c.priority !== priorityFilter)
        return false;
      switch (proxFilter) {
        case "le500":
          if (c.dist_river_m > 500) return false;
          break;
        case "0-100":
          if (c.dist_river_m > 100) return false;
          break;
        case "100-250":
          if (c.dist_river_m <= 100 || c.dist_river_m > 250) return false;
          break;
        case "250-500":
          if (c.dist_river_m <= 250 || c.dist_river_m > 500) return false;
          break;
        case "500+":
          if (c.dist_river_m <= 500) return false;
          break;
      }
      if (dquery) {
        const hay = `${CAT_META[c.catKey].label} #${c.idx + 1} ${c.lat.toFixed(
          4
        )} ${c.lon.toFixed(4)}`.toLowerCase();
        if (!hay.includes(dquery)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      switch (sortBy) {
        case "distance":
          return a.dist_river_m - b.dist_river_m;
        case "area":
          return b.area_km2 - a.area_km2;
        case "confidence":
          return b.confidence - a.confidence || b.area_km2 - a.area_km2;
        default:
          return (
            b.score - a.score ||
            PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank ||
            b.area_km2 - a.area_km2
          );
      }
    });
    return list;
  }, [
    changes,
    minHa,
    catFilter,
    proxFilter,
    hazardOnly,
    priorityFilter,
    dquery,
    sortBy,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    dquery,
    catFilter,
    proxFilter,
    hazardOnly,
    priorityFilter,
    minHa,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = useMemo(
    () => visible.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE),
    [visible, pageSafe]
  );

  // GeoJSON for the interactive map (all filtered features, not paged).
  const mapData = useMemo<ConstructionGeoJSON | undefined>(() => {
    if (!data) return undefined;
    return {
      type: "FeatureCollection",
      features: visible.map((c) => ({
        ...data.geojson.features[c.idx],
        properties: {
          ...data.geojson.features[c.idx].properties,
          _idx: c.idx,
        },
      })),
    } as ConstructionGeoJSON;
  }, [data, visible]);

  // Polygons projected into the slider image space (EPSG:4326 over region_bbox).
  const shapes = useMemo<OverlayShape[]>(() => {
    if (!data || !imagery) return [];
    const [w, s, e, n] = imagery.region_bbox;
    if (e === w || n === s) return [];
    const sx = (lon: number) => ((lon - w) / (e - w)) * 1000;
    const sy = (lat: number) => ((n - lat) / (n - s)) * 1000;
    return visible.map((c) => {
      const ring = data.geojson.features[c.idx].geometry
        .coordinates[0] as number[][];
      const points = ring
        .map(([lon, lat]) => `${sx(lon).toFixed(1)},${sy(lat).toFixed(1)}`)
        .join(" ");
      const col = CAT_META[c.catKey];
      const fill =
        c.catKey === "new"
          ? "#ec4899"
          : c.catKey === "settlement"
          ? "#f59e0b"
          : "#94a3b8";
      const stroke =
        c.catKey === "new"
          ? "#fbcfe8"
          : c.catKey === "settlement"
          ? "#fde68a"
          : "#e2e8f0";
      void col;
      return { idx: c.idx, points, fill, stroke };
    });
  }, [data, imagery, visible]);

  const pick = picked != null ? changes.find((c) => c.idx === picked) : null;

  function selectDetection(idx: number) {
    const next = idx === picked ? null : idx;
    setPicked(next);
    if (next != null) {
      const c = changes.find((x) => x.idx === next);
      if (c) setFocus(c.bbox);
    }
  }

  function fitAll() {
    if (visible.length === 0) return;
    let w = Infinity,
      s = Infinity,
      e = -Infinity,
      n = -Infinity;
    for (const c of visible) {
      w = Math.min(w, c.bbox[0]);
      s = Math.min(s, c.bbox[1]);
      e = Math.max(e, c.bbox[2]);
      n = Math.max(n, c.bbox[3]);
    }
    setFocus([w, s, e, n]);
  }

  function resetRegion() {
    if (imagery) setFocus([...imagery.region_bbox]);
    else setFocus(null);
  }

  function copyCoords(c: Change) {
    navigator.clipboard
      ?.writeText(`${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}`)
      .then(() => {
        setCopied(c.idx);
        setTimeout(() => setCopied((v) => (v === c.idx ? null : v)), 1200);
      })
      .catch(() => {});
  }

  function exportCsv(scope: "filtered" | "all") {
    const rows = scope === "filtered" ? visible : changes;
    const header = [
      "change_id",
      "latitude",
      "longitude",
      "area_hectares",
      "estimated_buildings",
      "confidence_1to3",
      "change_type",
      "priority",
      "distance_to_river_m",
      "in_flood_hazard_zone",
      "validation_status",
      "detection_method",
    ];
    const body = rows.map((c) => [
      c.idx + 1,
      c.lat.toFixed(5),
      c.lon.toFixed(5),
      c.area_ha.toFixed(3),
      c.est_buildings,
      c.confidence,
      `"${CAT_META[c.catKey].label}"`,
      PRIORITY_META[c.priority].label,
      Math.round(c.dist_river_m),
      c.in_hazard ? "yes" : "no",
      "awaiting validation",
      `"${data?.algorithm_version ?? "multi-signal-v2"}"`,
    ]);
    const csv = [header, ...body].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `floodplain-${selected}-${scope}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (fatal) {
    return (
      <div className="flex-1 grid place-items-center p-4">
        <div className="glass rounded-2xl p-8 text-center max-w-sm">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-3" />
          <p className="font-semibold mb-1">{t("growth.backendUnavailable")}</p>
          <p className="text-sm text-slate-400">{fatal}</p>
        </div>
      </div>
    );
  }

  const imageryReady =
    imagery && imagery.baseline.available && imagery.recent.available;

  const KPIS: {
    key: string;
    icon: typeof Building2;
    value: string;
    label: string;
    tone: string;
    active: boolean;
    onClick: () => void;
  }[] = [
    {
      key: "detected",
      icon: Satellite,
      value: fmt(kpi.detected),
      label: t("growth.kpi.detected"),
      tone: "text-cyan-300",
      active:
        catFilter === "all" &&
        proxFilter === "all" &&
        !hazardOnly &&
        priorityFilter === "all",
      onClick: () => {
        setCatFilter("all");
        setProxFilter("all");
        setHazardOnly(false);
        setPriorityFilter("all");
      },
    },
    {
      key: "near",
      icon: Ruler,
      value: fmt(kpi.near),
      label: t("growth.kpi.near"),
      tone: "text-sky-300",
      active: proxFilter === "le500",
      onClick: () => setProxFilter(proxFilter === "le500" ? "all" : "le500"),
    },
    {
      key: "hazard",
      icon: Waves,
      value: fmt(kpi.hazard),
      label: t("growth.kpi.hazard"),
      tone: "text-rose-300",
      active: hazardOnly,
      onClick: () => setHazardOnly((v) => !v),
    },
    {
      key: "area",
      icon: LandPlot,
      value: `${fmt(Number(kpi.areaHa.toFixed(1)))} ha`,
      label: t("growth.kpi.area"),
      tone: "text-emerald-300",
      active: false,
      onClick: () => setTab("exposure"),
    },
    {
      key: "high",
      icon: ShieldAlert,
      value: fmt(kpi.high),
      label: t("growth.kpi.high"),
      tone: "text-amber-300",
      active: priorityFilter === "high",
      onClick: () =>
        setPriorityFilter(priorityFilter === "high" ? "all" : "high"),
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto w-full px-3 sm:px-5 py-4 space-y-4">
        {/* ===== A. Compact header ===== */}
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-500/10 border border-pink-500/20 px-2.5 py-0.5 text-[10px] text-pink-300">
              <Satellite className="h-3 w-3" />
              {t("growth.badge")}
            </span>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight">
              {t("growth.title")}
            </h1>
            <p className="text-[12px] text-slate-400">
              {t("growth.subtitle")}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="w-full sm:w-72">
              <LocationSearch
                pilots={pilots}
                value={selected}
                onSelect={select}
                placeholder={t("growth.searchPlaceholder")}
              />
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              {data && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-900/50 px-2.5 py-1.5">
                  <CalendarRange className="h-3.5 w-3.5 text-cyan-300" />
                  {data.period.baseline} → {data.period.recent}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-900/50 px-2.5 py-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    loading ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                  }`}
                />
                {loading
                  ? t("growth.computing")
                  : dataAt
                  ? `Live · ${timeAgo(dataAt)}`
                  : "—"}
              </span>
            </div>
          </div>
        </header>

        {/* ===== B. KPI strip ===== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {KPIS.map((k) => (
            <button
              key={k.key}
              onClick={k.onClick}
              className={`text-left rounded-xl border px-3 py-2.5 transition ${
                k.active
                  ? "border-cyan-500/50 bg-cyan-500/10"
                  : "border-white/10 bg-ink-900/50 hover:border-white/25"
              }`}
            >
              <div className="flex items-center justify-between">
                <k.icon className={`h-4 w-4 ${k.tone}`} />
                {k.active && <Circle className="h-2 w-2 fill-cyan-400 text-cyan-400" />}
              </div>
              <div className="mt-1 text-xl font-extrabold tracking-tight">
                {loading ? "—" : k.value}
              </div>
              <div className="text-[10px] text-slate-400 leading-tight">
                {k.label}
              </div>
            </button>
          ))}
        </div>

        {error && !loading && (
          <div className="glass rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ===== C. Geospatial workspace ===== */}
        {/* Mobile panel switch */}
        <div className="lg:hidden">
          <Segmented
            value={mobilePanel}
            onChange={(v) => setMobilePanel(v as "map" | "list")}
            options={[
              { key: "map", label: t("growth.workspace"), icon: MapIcon },
              { key: "list", label: `${t("growth.detections")} (${visible.length})`, icon: Search },
            ]}
          />
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-3 items-stretch">
          {/* Map / slider */}
          <div
            className={`${
              mobilePanel === "map" ? "block" : "hidden"
            } lg:block space-y-2`}
          >
            {/* Workspace toolbar */}
            <div className="flex items-center justify-between gap-2">
              <Segmented
                value={view}
                onChange={(v) => setView(v as "comparison" | "map")}
                options={[
                  { key: "comparison", label: t("growth.compare"), icon: GitCompareArrows },
                  { key: "map", label: t("growth.map"), icon: MapIcon },
                ]}
              />
              {view === "map" && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={fitAll}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-ink-900/60 hover:border-white/25 px-2 py-1.5 text-[11px]"
                    title="Fit all results"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    {t("growth.fitAll")}
                  </button>
                  <button
                    onClick={resetRegion}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-ink-900/60 hover:border-white/25 px-2 py-1.5 text-[11px]"
                    title="Reset to study region"
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                    {t("growth.region")}
                  </button>
                </div>
              )}
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-white/5">
              {/* Comparison view */}
              {view === "comparison" && (
                <>
                  {imageryLoading && (
                    <div className="aspect-[3/2] w-full grid place-items-center bg-ink-900/60">
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                        {t("growth.buildingComposites")}
                      </div>
                    </div>
                  )}
                  {!imageryLoading && imageryReady && (
                    <BeforeAfterSlider
                      beforeUrl={imagery!.baseline.url!}
                      afterUrl={imagery!.recent.url!}
                      beforeLabel={imagery!.baseline.label}
                      afterLabel={imagery!.recent.label}
                      shapes={shapes}
                      selectedIdx={picked}
                      onSelect={selectDetection}
                    />
                  )}
                  {!imageryLoading && !imageryReady && pilot && (
                    <div className="h-[clamp(360px,56vh,560px)]">
                      <MapView
                        pilot={pilot}
                        construction={mapData}
                        selectedIdx={picked}
                        onSelectFeature={selectDetection}
                        focus={focus}
                      />
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 glass rounded-full px-3 py-1.5 text-[11px] text-slate-300">
                        {t("growth.comparisonUnavailable")}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Interactive map view */}
              {view === "map" && pilot && (
                <div className="h-[clamp(360px,56vh,560px)]">
                  <MapView
                    pilot={pilot}
                    construction={mapData}
                    selectedIdx={picked}
                    onSelectFeature={selectDetection}
                    focus={focus}
                  />
                </div>
              )}

              {loading && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 glass rounded-full px-3 py-1.5 flex items-center gap-2 text-[11px]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-pink-400" />
                  {t("growth.detectingChange")}
                </div>
              )}

              {/* Collapsible legend */}
              <div className="absolute bottom-3 left-3">
                {legendOpen ? (
                  <div className="glass rounded-xl px-3 py-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-6 mb-0.5">
                      <span className="text-[10px] uppercase tracking-wide text-slate-500">
                        {t("growth.legend")}
                      </span>
                      <button
                        onClick={() => setLegendOpen(false)}
                        className="text-slate-500 hover:text-slate-300"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <LegendRow color="bg-pink-500" label={catLabel("new")} />
                    <LegendRow color="bg-amber-500" label={catLabel("settlement")} />
                    <LegendRow color="bg-slate-400" label={catLabel("uncertain")} />
                  </div>
                ) : (
                  <button
                    onClick={() => setLegendOpen(true)}
                    className="glass rounded-lg px-2 py-1.5 text-[10px] text-slate-300 inline-flex items-center gap-1"
                  >
                    <Info className="h-3 w-3" />
                    {t("growth.legend")}
                  </button>
                )}
              </div>
            </div>

            {/* Imagery provenance (compact) */}
            {view === "comparison" && imageryReady && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <Meta
                  k="Source"
                  v={imagery!.source}
                  sub={`${imagery!.baseline.scenes}/${imagery!.recent.scenes} scenes`}
                />
                <Meta k="Resolution" v="10 m / pixel" sub="Sentinel-2 L2A" />
                <Meta
                  k="Bounds (W,S,E,N)"
                  v={imagery!.region_bbox.map((n) => n.toFixed(3)).join(", ")}
                  sub="EPSG:4326"
                />
                <Meta
                  k="Algorithm"
                  v={data?.algorithm_version ?? "multi-signal"}
                  sub={data ? `${fmt(data.candidate_count)} candidates` : "…"}
                />
              </div>
            )}
          </div>

          {/* Detection explorer */}
          <div
            className={`${
              mobilePanel === "list" ? "flex" : "hidden"
            } lg:flex flex-col glass rounded-2xl overflow-hidden lg:max-h-[640px]`}
          >
            {/* Explorer header */}
            <div className="p-3 border-b border-white/5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-sm flex items-center gap-1.5">
                  <Search className="h-4 w-4 text-cyan-300" />
                  {t("growth.explorer")}
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => exportCsv("filtered")}
                    disabled={visible.length === 0}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-ink-900/60 hover:border-cyan-500/40 disabled:opacity-40 px-2 py-1 text-[10px]"
                    title="Export filtered results"
                  >
                    <Download className="h-3 w-3" />
                    {t("growth.filtered")}
                  </button>
                  <button
                    onClick={() => exportCsv("all")}
                    disabled={changes.length === 0}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-ink-900/60 hover:border-white/25 disabled:opacity-40 px-2 py-1 text-[10px]"
                    title="Export all results"
                  >
                    All
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("growth.coordPlaceholder")}
                  className="w-full rounded-lg bg-ink-900/60 border border-white/10 focus:border-cyan-500/50 outline-none pl-8 pr-2 py-1.5 text-[12px]"
                />
              </div>

              {/* Category chips */}
              <div className="flex flex-wrap gap-1">
                <Chip
                  active={catFilter === "all"}
                  onClick={() => setCatFilter("all")}
                  label={t("growth.all")}
                />
                <Chip
                  active={catFilter === "new"}
                  onClick={() => setCatFilter("new")}
                  label={catLabel("new")}
                  dot="bg-pink-500"
                />
                <Chip
                  active={catFilter === "settlement"}
                  onClick={() => setCatFilter("settlement")}
                  label={catLabel("settlement")}
                  dot="bg-amber-500"
                />
                <Chip
                  active={catFilter === "uncertain"}
                  onClick={() => setCatFilter("uncertain")}
                  label={catLabel("uncertain")}
                  dot="bg-slate-400"
                />
              </div>

              {/* Proximity + hazard + sort */}
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  value={proxFilter}
                  onChange={(e) => setProxFilter(e.target.value as ProxKey)}
                  className="rounded-lg bg-ink-900/60 border border-white/10 text-[11px] py-1 px-1.5"
                  aria-label="River proximity filter"
                >
                  <option value="all">Any distance</option>
                  <option value="le500">≤ 500 m</option>
                  <option value="0-100">≤ 100 m</option>
                  <option value="100-250">100–250 m</option>
                  <option value="250-500">250–500 m</option>
                  <option value="500+">&gt; 500 m</option>
                </select>
                <select
                  value={minHa}
                  onChange={(e) => setMinHa(Number(e.target.value))}
                  className="rounded-lg bg-ink-900/60 border border-white/10 text-[11px] py-1 px-1.5"
                  aria-label="Minimum area"
                >
                  <option value={0}>Any size</option>
                  <option value={0.25}>≥ 0.25 ha</option>
                  <option value={0.5}>≥ 0.5 ha</option>
                  <option value={1}>≥ 1 ha</option>
                </select>
                <button
                  onClick={() => setHazardOnly((v) => !v)}
                  className={`rounded-lg px-2 py-1 text-[11px] border ${
                    hazardOnly
                      ? "border-rose-500/50 bg-rose-500/10 text-rose-200"
                      : "border-white/10 bg-ink-900/60 text-slate-400"
                  }`}
                >
                  {t("growth.hazardOnly")}
                </button>
                <div className="relative inline-flex items-center">
                  <ArrowUpDown className="absolute left-1.5 h-3 w-3 text-slate-500 pointer-events-none" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                    className="rounded-lg bg-ink-900/60 border border-white/10 text-[11px] py-1 pl-6 pr-1.5"
                    aria-label="Sort by"
                  >
                    <option value="priority">Priority</option>
                    <option value="distance">River distance</option>
                    <option value="area">Area</option>
                    <option value="confidence">Confidence</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  {loading
                    ? "Computing…"
                    : `${fmt(visible.length)} result${
                        visible.length === 1 ? "" : "s"
                      }`}
                </span>
                {(catFilter !== "all" ||
                  proxFilter !== "all" ||
                  hazardOnly ||
                  priorityFilter !== "all" ||
                  minHa > 0 ||
                  dquery) && (
                  <button
                    onClick={() => {
                      setCatFilter("all");
                      setProxFilter("all");
                      setHazardOnly(false);
                      setPriorityFilter("all");
                      setMinHa(0);
                      setQuery("");
                    }}
                    className="text-cyan-300 hover:underline"
                  >
                    {t("growth.clearFilters")}
                  </button>
                )}
              </div>
            </div>

            {/* Selected inspector */}
            {pick && (
              <div
                className={`m-2 rounded-xl border p-2.5 text-[11px] space-y-1.5 ${
                  PRIORITY_META[pick.priority].ring
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1.5 font-semibold ${
                      PRIORITY_META[pick.priority].text
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        PRIORITY_META[pick.priority].dot
                      }`}
                    />
                    {prioLabel(pick.priority)} · #{pick.idx + 1}
                  </span>
                  <button
                    onClick={() => setPicked(null)}
                    className="text-slate-500 hover:text-slate-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Row k="Classification" v={catLabel(pick.catKey)} />
                <Row
                  k="Review priority"
                  v={`${pick.score.toFixed(2)} / 1.00`}
                />
                <Row k="Changed area" v={`${pick.area_ha.toFixed(3)} ha`} />
                <Row
                  k="Distance to river"
                  v={`${Math.round(pick.dist_river_m)} m (${band(
                    pick.dist_river_m
                  )})`}
                />
                <Row
                  k="Flood hazard"
                  v={pick.in_hazard ? "Intersects HAND zone" : "Outside hazard"}
                />
                <Row
                  k="Signal agreement"
                  v={`${pick.confidence} of 3`}
                />
                <Row
                  k="Est. buildings"
                  v={`${fmt(pick.est_buildings)} (estimate)`}
                />
                <div className="pt-1 border-t border-white/5">
                  <div className="text-slate-500 mb-1">Why this priority</div>
                  <ul className="space-y-0.5">
                    {pick.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="mt-1 h-1 w-1 rounded-full bg-slate-500 shrink-0" />
                        <span className="text-slate-300">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => copyCoords(pick)}
                  className="mt-1 inline-flex items-center gap-1 text-cyan-300 hover:underline"
                >
                  <Copy className="h-3 w-3" />
                  {copied === pick.idx
                    ? "Copied"
                    : `${pick.lat.toFixed(5)}, ${pick.lon.toFixed(5)}`}
                </button>
              </div>
            )}

            {/* Rows */}
            <div className="flex-1 overflow-y-auto min-h-[200px] px-2 py-2 space-y-1">
              {loading && (
                <div className="h-full grid place-items-center text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-pink-400" />
                </div>
              )}
              {!loading && visible.length === 0 && (
                <div className="h-full grid place-items-center text-center px-4">
                  <p className="text-sm text-slate-400">
                    {changes.length === 0
                      ? t("growth.noChanges")
                      : t("growth.noMatch")}
                  </p>
                </div>
              )}
              {!loading &&
                paged.map((c) => (
                  <DetectionRow
                    key={c.idx}
                    c={c}
                    active={c.idx === picked}
                    onClick={() => selectDetection(c.idx)}
                  />
                ))}
            </div>

            {/* Pagination */}
            {!loading && visible.length > PAGE_SIZE && (
              <div className="p-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                <button
                  disabled={pageSafe <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 disabled:opacity-40 hover:border-white/25"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  {t("growth.prev")}
                </button>
                <span className="text-slate-500">
                  Page {pageSafe} / {totalPages}
                </span>
                <button
                  disabled={pageSafe >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 disabled:opacity-40 hover:border-white/25"
                >
                  {t("growth.next")}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ===== D. Secondary analytics (tabbed) ===== */}
        {!loading && data && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="flex border-b border-white/5 overflow-x-auto">
              {(
                [
                  ["overview", t("growth.tabs.overview")],
                  ["diagnostics", t("growth.tabs.diagnostics")],
                  ["exposure", t("growth.tabs.exposure")],
                  ["methodology", t("growth.tabs.methodology")],
                ] as [Tab, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`px-4 py-2.5 text-[12px] font-medium whitespace-nowrap border-b-2 -mb-px transition ${
                    tab === k
                      ? "border-cyan-400 text-white"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="p-4">
              {tab === "overview" && (
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <h4 className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">
                      By change type
                    </h4>
                    <div className="space-y-1.5">
                      {(["new", "settlement", "uncertain"] as CatKey[]).map(
                        (k) => (
                          <BreakdownRow
                            key={k}
                            dot={CAT_META[k].dot}
                            label={catLabel(k)}
                            value={changes.filter((c) => c.catKey === k).length}
                            total={changes.length}
                            onClick={() => setCatFilter(k)}
                          />
                        )
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">
                      By river proximity
                    </h4>
                    <div className="space-y-1.5">
                      <BreakdownRow
                        dot="bg-sky-400"
                        label="≤ 100 m"
                        value={changes.filter((c) => c.dist_river_m <= 100).length}
                        total={changes.length}
                        onClick={() => setProxFilter("0-100")}
                      />
                      <BreakdownRow
                        dot="bg-sky-500"
                        label="100–250 m"
                        value={
                          changes.filter(
                            (c) => c.dist_river_m > 100 && c.dist_river_m <= 250
                          ).length
                        }
                        total={changes.length}
                        onClick={() => setProxFilter("100-250")}
                      />
                      <BreakdownRow
                        dot="bg-sky-600"
                        label="250–500 m"
                        value={
                          changes.filter(
                            (c) => c.dist_river_m > 250 && c.dist_river_m <= 500
                          ).length
                        }
                        total={changes.length}
                        onClick={() => setProxFilter("250-500")}
                      />
                      <BreakdownRow
                        dot="bg-slate-600"
                        label="> 500 m"
                        value={changes.filter((c) => c.dist_river_m > 500).length}
                        total={changes.length}
                        onClick={() => setProxFilter("500+")}
                      />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">
                      By priority
                    </h4>
                    <div className="space-y-1.5">
                      {(["high", "review", "lower"] as Priority[]).map((k) => (
                        <BreakdownRow
                          key={k}
                          dot={PRIORITY_META[k].dot}
                          label={prioLabel(k)}
                          value={changes.filter((c) => c.priority === k).length}
                          total={changes.length}
                          onClick={() => setPriorityFilter(k)}
                        />
                      ))}
                    </div>
                    <p className="mt-3 text-[10px] text-slate-500 leading-relaxed">
                      A normalised 0-1 review score blends flood-hazard overlap
                      (40%), river proximity (25%), change-signal agreement
                      (25%) and changed area (10%). It ranks what to inspect
                      first, not a calibrated flood-risk probability.
                    </p>
                  </div>
                </div>
              )}

              {tab === "diagnostics" && (
                <div>
                  <div className="flex flex-wrap items-stretch gap-2">
                    {data.stages.map((s, i) => (
                      <div key={s.stage} className="flex items-center gap-2">
                        <div className="rounded-xl bg-ink-900/50 border border-white/5 p-3 min-w-[150px]">
                          <div className="text-[10px] text-slate-500 flex items-center gap-1">
                            <span className="h-4 w-4 grid place-items-center rounded bg-white/5 text-[9px]">
                              {i + 1}
                            </span>
                            {s.stage}
                          </div>
                          <div className="text-base font-extrabold tracking-tight mt-1">
                            {fmt(Number(s.area_ha.toFixed(1)))} ha
                          </div>
                        </div>
                        {i < data.stages.length - 1 && (
                          <ChevronRight className="h-4 w-4 text-slate-600 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 text-slate-300 font-medium">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Thresholds
                    </span>
                    {Object.entries(data.detection.thresholds).map(([k, v]) => (
                      <span key={k}>
                        {k}={v}
                      </span>
                    ))}
                    <span>·</span>
                    <span>buffer {data.detection.buffer_m} m</span>
                    <span>·</span>
                    <span>scale {data.detection.scale_m} m</span>
                    <span>·</span>
                    <span>min {data.detection.min_area_m2} m²</span>
                  </div>
                </div>
              )}

              {tab === "exposure" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <ExpoCard
                      label="≤ 100 m"
                      value={`${fmt(
                        changes.filter((c) => c.dist_river_m <= 100).length
                      )}`}
                      note="immediate bank"
                    />
                    <ExpoCard
                      label="100–250 m"
                      value={`${fmt(
                        changes.filter(
                          (c) => c.dist_river_m > 100 && c.dist_river_m <= 250
                        ).length
                      )}`}
                      note="near river"
                    />
                    <ExpoCard
                      label="250–500 m"
                      value={`${fmt(
                        changes.filter(
                          (c) => c.dist_river_m > 250 && c.dist_river_m <= 500
                        ).length
                      )}`}
                      note="extended corridor"
                    />
                    <ExpoCard
                      label="In flood hazard"
                      value={`${fmt(kpi.hazard)}`}
                      note="HAND intersection"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 mb-2">
                      Modelled estimates (not confirmed impact) — derived from
                      changed area, not surveyed buildings.
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <EstCard
                        icon={Building2}
                        value={fmt(data.new_buildings)}
                        label="Potential buildings"
                      />
                      <EstCard
                        icon={Users}
                        value={fmt(data.population_at_risk)}
                        label="People (≈5/household)"
                      />
                      <EstCard
                        icon={IndianRupee}
                        value={`₹${fmt(data.asset_value_crore)} Cr`}
                        label="Asset value"
                      />
                      <EstCard
                        icon={TrendingUp}
                        value={`₹${fmt(data.expected_damage_crore)} Cr`}
                        label={`Damage (${Math.round(
                          data.damage_factor * 100
                        )}%)`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {tab === "methodology" && (
                <div className="grid sm:grid-cols-2 gap-4 text-[12px]">
                  <div className="space-y-1.5">
                    <Row
                      k="Baseline window"
                      v={imagery?.baseline.label ?? data.period.baseline}
                    />
                    <Row
                      k="Recent window"
                      v={imagery?.recent.label ?? data.period.recent}
                    />
                    <Row k="Source imagery" v="Sentinel-2 L2A / Dynamic World" />
                    <Row k="Spatial resolution" v="10 m / pixel" />
                    <Row k="Detection buffer" v={`${data.detection.buffer_m} m`} />
                    <Row
                      k="Min mapped area"
                      v={`${data.detection.min_area_m2} m²`}
                    />
                    <Row k="Algorithm" v={data.algorithm_version} />
                    <Row
                      k="Data freshness"
                      v={dataAt ? `Computed ${timeAgo(dataAt)}` : "—"}
                    />
                  </div>
                  <div className="space-y-2 text-[11px] text-slate-400 leading-relaxed">
                    <p>
                      <span className="text-slate-200 font-medium">
                        Validation status:
                      </span>{" "}
                      all detections are candidate observations awaiting field
                      confirmation. No ground-truth store exists yet.
                    </p>
                    <p>
                      <span className="text-slate-200 font-medium">
                        Limitations:
                      </span>{" "}
                      satellite-derived changes may include vegetation loss,
                      exposed soil, agriculture, or water-level changes — not
                      only new buildings. Confidence reflects how many
                      independent signals agreed, not a calibrated probability.
                    </p>
                    <p>{data.disclaimer}</p>
                    <p className="text-slate-500">
                      AI generated analysis — please validate.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- small presentational helpers ---------- */

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { key: string; label: string; icon: typeof MapIcon }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-ink-900/60 p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition ${
            value === o.key
              ? "bg-white/10 text-white"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <o.icon className="h-3.5 w-3.5" />
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  dot?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium border transition ${
        active
          ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
          : "border-white/10 bg-ink-900/60 text-slate-400 hover:border-white/25"
      }`}
    >
      {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
      {label}
    </button>
  );
}

function DetectionRow({
  c,
  active,
  onClick,
}: {
  c: Change;
  active: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border px-2.5 py-2 transition ${
        active
          ? "border-cyan-500/50 bg-cyan-500/10"
          : "border-white/5 bg-ink-900/40 hover:border-white/20"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${
              PRIORITY_META[c.priority].dot
            }`}
          />
          <span className={`text-[11px] font-semibold truncate ${CAT_META[c.catKey].color}`}>
            {t(`growth.cat.${c.catKey}`)}
          </span>
        </span>
        <span className="text-[11px] text-slate-300 shrink-0">
          {c.area_ha.toFixed(2)} ha
        </span>
      </div>
      <div className="mt-0.5 flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Ruler className="h-3 w-3" />
          {band(c.dist_river_m)}
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {c.lat.toFixed(3)}, {c.lon.toFixed(3)}
        </span>
        {c.in_hazard && <span className="text-rose-300">hazard</span>}
        <span className="text-slate-600">· {c.confidence}/3</span>
      </div>
    </button>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-500">{k}</span>
      <span className="text-slate-200 text-right">{v}</span>
    </div>
  );
}

function Meta({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="rounded-lg bg-ink-900/50 border border-white/5 px-2.5 py-2">
      <div className="text-slate-500">{k}</div>
      <div className="text-slate-200 font-medium truncate" title={v}>
        {v}
      </div>
      <div className="text-slate-500 text-[10px]">{sub}</div>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
      <span className="text-[11px] text-slate-300">{label}</span>
    </div>
  );
}

function ExpoCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-xl bg-ink-900/50 border border-white/5 p-3">
      <div className="text-slate-500 text-[11px]">{label}</div>
      <div className="text-slate-100 font-extrabold text-lg mt-0.5">{value}</div>
      <div className="text-slate-500 text-[10px] mt-0.5">{note}</div>
    </div>
  );
}

function EstCard({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Building2;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-xl bg-ink-900/50 border border-white/5 p-3">
      <Icon className="h-4 w-4 text-slate-400" />
      <div className="mt-1 text-base font-extrabold tracking-tight">{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}

function BreakdownRow({
  dot,
  label,
  value,
  total,
  onClick,
}: {
  dot: string;
  label: string;
  value: number;
  total: number;
  onClick: () => void;
}) {
  const pctv = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <button
      onClick={onClick}
      className="w-full group"
      title="Filter to this group"
    >
      <div className="flex items-center justify-between text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-slate-300">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          {label}
        </span>
        <span className="text-slate-400">
          {fmt(value)} <span className="text-slate-600">· {pctv}%</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full ${dot} opacity-70 group-hover:opacity-100 transition`}
          style={{ width: `${pctv}%` }}
        />
      </div>
    </button>
  );
}
