import { useRef, useState } from "react";
import {
  Camera,
  ImageUp,
  Loader2,
  ScanEye,
  X,
  AlertTriangle,
} from "lucide-react";
import type { Language } from "../types";
import { api } from "../api";
import AssistantMarkdown from "./AssistantMarkdown";
import SpeakButton from "./SpeakButton";

interface Props {
  language: Language;
  location?: string;
}

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic"];

/** Multimodal flood-photo check: a resident uploads a photo of their
 * surroundings and Gemini vision returns an honest, safety-first hazard
 * assessment. It never fabricates exact depths, facilities, or locations. */
export default function PhotoCheck({ language, location }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");

  function pick(f: File | null) {
    setError("");
    setAnswer("");
    if (!f) return;
    if (!ALLOWED.includes(f.type)) {
      setError("Please choose a JPEG, PNG, WEBP or HEIC image.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("Image is too large (max 8 MB).");
      return;
    }
    setFile(f);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
  }

  function clear() {
    setFile(null);
    setAnswer("");
    setError("");
    setNote("");
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return "";
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function analyse() {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setAnswer("");
    try {
      const res = await api.photoAssess(file, {
        question: note,
        location,
        language,
      });
      setAnswer(res.assessment);
    } catch {
      setError("Could not analyse the photo just now — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass rounded-2xl p-4 space-y-3 border border-cyan-500/15">
      <div className="flex items-center gap-2">
        <span className="grid place-items-center h-8 w-8 rounded-lg bg-cyan-500/15 border border-cyan-500/25">
          <ScanEye className="h-4 w-4 text-cyan-300" />
        </span>
        <div>
          <h2 className="text-sm font-bold">Photo hazard check</h2>
          <p className="text-[11px] text-slate-400">
            Share a photo of the water or your surroundings for an AI safety
            assessment. Never walk into water to take a photo.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />

      {!preview ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-xl border border-dashed border-white/15 bg-ink-900/50 hover:border-cyan-500/50 py-6 flex flex-col items-center gap-2 transition"
        >
          <div className="flex items-center gap-2 text-cyan-300">
            <Camera className="h-5 w-5" />
            <ImageUp className="h-5 w-5" />
          </div>
          <span className="text-[13px] font-semibold text-slate-200">
            Take or upload a photo
          </span>
          <span className="text-[11px] text-slate-500">
            JPEG / PNG / WEBP · up to 8 MB
          </span>
        </button>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-white/10">
          <img
            src={preview}
            alt="Selected surroundings"
            className="w-full max-h-64 object-cover"
          />
          <button
            onClick={clear}
            title="Remove photo"
            className="absolute top-2 right-2 grid place-items-center h-7 w-7 rounded-lg bg-ink-900/80 border border-white/10 text-slate-300 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {preview && (
        <>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional: what do you want to know? (e.g. is it safe to cross?)"
            className="w-full text-[13px] bg-ink-900/70 border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-cyan-500"
          />
          <button
            onClick={analyse}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600/85 hover:bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ScanEye className="h-4 w-4" />
            )}
            {busy ? "Analysing photo…" : "Assess this photo"}
          </button>
        </>
      )}

      {error && (
        <p className="text-[12px] text-amber-300 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {answer && (
        <div className="rounded-xl bg-ink-900/70 border border-white/5 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="inline-flex items-center gap-1 text-[10px] text-cyan-300/80">
              <ScanEye className="h-3 w-3" /> AI assessment
            </span>
            <SpeakButton id="photocheck" text={answer} lang={language} />
          </div>
          <AssistantMarkdown text={answer} />
          <p className="mt-2 text-[11px] text-slate-600 leading-relaxed">
            AI reads only what is visible in the photo and cannot measure exact
            depth or see outside the frame. In danger, call 112 immediately.
          </p>
        </div>
      )}
    </section>
  );
}
