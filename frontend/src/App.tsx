import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { api } from "./api";
import type {
  Damage,
  FloodEvent,
  Pilot,
  Risk,
  Validation,
  ZonesGeoJSON,
} from "./types";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import DetailPanel from "./components/DetailPanel";

export default function App() {
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [zones, setZones] = useState<ZonesGeoJSON>();
  const [risk, setRisk] = useState<Risk>();
  const [damage, setDamage] = useState<Damage>();
  const [events, setEvents] = useState<FloodEvent[]>([]);
  const [validation, setValidation] = useState<Validation>();
  const [validating, setValidating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState("");

  useEffect(() => {
    Promise.all([api.pilots(), api.events()])
      .then(([ps, ev]) => {
        setPilots(ps);
        setEvents(ev);
        setSelected(ps[0]?.id ?? "");
      })
      .catch(() => setFatal("Cannot reach the backend API."));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setZones(undefined);
    setValidation(undefined);
    Promise.all([
      api.zones(selected),
      api.risk(selected),
      api.damage(selected),
    ])
      .then(([z, r, d]) => {
        setZones(z);
        setRisk(r);
        setDamage(d);
      })
      .catch(() => setFatal("Failed loading pilot data."))
      .finally(() => setLoading(false));
  }, [selected]);

  async function validate(event: string) {
    setValidating(true);
    try {
      setValidation(await api.validate(selected, event));
    } finally {
      setValidating(false);
    }
  }

  const pilot = pilots.find((p) => p.id === selected);

  if (fatal) {
    return (
      <div className="h-full grid place-items-center">
        <div className="glass rounded-2xl p-8 text-center max-w-sm">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-3" />
          <p className="font-semibold mb-1">Backend unavailable</p>
          <p className="text-sm text-slate-400">{fatal}</p>
          <p className="text-xs text-slate-600 mt-3">
            Start it: <code>cd backend; uvicorn app.main:app --reload</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        {pilots.length > 0 && pilot && (
          <Sidebar
            pilots={pilots}
            selected={selected}
            onSelect={setSelected}
            risk={risk}
          />
        )}
        <main className="relative flex-1 min-w-0">
          {pilot && <MapView pilot={pilot} zones={zones} />}
          <Legend />
          {loading && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 glass rounded-full px-4 py-2 flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
              Computing flood zones from satellite data…
            </div>
          )}
        </main>
        {pilot && (
          <DetailPanel
            pilot={selected}
            damage={damage}
            risk={risk}
            events={events}
            validation={validation}
            onValidate={validate}
            validating={validating}
          />
        )}
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <header className="glass h-12 flex items-center px-4 gap-3 border-b border-white/5">
      <span className="text-sm font-bold tracking-tight">
        Ganga Flood Intelligence
      </span>
      <span className="text-[11px] text-slate-500">
        Satellite · Weather · AI damage estimation
      </span>
      <span className="ml-auto text-[11px] text-slate-500 flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        Live
      </span>
    </header>
  );
}

function Legend() {
  const items = [
    { c: "#3b82f6", l: "Low" },
    { c: "#eab308", l: "Moderate" },
    { c: "#f97316", l: "High" },
    { c: "#ef4444", l: "Severe" },
  ];
  return (
    <div className="absolute bottom-4 left-4 glass rounded-xl px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
        Flood-prone confidence
      </p>
      <div className="flex items-center gap-3">
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
  );
}
