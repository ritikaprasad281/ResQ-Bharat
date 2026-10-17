import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardList, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { api } from "../api";
import type { Language, SituationReport as SitRep } from "../types";
import AssistantMarkdown from "./AssistantMarkdown";
import SpeakButton from "./SpeakButton";

function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} h ago` : `${Math.round(hrs / 24)} d ago`;
}

/** AI situation report: asks Gemini to synthesise the live cross-area ranking
 * into a decision-ready SITREP. Fetched on demand so it only calls the model
 * when an officer actually wants the briefing. */
export default function SituationReport() {
  const { i18n } = useTranslation();
  const [data, setData] = useState<SitRep | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function run() {
    setBusy(true);
    setError(false);
    try {
      setData(await api.situation(8, i18n.language as Language));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="px-4 sm:px-6 pb-8 max-w-6xl mx-auto w-full">
      <div className="glass rounded-2xl p-5 border border-violet-500/20">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center h-9 w-9 rounded-xl bg-violet-500/15 border border-violet-500/25">
              <ClipboardList className="h-5 w-5 text-violet-300" />
            </span>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-1.5">
                AI Situation Report
                <Sparkles className="h-3.5 w-3.5 text-violet-300" />
              </h2>
              <p className="text-[12px] text-slate-400">
                Gemini synthesises the live ranking across all monitored areas
                into a control-room briefing.
              </p>
            </div>
          </div>
          <button
            onClick={run}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600/85 hover:bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : data ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {busy
              ? "Analysing…"
              : data
              ? "Regenerate"
              : "Generate report"}
          </button>
        </div>

        {error && (
          <p className="mt-4 text-[13px] text-amber-300">
            Could not generate the report just now — please try again.
          </p>
        )}

        {data && !error && (
          <div className="mt-4 rounded-xl bg-ink-900/60 border border-white/5 p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span className="rounded-full bg-rose-500/15 text-rose-300 px-2 py-0.5 font-semibold">
                  {data.high_or_severe_count} high/severe
                </span>
                <span className="rounded-full bg-white/5 px-2 py-0.5">
                  {data.assessed}/{data.total} areas assessed
                </span>
                <span className="text-slate-500">
                  as of {timeAgo(data.generated_at)}
                </span>
              </div>
              <SpeakButton
                id="sitrep"
                text={data.report}
                lang={i18n.language}
              />
            </div>
            <AssistantMarkdown text={data.report} />
            <p className="mt-3 text-[11px] text-slate-600 leading-relaxed">
              AI-generated interpretation of modelled risk — not a gauge
              reading. Validate against official sources before acting.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
