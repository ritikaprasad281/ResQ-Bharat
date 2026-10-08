import type {
  Damage,
  FloodEvent,
  Pilot,
  Risk,
  Validation,
  ZonesGeoJSON,
} from "./types";

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  pilots: () => get<{ pilots: Pilot[] }>("/pilots").then((r) => r.pilots),
  zones: (pilot: string) => get<ZonesGeoJSON>(`/zones?pilot=${pilot}`),
  risk: (pilot: string) => get<Risk>(`/risk?pilot=${pilot}`),
  damage: (pilot: string) => get<Damage>(`/damage?pilot=${pilot}`),
  events: () => get<{ events: FloodEvent[] }>("/events").then((r) => r.events),
  validate: (pilot: string, event: string) =>
    get<Validation>(`/validate?pilot=${pilot}&event=${event}`),
  briefing: (pilot: string) =>
    post<{ briefing: string }>("/ai/briefing", { pilot }).then((r) => r.briefing),
  chat: (pilot: string, question: string) =>
    post<{ answer: string }>("/ai/chat", { pilot, question }).then(
      (r) => r.answer
    ),
};
