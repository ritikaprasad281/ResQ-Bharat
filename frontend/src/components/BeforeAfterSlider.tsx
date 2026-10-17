import { useRef, useState, useCallback } from "react";
import { MoveHorizontal } from "lucide-react";

export interface OverlayShape {
  idx: number;
  points: string; // SVG points in a 0–1000 viewBox
  fill: string;
  stroke: string;
}

interface Props {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel: string;
  afterLabel: string;
  shapes?: OverlayShape[];
  selectedIdx?: number | null;
  onSelect?: (idx: number) => void;
}

/**
 * Synchronized before/after image comparison. The two images are the SAME
 * ground footprint (same AOI bounds), so dragging the handle reveals change
 * between the two observation windows without any warping.
 */
export default function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeLabel,
  afterLabel,
  shapes,
  selectedIdx,
  onSelect,
}: Props) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const update = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  }, []);

  const onMove = useCallback(
    (e: MouseEvent) => {
      if (dragging.current) update(e.clientX);
    },
    [update]
  );

  const stop = useCallback(() => {
    dragging.current = false;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", stop);
  }, [onMove]);

  const start = useCallback(() => {
    dragging.current = true;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stop);
  }, [onMove, stop]);

  return (
    <div
      ref={ref}
      className="relative w-full aspect-[3/2] overflow-hidden rounded-xl select-none bg-ink-900 cursor-ew-resize"
      onTouchMove={(e) => update(e.touches[0].clientX)}
      onClick={(e) => update(e.clientX)}
    >
      {/* AFTER (recent) — full width underneath */}
      <img
        src={afterUrl}
        alt={afterLabel}
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <span className="absolute top-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-cyan-200">
        {afterLabel}
      </span>

      {/* BEFORE (baseline) — clipped from the left */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${pos}%` }}
      >
        <img
          src={beforeUrl}
          alt={beforeLabel}
          draggable={false}
          style={{ width: ref.current?.clientWidth ?? "100%" }}
          className="absolute inset-0 h-full max-w-none object-cover"
        />
        <span className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-slate-200">
          {beforeLabel}
        </span>
      </div>

      {/* Detection overlay — clipped to the AFTER (recent) side so markers are
          revealed only over the 2026 imagery as you slide. */}
      {shapes && shapes.length > 0 && (
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: "none", clipPath: `inset(0 0 0 ${pos}%)` }}
        >
          {shapes.map((s) => (
            <polygon
              key={s.idx}
              points={s.points}
              fill={s.fill}
              fillOpacity={s.idx === selectedIdx ? 0.5 : 0.3}
              stroke={s.idx === selectedIdx ? "#ffffff" : s.stroke}
              strokeWidth={s.idx === selectedIdx ? 4 : 1.5}
              style={{ pointerEvents: onSelect ? "auto" : "none", cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(s.idx);
              }}
            />
          ))}
        </svg>
      )}

      {/* Handle */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white/90 shadow-[0_0_8px_rgba(0,0,0,0.6)]"
        style={{ left: `${pos}%` }}
      >
        <button
          type="button"
          onMouseDown={(e) => {
            e.stopPropagation();
            start();
          }}
          onTouchStart={(e) => e.stopPropagation()}
          aria-label="Drag to compare before and after imagery"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 grid place-items-center h-9 w-9 rounded-full bg-white text-ink-900 shadow-lg cursor-ew-resize"
        >
          <MoveHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
