import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Send,
  CheckCircle2,
  Loader2,
  Phone,
  Clock,
  MapPin,
  LifeBuoy,
} from "lucide-react";
import { api } from "../api";
import type { Pilot, Report, ReportInput } from "../types";

const HAZARDS = [
  "River flooding",
  "Urban waterlogging",
  "Embankment / bund breach",
  "People stranded",
  "Road / bridge damage",
  "Power / communication outage",
  "Need rescue / relief",
  "Other",
];
const SEVERITIES = ["low", "medium", "high", "critical"];

const SEV_COLOR: Record<string, string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

const EMERGENCY = [
  { label: "National Emergency", num: "112" },
  { label: "Disaster (NDMA)", num: "1078" },
  { label: "Ambulance", num: "108" },
  { label: "Flood Control (Bihar)", num: "0612-2217305" },
];

const empty: ReportInput = {
  reporter_name: "",
  contact: "",
  location: "",
  hazard_type: HAZARDS[0],
  severity: "high",
  description: "",
  pilot: null,
};

export default function ReportPage() {
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [form, setForm] = useState<ReportInput>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  function loadReports() {
    setLoadingList(true);
    api
      .reports(30)
      .then(setReports)
      .catch(() => undefined)
      .finally(() => setLoadingList(false));
  }

  useEffect(() => {
    api.pilots().then(setPilots).catch(() => undefined);
    loadReports();
  }, []);

  function set<K extends keyof ReportInput>(k: K, v: ReportInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.location.trim() || !form.reporter_name.trim()) {
      setError("Please provide at least your name and the location.");
      return;
    }
    setSubmitting(true);
    try {
      await api.submitReport(form);
      setDone(true);
      setForm(empty);
      loadReports();
      setTimeout(() => setDone(false), 4000);
    } catch {
      setError("Could not submit the report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="flex items-center gap-2 mb-1">
          <LifeBuoy className="h-6 w-6 text-rose-400" />
          <h1 className="text-2xl font-extrabold">Report &amp; Respond</h1>
        </div>
        <p className="text-sm text-slate-400 mb-6 max-w-2xl">
          During a live flood, report what you see on the ground. Your reports
          help responders and neighbours act faster. For life-threatening
          emergencies, call the numbers below first.
        </p>

        {/* Emergency contacts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
          {EMERGENCY.map((c) => (
            <a
              key={c.num}
              href={`tel:${c.num.replace(/[^0-9]/g, "")}`}
              className="glass rounded-xl p-3 hover:border-rose-500/40 border border-white/5 transition"
            >
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Phone className="h-3.5 w-3.5 text-rose-400" /> {c.label}
              </div>
              <div className="text-lg font-bold">{c.num}</div>
            </a>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Form */}
          <form onSubmit={submit} className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" /> Submit a
              hazard report
            </h2>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Your name *">
                <input
                  value={form.reporter_name}
                  onChange={(e) => set("reporter_name", e.target.value)}
                  className="inp"
                  placeholder="Full name"
                />
              </Field>
              <Field label="Contact (phone / optional)">
                <input
                  value={form.contact}
                  onChange={(e) => set("contact", e.target.value)}
                  className="inp"
                  placeholder="Phone or email"
                />
              </Field>
            </div>

            <Field label="Location (village / town / landmark) *">
              <input
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                className="inp"
                placeholder="e.g. Danapur, near Ganga embankment"
              />
            </Field>

            <Field label="Nearest monitored river zone (optional)">
              <select
                value={form.pilot ?? ""}
                onChange={(e) => set("pilot", e.target.value || null)}
                className="inp"
              >
                <option value="">— not sure —</option>
                {pilots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Hazard type">
                <select
                  value={form.hazard_type}
                  onChange={(e) => set("hazard_type", e.target.value)}
                  className="inp"
                >
                  {HAZARDS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Severity">
                <select
                  value={form.severity}
                  onChange={(e) => set("severity", e.target.value)}
                  className="inp capitalize"
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="What is happening?">
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                className="inp resize-none"
                placeholder="Describe water level, people affected, help needed…"
              />
            </Field>

            {error && (
              <p className="text-sm text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold transition"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : done ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {done ? "Report submitted — thank you" : "Submit report"}
            </button>
            <p className="text-[11px] text-slate-600">
              Do not rely on this form for rescue. Call emergency services for
              life-threatening situations.
            </p>
          </form>

          {/* Recent reports */}
          <div className="glass rounded-2xl p-5">
            <h2 className="font-bold flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-sky-400" /> Recent community
              reports
            </h2>
            {loadingList ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-6">
                <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                Loading reports…
              </div>
            ) : reports.length === 0 ? (
              <p className="text-sm text-slate-500 py-6">
                No reports yet. Be the first to report conditions in your area.
              </p>
            ) : (
              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {reports.map((r) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl bg-ink-800/60 border border-white/5 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <MapPin className="h-3.5 w-3.5 text-sky-400" />
                        {r.location}
                      </span>
                      <span
                        className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                        style={{
                          color: SEV_COLOR[r.severity] ?? "#94a3b8",
                          background: `${SEV_COLOR[r.severity] ?? "#94a3b8"}1a`,
                        }}
                      >
                        {r.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-slate-300">
                      {r.hazard_type}
                    </p>
                    {r.description && (
                      <p className="mt-1 text-[12px] text-slate-400">
                        {r.description}
                      </p>
                    )}
                    <p className="mt-1.5 text-[10px] text-slate-600">
                      {r.reporter_name} · {formatTime(r.created_at)}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
