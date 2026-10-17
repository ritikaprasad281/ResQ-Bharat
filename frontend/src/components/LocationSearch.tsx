import { useMemo, useRef, useState, useEffect } from "react";
import { Search, MapPin, ChevronDown } from "lucide-react";
import type { Pilot } from "../types";
import { coverageOf } from "../lib";

interface Props {
  pilots: Pilot[];
  value?: string;
  onSelect: (id: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function LocationSearch({
  pilots,
  value,
  onSelect,
  placeholder = "Search city, river or state (e.g. Chennai, Godavari, Kerala)…",
  autoFocus,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = pilots.find((p) => p.id === value);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? pilots.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.tributary.toLowerCase().includes(q) ||
            (p.region ?? "").toLowerCase().includes(q) ||
            (p.basin ?? "").toLowerCase().includes(q) ||
            p.id.toLowerCase().includes(q)
        )
      : pilots;
    const by: Record<string, Pilot[]> = {};
    for (const p of filtered) (by[p.region ?? "India"] ??= []).push(p);
    return Object.entries(by)
      .map(([region, items]) => {
        items.sort((a, b) => a.tributary.localeCompare(b.tributary));
        return [region, items] as [string, Pilot[]];
      })
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [pilots, query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function choose(id: string) {
    onSelect(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-xl bg-ink-800/70 border border-white/10 px-3 py-2.5 focus-within:border-sky-500/60">
        <Search className="h-4 w-4 text-slate-400 shrink-0" />
        <input
          autoFocus={autoFocus}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder={
            selected && !open ? selected.name : placeholder
          }
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
        />
        <ChevronDown
          className={`h-4 w-4 text-slate-500 transition ${open ? "rotate-180" : ""}`}
          onClick={() => setOpen((v) => !v)}
        />
      </div>

      {open && (
        <div className="absolute z-40 mt-1.5 w-full max-h-72 overflow-y-auto rounded-xl bg-ink-900/95 backdrop-blur border border-white/10 shadow-2xl p-1.5">
          {groups.length === 0 && (
            <p className="px-3 py-3 text-sm text-slate-500">No match.</p>
          )}
          {groups.map(([river, items]) => (
            <div key={river} className="mb-1">
              <p className="px-2 pt-1.5 pb-1 text-[10px] uppercase tracking-wider text-slate-500">
                {river}
              </p>
              {items.map((p) => {
                const active = p.id === value;
                const cov = coverageOf(p.coverage);
                return (
                  <button
                    key={p.id}
                    onClick={() => choose(p.id)}
                    className={`w-full text-left flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                      active
                        ? "bg-ink-600 text-white"
                        : "text-slate-300 hover:bg-ink-700/70"
                    }`}
                  >
                    <MapPin className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                    <span className="truncate flex-1">{p.name}</span>
                    <span
                      title={cov.label}
                      className="inline-flex items-center gap-1 shrink-0 text-[10px] text-slate-400"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: cov.dot }}
                      />
                      {cov.short}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
