import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Loader2,
  Layers,
  Crosshair,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  BarChart3,
  LayoutGrid,
  Map as MapIcon,
  Maximize2,
  ChevronDown,
  MapPin,
} from "lucide-react";
import { api } from "../api";
import type {
  Damage,
  FloodEvent,
  Pilot,
  Risk,
  TopRiskItem,
  Validation,
  ZonesGeoJSON,
} from "../types";
import MapView from "../components/MapView";
import Sidebar from "../components/Sidebar";
import IntelligencePanel from "../components/IntelligencePanel";
import Copilot from "../components/Copilot";

const DEFAULT_PILOT = "patna";

type LayoutMode = "balanced" | "map" | "analysis";
type RightTab = "analytics" | "copilot";
type MobileTab = "map" | "situation" | "intel" | "copilot";

function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : true
  );
  useEffect(() => {
    const m = window.matchMedia(query);
    const handler = () => setMatch(m.matches);
    handler();
    m.addEventListener("change", handler);
    return () => m.removeEventListener("change", handler);
  }, [query]);
  return match;
}

export default function ExplorePage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [selected, setSelected] = useState<string>(params.get("pilot") ?? "");
  const [zones, setZones] = useState<ZonesGeoJSON>();
  const [risk, setRisk] = useState<Risk>();
  const [damage, setDamage] = useState<Damage>();
  const [events, setEvents] = useState<FloodEvent[]>([]);
  const [validation, setValidation] = useState<Validation>();
  const [validating, setValidating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [topRisk, setTopRisk] = useState<TopRiskItem[]>([]);
  const [topLoading, setTopLoading] = useState(true);
  const [fatal, setFatal] = useState("");
  const [scenario, setScenario] = useState("1in25");

  // Workspace layout
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("balanced");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>("analytics");
  const [copilotExpanded, setCopilotExpanded] = useState(false);
  const [zonesVisible, setZonesVisible] = useState(true);
  const [labelsVisible, setLabelsVisible] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [focus, setFocus] = useState<
    [number, number, number, number] | null
  >(null);
  const [resizeSignal, setResizeSignal] = useState(0);
  const [mobileTab, setMobileTab] = useState<MobileTab>("map");

  const isDesktop = useMediaQuery("(min-width: 1024px)");

  function select(id: string) {
    setSelected(id);
    setParams({ pilot: id }, { replace: true });
  }

  useEffect(() => {
    Promise.all([api.pilots(), api.events()])
      .then(([ps, ev]) => {
        setPilots(ps);
        setEvents(ev);
        const wanted = params.get("pilot");
        const valid = wanted && ps.some((p) => p.id === wanted);
        setSelected(
          (valid ? wanted : null) ??
            ps.find((p) => p.id === DEFAULT_PILOT)?.id ??
            ps[0]?.id ??
            ""
        );
      })
      .catch(() => setFatal(t("intel.cannotReach")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    function load() {
      api
        .topRisk(3)
        .then((r) => active && setTopRisk(r.top))
        .catch(() => undefined)
        .finally(() => active && setTopLoading(false));
    }
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    setLoading(true);
    setZones(undefined);
    setRisk(undefined);
    setDamage(undefined);
    setValidation(undefined);
    Promise.all([api.zones(selected), api.risk(selected), api.damage(selected)])
      .then(([z, r, d]) => {
        if (!active) return;
        setZones(z);
        setRisk(r);
        setDamage(d);
      })
      .catch(() => active && setFatal(t("intel.loadFailed")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [selected]);

  // Recalculate map size whenever the surrounding layout changes.
  useEffect(() => {
    setResizeSignal((s) => s + 1);
  }, [layoutMode, sidebarCollapsed, rightTab, copilotExpanded, isDesktop]);

  const pilot = pilots.find((p) => p.id === selected);

  useEffect(() => {
    document.title = pilot
      ? `Flood Intelligence · ${pilot.name} · ResQ Bharat`
      : "Flood Intelligence · ResQ Bharat";
  }, [pilot]);

  async function validate(event: string) {
    setValidating(true);
    try {
      setValidation(await api.validate(selected, event));
    } finally {
      setValidating(false);
    }
  }

  function fitRegion() {
    if (pilot) setFocus([...pilot.bbox]);
  }

  const expanded = rightTab === "copilot" && copilotExpanded;
  const gridTemplateColumns = useMemo(() => {
    const leftW = layoutMode === "map" ? "232px" : "264px";
    const rightW = expanded
      ? "clamp(380px, 34vw, 540px)"
      : layoutMode === "analysis"
      ? "400px"
      : layoutMode === "map"
      ? "320px"
      : "360px";
    return [sidebarCollapsed ? null : leftW, "minmax(0,1fr)", rightW]
      .filter(Boolean)
      .join(" ");
  }, [layoutMode, expanded, sidebarCollapsed]);

  if (fatal) {
    return (
      <div className="flex-1 grid place-items-center p-4">
        <div className="glass rounded-2xl p-8 text-center max-w-sm">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-3" />
          <p className="font-semibold mb-1">{t("intel.backendUnavailable")}</p>
          <p className="text-sm text-slate-400">{fatal}</p>
        </div>
      </div>
    );
  }

  const regionName = pilot?.name ?? t("intel.selectedRegion");

  const mapPane = (
    <div className="relative flex-1 min-h-0">
      {pilot && (
        <MapView
          pilot={pilot}
          zones={zones}
          focus={focus}
          zonesVisible={zonesVisible}
          labelsVisible={labelsVisible}
          resizeSignal={resizeSignal}
        />
      )}
      {loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 glass rounded-full px-4 py-2 flex items-center gap-2 text-xs sm:text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-sky-400 shrink-0" />
          {t("intel.computingZones")}
        </div>
      )}
      <Legend open={legendOpen} onToggle={() => setLegendOpen((v) => !v)} />
    </div>
  );

  const toolbar = (compact: boolean) => (
    <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-ink-900/40">
      {!compact && (
        <button
          onClick={() => setSidebarCollapsed((v) => !v)}
          title={sidebarCollapsed ? t("intel.showSidebar") : t("intel.hideSidebar")}
          className="grid place-items-center h-8 w-8 rounded-lg border border-white/10 bg-ink-900/60 hover:border-white/25 text-slate-300"
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      )}
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-900/60 px-2.5 py-1.5 text-[12px] text-slate-200 min-w-0">
        <MapPin className="h-3.5 w-3.5 text-cyan-300 shrink-0" />
        <span className="truncate">{regionName}</span>
      </span>

      {/* Layers */}
      <div className="relative">
        <button
          onClick={() => setLayersOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-900/60 hover:border-white/25 px-2.5 py-1.5 text-[12px] text-slate-200"
        >
          <Layers className="h-3.5 w-3.5" />
          {t("intel.layers")}
          <ChevronDown className="h-3 w-3 text-slate-500" />
        </button>
        {layersOpen && (
          <div className="absolute z-20 mt-1 w-52 rounded-xl border border-white/10 bg-ink-900/95 backdrop-blur p-2 shadow-xl">
            <LayerToggle
              label={t("intel.floodHazardZones")}
              checked={zonesVisible}
              onChange={() => setZonesVisible((v) => !v)}
            />
            <LayerToggle
              label={t("intel.placeLabels")}
              checked={labelsVisible}
              onChange={() => setLabelsVisible((v) => !v)}
            />
            <p className="mt-1.5 px-1 text-[10px] text-slate-500 leading-snug">
              {t("intel.layersNote")}
            </p>
          </div>
        )}
      </div>

      <button
        onClick={fitRegion}
        title={t("intel.fitToRegion")}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-900/60 hover:border-white/25 px-2.5 py-1.5 text-[12px] text-slate-200"
      >
        <Crosshair className="h-3.5 w-3.5" />
        {compact ? "" : t("intel.fit")}
      </button>

      {!compact && (
        <div className="inline-flex rounded-lg border border-white/10 bg-ink-900/60 p-0.5 ml-auto">
          <ModeBtn
            active={layoutMode === "balanced"}
            onClick={() => setLayoutMode("balanced")}
            icon={<LayoutGrid className="h-3.5 w-3.5" />}
            label={t("intel.balanced")}
          />
          <ModeBtn
            active={layoutMode === "map"}
            onClick={() => setLayoutMode("map")}
            icon={<MapIcon className="h-3.5 w-3.5" />}
            label={t("intel.map")}
          />
          <ModeBtn
            active={layoutMode === "analysis"}
            onClick={() => setLayoutMode("analysis")}
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            label={t("intel.analysis")}
          />
        </div>
      )}
    </div>
  );

  const rightPanel = (
    <div className="flex flex-col h-full min-h-0 glass lg:border-l border-white/5">
      <div className="shrink-0 flex items-center gap-1 p-2 border-b border-white/5">
        <div className="inline-flex rounded-lg border border-white/10 bg-ink-900/60 p-0.5">
          <TabBtn
            active={rightTab === "analytics"}
            onClick={() => setRightTab("analytics")}
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            label={t("intel.analytics")}
          />
          <TabBtn
            active={rightTab === "copilot"}
            onClick={() => setRightTab("copilot")}
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label={t("intel.gemini")}
          />
        </div>
        {rightTab === "copilot" && (
          <button
            onClick={() => setCopilotExpanded((v) => !v)}
            title={copilotExpanded ? t("intel.collapse") : t("intel.expand")}
            className="ml-auto grid place-items-center h-7 w-7 rounded-lg border border-white/10 bg-ink-900/60 hover:border-white/25 text-slate-300"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {rightTab === "analytics" ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {pilot && (
            <IntelligencePanel
              pilot={selected}
              damage={damage}
              risk={risk}
              events={events}
              validation={validation}
              onValidate={validate}
              validating={validating}
              scenario={scenario}
              onScenario={setScenario}
            />
          )}
        </div>
      ) : (
        <Copilot
          pilot={selected}
          regionName={regionName}
          riskLevel={risk?.level}
          expanded={copilotExpanded}
          onToggleExpand={() => setCopilotExpanded((v) => !v)}
        />
      )}
    </div>
  );

  // ---------- Desktop ----------
  if (isDesktop) {
    return (
      <div
        className="hidden lg:grid flex-1 min-h-0 h-[calc(100dvh-3.5rem)] overflow-hidden"
        style={{ gridTemplateColumns }}
      >
        {!sidebarCollapsed && pilots.length > 0 && pilot && (
          <Sidebar
            pilots={pilots}
            selected={selected}
            onSelect={select}
            risk={risk}
            topRisk={topRisk}
            topLoading={topLoading}
          />
        )}
        <section className="relative flex flex-col min-w-0 min-h-0">
          {toolbar(false)}
          {mapPane}
        </section>
        {rightPanel}
      </div>
    );
  }

  // ---------- Mobile / tablet ----------
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {toolbar(true)}
      {mobileTab === "map" && (
        <div className="relative h-[60vh] min-h-[320px] flex flex-col">
          {mapPane}
        </div>
      )}
      {mobileTab === "situation" && pilots.length > 0 && pilot && (
        <div className="h-[calc(100dvh-7.5rem)] overflow-y-auto">
          <Sidebar
            pilots={pilots}
            selected={selected}
            onSelect={select}
            risk={risk}
            topRisk={topRisk}
            topLoading={topLoading}
          />
        </div>
      )}
      {mobileTab === "intel" && pilot && (
        <div className="h-[calc(100dvh-7.5rem)] overflow-y-auto p-4 glass">
          <IntelligencePanel
            pilot={selected}
            damage={damage}
            risk={risk}
            events={events}
            validation={validation}
            onValidate={validate}
            validating={validating}
            scenario={scenario}
            onScenario={setScenario}
          />
        </div>
      )}
      {mobileTab === "copilot" && (
        <div className="h-[calc(100dvh-7.5rem)] glass">
          <Copilot
            pilot={selected}
            regionName={regionName}
            riskLevel={risk?.level}
            expanded
            onToggleExpand={() => setMobileTab("map")}
          />
        </div>
      )}

      {/* Mobile bottom tab bar */}
      <nav className="shrink-0 grid grid-cols-4 border-t border-white/10 bg-ink-900/90 backdrop-blur">
        <MobileNav
          active={mobileTab === "map"}
          onClick={() => setMobileTab("map")}
          icon={<MapIcon className="h-4 w-4" />}
          label={t("intel.nav.map")}
        />
        <MobileNav
          active={mobileTab === "situation"}
          onClick={() => setMobileTab("situation")}
          icon={<LayoutGrid className="h-4 w-4" />}
          label={t("intel.nav.zones")}
        />
        <MobileNav
          active={mobileTab === "intel"}
          onClick={() => setMobileTab("intel")}
          icon={<BarChart3 className="h-4 w-4" />}
          label={t("intel.nav.intel")}
        />
        <MobileNav
          active={mobileTab === "copilot"}
          onClick={() => setMobileTab("copilot")}
          icon={<Sparkles className="h-4 w-4" />}
          label={t("intel.nav.gemini")}
        />
      </nav>
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
        active ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {icon}
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
        active ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function LayerToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className="w-full flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5 text-[12px] text-slate-200"
    >
      {label}
      <span
        className={`relative h-4 w-7 rounded-full transition ${
          checked ? "bg-cyan-500" : "bg-slate-600"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
            checked ? "left-3.5" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function MobileNav({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition ${
        active ? "text-cyan-300" : "text-slate-500"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Legend({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const items = [
    { c: "#3b82f6", l: t("risk.low") },
    { c: "#eab308", l: t("risk.medium") },
    { c: "#f97316", l: t("risk.high") },
    { c: "#ef4444", l: t("risk.severe") },
  ];
  return (
    <div className="absolute bottom-4 left-4">
      {open ? (
        <div className="glass rounded-xl px-3 py-2.5">
          <div className="flex items-center justify-between gap-6 mb-1.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              {t("intel.legendTitle")}
            </p>
            <button
              onClick={onToggle}
              className="text-slate-500 hover:text-slate-300 text-[10px]"
            >
              {t("actions.hide")}
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {items.map((i) => (
              <div key={i.l} className="flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-sm"
                  style={{ background: i.c }}
                />
                <span className="text-[11px] text-slate-300">{i.l}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={onToggle}
          className="glass rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 inline-flex items-center gap-1"
        >
          <Layers className="h-3 w-3" />
          {t("intel.legend")}
        </button>
      )}
    </div>
  );
}
