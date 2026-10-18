import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  { key: "national", num: "112" },
  { key: "disaster", num: "1078" },
  { key: "ambulance", num: "108" },
  { key: "floodControl", num: "0612-2217305" },
];

const HAZARD_KEYS: Record<string, string> = {
  "River flooding": "riverFlooding",
  "Urban waterlogging": "urbanWaterlogging",
  "Embankment / bund breach": "embankmentBreach",
  "People stranded": "peopleStranded",
  "Road / bridge damage": "roadBridgeDamage",
  "Power / communication outage": "powerOutage",
  "Need rescue / relief": "needRescue",
  Other: "other",
};

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
  const { t } = useTranslation();
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
      setError(t("report.errNameLocation"));
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
      setError(t("report.errSubmit"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="flex items-center gap-2 mb-1">
          <LifeBuoy className="h-6 w-6 text-rose-400" />
          <h1 className="text-2xl font-extrabold">{t("report.title")}</h1>
        </div>
        <p className="text-sm text-slate-400 mb-6 max-w-2xl">
          {t("report.intro")}
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
                <Phone className="h-3.5 w-3.5 text-rose-400" />{" "}
                {t(`report.emergency.${c.key}`)}
              </div>
              <div className="text-lg font-bold">{c.num}</div>
            </a>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Form */}
          <form onSubmit={submit} className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />{" "}
              {t("report.submitHazard")}
            </h2>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={t("report.yourName")}>
                <input
                  value={form.reporter_name}
                  onChange={(e) => set("reporter_name", e.target.value)}
                  className="inp"
                  placeholder={t("report.yourNamePh")}
                />
              </Field>
              <Field label={t("report.contact")}>
                <input
                  value={form.contact}
                  onChange={(e) => set("contact", e.target.value)}
                  className="inp"
                  placeholder={t("report.contactPh")}
                />
              </Field>
            </div>

            <Field label={t("report.location")}>
              <input
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                className="inp"
                placeholder={t("report.locationPh")}
              />
            </Field>

            <Field label={t("report.nearestZone")}>
              <select
                value={form.pilot ?? ""}
                onChange={(e) => set("pilot", e.target.value || null)}
                className="inp"
              >
                <option value="">{t("report.notSure")}</option>
                {pilots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={t("report.hazardType")}>
                <select
                  value={form.hazard_type}
                  onChange={(e) => set("hazard_type", e.target.value)}
                  className="inp"
                >
                  {HAZARDS.map((h) => (
                    <option key={h} value={h}>
                      {t(`report.hazards.${HAZARD_KEYS[h]}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("report.severity")}>
                <select
                  value={form.severity}
                  onChange={(e) => set("severity", e.target.value)}
                  className="inp"
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {t(`report.severities.${s}`)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label={t("report.whatHappening")}>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                className="inp resize-none"
                placeholder={t("report.whatHappeningPh")}
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
              {done ? t("report.submitted") : t("report.submit")}
            </button>
            <p className="text-[11px] text-slate-600">
              {t("report.noRescue")}
            </p>
          </form>

          {/* Recent reports */}
          <div className="glass rounded-2xl p-5">
            <h2 className="font-bold flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-sky-400" />{" "}
              {t("report.recentReports")}
            </h2>
            {loadingList ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-6">
                <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                {t("report.loadingReports")}
              </div>
            ) : reports.length === 0 ? (
              <p className="text-sm text-slate-500 py-6">
                {t("report.noReports")}
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
