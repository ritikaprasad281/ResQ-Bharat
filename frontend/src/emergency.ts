/**
 * Verified official Indian emergency contacts and shared flood-safety content.
 * Numbers here are well-known, publicly published national helplines. They are
 * NOT model-generated. Always a reminder to confirm the correct local number.
 */

export interface EmergencyContact {
  number: string;
  label: string;
  note: string;
  primary?: boolean;
}

export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    number: "112",
    label: "National Emergency (all-in-one)",
    note: "India's pan-India emergency response number — police, fire, ambulance.",
    primary: true,
  },
  { number: "108", label: "Ambulance / Emergency response", note: "Medical & disaster emergency response service." },
  { number: "101", label: "Fire & Rescue", note: "Fire brigade and rescue services." },
  { number: "100", label: "Police", note: "State police control room." },
  { number: "1070", label: "State Disaster Control", note: "State Relief Commissioner / disaster control room." },
  { number: "1077", label: "District Disaster Control", note: "District emergency operations centre (prefix the STD code)." },
  { number: "1091", label: "Women Helpline", note: "Support for women in distress." },
  { number: "1098", label: "Childline", note: "Help for children in distress." },
];

/** Authoritative Indian flood / weather information sources (official domains). */
export const OFFICIAL_SOURCES: { label: string; detail: string; url: string }[] = [
  {
    label: "CWC Flood Forecast",
    detail: "Central Water Commission — live river levels & flood forecasts.",
    url: "https://ffs.india-water.gov.in/",
  },
  {
    label: "IMD Weather Warnings",
    detail: "India Meteorological Department — rainfall & cyclone warnings.",
    url: "https://mausam.imd.gov.in/",
  },
  {
    label: "NDMA",
    detail: "National Disaster Management Authority — official guidance.",
    url: "https://ndma.gov.in/",
  },
];

/**
 * Build a real maps-provider search URL for a category near a location.
 * Hands off to an actual mapping service — it does not fabricate results.
 */
export function mapsSearchUrl(query: string, location?: Coords | string): string {
  const parts = [query];
  if (typeof location === "string" && location.trim()) parts.push(location.trim());
  const q = encodeURIComponent(parts.join(" near "));
  if (location && typeof location !== "string") {
    return `https://www.google.com/maps/search/${q}/@${location.lat},${location.lon},13z`;
  }
  return `https://www.google.com/maps/search/${q}`;
}

export interface Coords {
  lat: number;
  lon: number;
}
