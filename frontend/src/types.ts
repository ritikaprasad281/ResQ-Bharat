export interface Pilot {
  id: string;
  name: string;
  tributary: string;
  basin?: string;
  region?: string;
  coverage?: Coverage;
  bbox: [number, number, number, number];
  center: [number, number];
}

export type Coverage = "live" | "modelled" | "partial";

export type RiskLevel = "low" | "medium" | "high" | "severe";

/** BCP 47 language tag (e.g. "hi-IN"). See i18n/languages.ts for the registry. */
export type Language = string;

export interface Rainfall {
  dates: string[];
  daily_mm: number[];
  antecedent_3d_mm: number;
  forecast_3d_mm: number;
  forecast_7d_mm: number;
  fetched_at?: string;
  antecedent_complete?: boolean;
  forecast_complete?: boolean;
  days_available?: number;
  days_expected?: number;
}

export interface RiskSource {
  name: string;
  kind: string;
  temporal: string;
  url: string;
}

export interface RiskMethodology {
  formula: string;
  rainfall_pressure: string;
  weights: { susceptibility: number; rainfall_pressure: number };
  normalization: {
    antecedent_saturation_mm: number;
    forecast_saturation_mm: number;
  };
  note: string;
}

export interface Risk {
  aoi: string;
  probability: number;
  level: RiskLevel;
  susceptibility: number;
  rainfall: Rainfall;
  model: string;
  updated_at?: string;
  sources?: RiskSource[];
  methodology?: RiskMethodology;
  data_quality?: {
    rainfall_complete: boolean;
    days_available?: number;
    days_expected?: number;
  };
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

export interface ForecastDay {
  date: string;
  rainfall_mm: number;
  risk: number;
  level: RiskLevel;
}

export interface ForecastHorizon {
  window: string;
  hours: number;
  rainfall_mm: number;
  risk: number;
  level: RiskLevel;
}

export interface Forecast {
  aoi: string;
  name: string;
  susceptibility: number;
  observed_3d_mm?: number;
  issued_at?: string | null;
  horizons?: ForecastHorizon[];
  series: ForecastDay[];
  peak_72h: ForecastDay | null;
  peak_7d: ForecastDay | null;
  trend: "rising" | "falling" | "steady";
  source?: string;
  model: string;
}

export interface Impact {
  districts_monitored: number;
  rivers_monitored: number;
  locations_analysed: number;
  new_buildings_in_corridor: number;
  people_newly_exposed: number;
  new_built_area_ha: number;
  asset_value_crore: number;
  high_risk_now: number;
}

export interface AlertDispatch {
  pilot: string;
  area: string;
  language: string;
  level: RiskLevel;
  probability: number;
  message: string;
  created_at: string;
  dispatch: {
    published: boolean;
    message_id?: string;
    topic?: string;
    channel?: string;
    detail?: string;
  };
}

export type ZonesGeoJSON = GeoJSON.FeatureCollection<
  GeoJSON.Polygon,
  { risk_class: number; mean: number; area_km2: number }
>;

export interface ConstructionProps {
  area_km2: number;
  confidence: number;
  dist_river_m: number;
  in_hazard: boolean;
  priority?: number;
  priority_level?: "high" | "review" | "lower";
  _idx?: number;
}

export type ConstructionGeoJSON = GeoJSON.FeatureCollection<
  GeoJSON.Polygon,
  ConstructionProps
>;

export interface DetectionStage {
  stage: string;
  area_ha: number;
}

export interface DetectionMeta {
  buffer_m: number;
  scale_m: number;
  min_area_m2: number;
  source: string;
  thresholds: Record<string, number>;
}

export interface PriorityMeta {
  weights: Record<string, number>;
  proximity_ref_m: number;
  area_ref_m2: number;
  levels: Record<string, string>;
  note: string;
}

export interface ImagerySide {
  label: string;
  available: boolean;
  url: string | null;
  scenes: number;
  cloud_filtered: boolean;
}

export interface Imagery {
  aoi: string;
  name: string;
  region_bbox: [number, number, number, number];
  source: string;
  method: string;
  baseline: ImagerySide;
  recent: ImagerySide;
}

export interface NewConstruction {
  aoi: string;
  name: string;
  period: { baseline: string; recent: string; years: number };
  new_built_area_m2: number;
  new_built_area_ha: number;
  new_buildings: number;
  population_at_risk: number;
  cost_per_m2_inr: number;
  asset_value_inr: number;
  asset_value_crore: number;
  expected_damage_inr: number;
  expected_damage_crore: number;
  damage_factor: number;
  algorithm_version: string;
  detection: DetectionMeta;
  stages: DetectionStage[];
  candidate_count: number;
  priority?: PriorityMeta;
  geojson: ConstructionGeoJSON;
  disclaimer: string;
}

export interface TopRiskItem {
  id: string;
  name: string;
  tributary: string;
  center: [number, number];
  bbox: [number, number, number, number];
  probability: number;
  level: RiskLevel;
  forecast_7d_mm: number;
  antecedent_3d_mm: number;
}

export interface TopRisk {
  top: TopRiskItem[];
  all: TopRiskItem[];
}

export interface SituationReport {
  language: string;
  generated_at: string | null;
  assessed: number;
  total: number;
  high_or_severe_count: number;
  report: string;
}

export interface PhotoAssessment {
  language: string;
  location: string | null;
  question: string | null;
  assessment: string;
}

export interface AlertItem {
  id: string;
  name: string;
  tributary: string;
  center: [number, number];
  bbox: [number, number, number, number];
  probability: number;
  level: RiskLevel;
  forecast_7d_mm: number;
  antecedent_3d_mm: number;
}

export interface Alerts {
  generated_at: string;
  count: number;
  alerts: AlertItem[];
}

export interface Report {
  id: string;
  pilot?: string | null;
  location: string;
  hazard_type: string;
  severity: string;
  description: string;
  reporter_name: string;
  contact: string;
  lat?: number | null;
  lon?: number | null;
  status: string;
  created_at: string;
}

export interface ReportInput {
  pilot?: string | null;
  location: string;
  hazard_type: string;
  severity: string;
  description: string;
  reporter_name: string;
  contact: string;
  lat?: number | null;
  lon?: number | null;
}

export type SeverityLevel = "low" | "moderate" | "high" | "severe";

export interface AgriSource {
  name: string;
  kind: string;
  temporal: string;
  role: string;
  url: string;
}

export interface AgriCropLoss {
  crop: string;
  label: string;
  season: string;
  share: number;
  damaged_area_ha: number;
  yield_t_ha: number;
  price_inr_t: number;
  loss_inr: number;
}

export interface AgriSeverity {
  level: SeverityLevel;
  basis: string;
  share_of_cropland: number;
  by_share: SeverityLevel;
  by_value: SeverityLevel;
}

/** Full per-location agricultural loss estimate (from /agri-loss). */
export interface AgriLoss {
  aoi: string;
  name: string;
  region: string;
  basin: string;
  tributary: string;
  center: [number, number];
  bbox: [number, number, number, number];
  coverage: Coverage;
  data_confidence: string;
  cropland_ha: number;
  exposed_cropland_ha: number;
  damaged_cropland_ha: number;
  damaged_area_range_ha: { low: number; high: number };
  damage_fraction: number;
  damage_fraction_range: { low: number; high: number };
  estimated_loss_inr: number;
  estimated_loss_crore: number;
  estimated_loss_range_inr: { low: number; high: number };
  loss_per_hectare_inr: number;
  crops: AgriCropLoss[];
  crop_types: number;
  primary_crop: string | null;
  severity: AgriSeverity;
  sources: AgriSource[];
  methodology: Record<string, string>;
  updated_at?: string;
  disclaimer: string;
}

/** Compact per-location row in the portfolio summary (from /agri-loss-summary). */
export interface AgriLossRow {
  aoi: string;
  name: string;
  region: string;
  basin: string;
  tributary: string;
  center: [number, number];
  bbox: [number, number, number, number];
  coverage: Coverage;
  data_confidence: string;
  cropland_ha: number;
  exposed_cropland_ha: number;
  damaged_cropland_ha: number;
  estimated_loss_inr: number;
  estimated_loss_crore: number;
  loss_per_hectare_inr: number;
  primary_crop: string | null;
  crop_types: number;
  severity: SeverityLevel | null;
  severity_basis: string | null;
  updated_at?: string;
}

export interface AgriLossSummary {
  locations_total: number;
  locations_analysed: number;
  locations_pending: number;
  total_cropland_ha: number;
  total_exposed_cropland_ha: number;
  total_damaged_cropland_ha: number;
  total_estimated_loss_inr: number;
  total_estimated_loss_crore: number;
  rivers_affected: number;
  crop_types_affected: number;
  severity_counts: Record<SeverityLevel, number>;
  locations: AgriLossRow[];
  sources: AgriSource[];
  disclaimer: string;
}
