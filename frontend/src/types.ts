export interface Pilot {
  id: string;
  name: string;
  tributary: string;
  bbox: [number, number, number, number];
  center: [number, number];
}

export type RiskLevel = "low" | "medium" | "high" | "severe";

export interface Rainfall {
  dates: string[];
  daily_mm: number[];
  antecedent_3d_mm: number;
  forecast_3d_mm: number;
  forecast_7d_mm: number;
}

export interface Risk {
  aoi: string;
  probability: number;
  level: RiskLevel;
  susceptibility: number;
  rainfall: Rainfall;
  model: string;
}

export interface Scenario {
  return_period: number;
  depth_m: number;
  damage_factor: number;
  est_damage_inr: number;
  est_damage_crore: number;
  life_risk_index: number;
}

export interface Damage {
  aoi: string;
  buildings_exposed: number;
  building_area_m2: number;
  population_exposed: number;
  cost_per_m2_inr: number;
  scenarios: Record<string, Scenario>;
  disclaimer: string;
}

export interface Validation {
  aoi: string;
  event: string;
  event_label: string;
  precision: number;
  recall: number;
  iou: number;
  pixels: { tp: number; fp: number; fn: number };
}

export interface FloodEvent {
  id: string;
  label: string;
  start: string;
  end: string;
}

export type ZonesGeoJSON = GeoJSON.FeatureCollection<
  GeoJSON.Polygon,
  { risk_class: number; mean: number; area_km2: number }
>;
