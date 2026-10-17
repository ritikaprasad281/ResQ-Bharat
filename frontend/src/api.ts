import type {
  AgriLoss,
  AgriLossSummary,
  AlertDispatch,
  Alerts,
  Damage,
  FloodEvent,
  Forecast,
  Impact,
  Language,
  NewConstruction,
  Imagery,
  Pilot,
  PhotoAssessment,
  Report,
  ReportInput,
  Risk,
  SituationReport,
  TopRisk,
  Validation,
  ZonesGeoJSON,
} from "./types";

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080";

// Default per-request timeout. Backend endpoints are cached/stale-while-
// revalidate, so a slow response usually means a cold path; we fail fast enough
// to keep the UI responsive while still allowing for the slowest warm call.
const DEFAULT_TIMEOUT_MS = 30_000;

/** In-flight GET de-duplication: if the same URL is already being fetched, the
 * second caller shares the first promise instead of issuing a duplicate
 * request. This stops panels that need the same data from doubling backend
 * load (e.g. several components asking for the ranking at once). */
const inflight = new Map<string, Promise<unknown>>();

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function get<T>(path: string): Promise<T> {
  const url = `${BASE}/api${path}`;
  const existing = inflight.get(url);
  if (existing) return existing as Promise<T>;
  const promise = fetchJson<T>(url).finally(() => inflight.delete(url));
  inflight.set(url, promise);
  return promise;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  return fetchJson<T>(`${BASE}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const api = {
  pilots: () => get<{ pilots: Pilot[] }>("/pilots").then((r) => r.pilots),
  zones: (pilot: string) => get<ZonesGeoJSON>(`/zones?pilot=${pilot}`),
  risk: (pilot: string) => get<Risk>(`/risk?pilot=${pilot}`),
  forecast: (pilot: string) => get<Forecast>(`/forecast?pilot=${pilot}`),
  impact: () => get<Impact>("/impact"),
  topRisk: (limit = 3) => get<TopRisk>(`/top-risk?limit=${limit}`),
  alerts: () => get<Alerts>("/alerts"),
  damage: (pilot: string) => get<Damage>(`/damage?pilot=${pilot}`),
  newConstruction: (pilot: string) =>
    get<NewConstruction>(`/new-construction?pilot=${pilot}`),
  agriLoss: (pilot: string) => get<AgriLoss>(`/agri-loss?pilot=${pilot}`),
  agriLossSummary: () => get<AgriLossSummary>("/agri-loss-summary"),
  imagery: (pilot: string) => get<Imagery>(`/imagery?pilot=${pilot}`),
  events: () => get<{ events: FloodEvent[] }>("/events").then((r) => r.events),
  validate: (pilot: string, event: string) =>
    get<Validation>(`/validate?pilot=${pilot}&event=${event}`),
  reports: (limit = 50) =>
    get<{ reports: Report[] }>(`/reports?limit=${limit}`).then((r) => r.reports),
  submitReport: (body: ReportInput) => post<Report>("/reports", body),
  briefing: (pilot: string, language: Language = "en-IN") =>
    post<{ briefing: string }>("/ai/briefing", { pilot, language }).then(
      (r) => r.briefing
    ),
  chat: (
    pilot: string,
    question: string,
    language: Language = "en-IN",
    meta?: ChatMeta
  ) =>
    post<{ answer: string }>("/ai/chat", {
      pilot,
      question,
      language,
      response_language: language,
      ...meta,
    }).then((r) => r.answer),
  alert: (pilot: string, language: Language = "en-IN") =>
    post<AlertDispatch>("/ai/alert", { pilot, language }),
  assist: (
    question: string,
    language: Language = "en-IN",
    location?: string,
    meta?: ChatMeta
  ) =>
    post<{ answer: string }>("/ai/assist", {
      question,
      language,
      response_language: language,
      location: location ?? null,
      ...meta,
    }).then((r) => r.answer),
  situation: (limit = 8, language: Language = "en-IN") =>
    fetchJson<SituationReport>(
      `${BASE}/api/ai/situation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit, language, response_language: language }),
      },
      60_000
    ),
  photoAssess: (
    file: File,
    opts: { question?: string; location?: string; language?: Language } = {}
  ) => {
    const lang = opts.language ?? "en-IN";
    const fd = new FormData();
    fd.append("file", file);
    if (opts.question?.trim()) fd.append("question", opts.question.trim());
    if (opts.location?.trim()) fd.append("location", opts.location.trim());
    fd.append("language", lang);
    fd.append("response_language", lang);
    return fetchJson<PhotoAssessment>(
      `${BASE}/api/ai/photo`,
      { method: "POST", body: fd },
      60_000
    );
  },
};

/** Optional language/voice context passed alongside a chat or assist request. */
export interface ChatMeta {
  detected_language?: string | null;
  ui_language?: string;
  input_mode?: "text" | "voice";
  transcription_confidence?: number | null;
}
