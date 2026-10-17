/**
 * LanguagePicker — a shared, searchable language dropdown used both for the
 * global website language (header) and the per-chat response language. Shows
 * each language in its own native script and surfaces honest, runtime-detected
 * capability badges (voice input / spoken answers) so users are never promised
 * a capability the device can't deliver. Keyboard and screen-reader accessible.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Globe, Mic, Search, Volume2 } from "lucide-react";
import { LANGUAGES, getLanguage } from "../i18n/languages";
import {
  pickVoice,
  speechRecognitionSupported,
} from "../i18n/capabilities";

export interface SpecialOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  voices?: SpeechSynthesisVoice[];
  /** Sentinel options shown above the language list (e.g. "Follow website"). */
  specials?: SpecialOption[];
  /** Short label for the trigger button; falls back to the Globe icon only. */
  triggerLabel?: string;
  align?: "left" | "right";
  /** Show mic/speaker capability badges per language (chat picker). */
  showCapabilities?: boolean;
  size?: "sm" | "md";
}

export default function LanguagePicker({
  value,
  onChange,
  voices = [],
  specials = [],
  triggerLabel,
  align = "right",
  showCapabilities = false,
  size = "sm",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const sttSupported = speechRecognitionSupported();

  const special = specials.find((s) => s.value === value);
  const current = special ? null : getLanguage(value);
  const triggerText =
    special?.label ?? current?.nativeName ?? triggerLabel ?? "Language";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) =>
        l.englishName.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    setTimeout(() => searchRef.current?.focus(), 30);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const pad = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm";

  function choose(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-lg bg-ink-900/70 border border-white/10 ${pad} font-medium text-slate-200 hover:text-white hover:border-white/20 transition`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select language"
      >
        <Globe className="h-3.5 w-3.5 shrink-0 opacity-80" />
        <span className="max-w-[9rem] truncate">{triggerText}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 opacity-70 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-1 w-64 rounded-xl border border-white/10 bg-ink-900/95 backdrop-blur shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
          role="listbox"
        >
          <div className="p-2 border-b border-white/5">
            <div className="flex items-center gap-2 rounded-lg bg-ink-800/80 px-2">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search language…"
                className="w-full bg-transparent py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
                aria-label="Search language"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {specials.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => choose(s.value)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition hover:bg-white/5 ${
                  value === s.value ? "text-white" : "text-slate-300"
                }`}
                role="option"
                aria-selected={value === s.value}
              >
                <span>{s.label}</span>
                {value === s.value && <Check className="h-3.5 w-3.5 text-emerald-400" />}
              </button>
            ))}
            {specials.length > 0 && (
              <div className="my-1 border-t border-white/5" />
            )}

            {filtered.map((l) => {
              const selected = !special && current?.code === l.code;
              const hasTts = pickVoice(l.code, voices) !== null;
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => choose(l.code)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-white/5 ${
                    selected ? "bg-white/5" : ""
                  }`}
                  role="option"
                  aria-selected={selected}
                  lang={l.code}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-slate-100">
                      {l.nativeName}
                    </span>
                    <span className="block truncate text-[10px] text-slate-500">
                      {l.englishName}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {showCapabilities && (
                      <>
                        <Mic
                          className={`h-3 w-3 ${
                            sttSupported ? "text-sky-400" : "text-slate-600"
                          }`}
                          aria-label={
                            sttSupported ? "Voice input available" : "Voice input unavailable"
                          }
                        />
                        <Volume2
                          className={`h-3 w-3 ${
                            hasTts ? "text-emerald-400" : "text-slate-600"
                          }`}
                          aria-label={
                            hasTts ? "Spoken answers available" : "Spoken answers unavailable"
                          }
                        />
                      </>
                    )}
                    {selected && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                  </span>
                </button>
              );
            })}

            {filtered.length === 0 && (
              <div className="px-3 py-3 text-center text-xs text-slate-500">
                No match
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
