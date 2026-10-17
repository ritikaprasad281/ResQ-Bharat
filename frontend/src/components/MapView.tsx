import { useEffect, useRef } from "react";
import Map, {
  AttributionControl,
  Layer,
  Marker,
  Source,
  type MapRef,
} from "react-map-gl/maplibre";
import type { StyleSpecification } from "maplibre-gl";
import type { ConstructionGeoJSON, Pilot, ZonesGeoJSON } from "../types";

// Real satellite imagery (Esri World Imagery) as a raster basemap — free, no
// API key. A semi-transparent labels layer adds place names on top.
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
    labels: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
    },
  },
  layers: [
    { id: "satellite", type: "raster", source: "satellite" },
    { id: "labels", type: "raster", source: "labels" },
  ],
};

interface Props {
  pilot: Pilot;
  zones?: ZonesGeoJSON;
  construction?: ConstructionGeoJSON;
  showStation?: boolean;
  selectedIdx?: number | null;
  onSelectFeature?: (idx: number) => void;
  focus?: [number, number, number, number] | null;
  zonesVisible?: boolean;
  labelsVisible?: boolean;
  resizeSignal?: number;
}

export default function MapView({
  pilot,
  zones,
  construction,
  showStation,
  selectedIdx,
  onSelectFeature,
  focus,
  zonesVisible = true,
  labelsVisible = true,
  resizeSignal,
}: Props) {
  const ref = useRef<MapRef>(null);

  useEffect(() => {
    const map = ref.current;
    if (!map) return;
    // ~10 km wide box, keeping the original AOI 45:30 (3:2) aspect ratio.
    const [lon, lat] = pilot.center;
    const halfWidthKm = 5;
    const halfHeightKm = halfWidthKm * (30 / 45);
    const dLat = halfHeightKm / 111.0;
    const dLon = halfWidthKm / (111.32 * Math.cos((lat * Math.PI) / 180));
    map.fitBounds(
      [
        [lon - dLon, lat - dLat],
        [lon + dLon, lat + dLat],
      ],
      { padding: 20, duration: 1200 }
    );
  }, [pilot]);

  // External zoom-to target (selected feature, fit-all, or reset-to-region).
  useEffect(() => {
    const map = ref.current;
    if (!map || !focus) return;
    const [w, s, e, n] = focus;
    map.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      { padding: 48, duration: 800, maxZoom: 16 }
    );
  }, [focus]);

  // Recalculate the map size when the surrounding layout changes (layout
  // modes, sidebar collapse, copilot expansion). Delay past the CSS transition.
  useEffect(() => {
    if (resizeSignal === undefined) return;
    const map = ref.current;
    if (!map) return;
    const t = setTimeout(() => map.resize(), 260);
    return () => clearTimeout(t);
  }, [resizeSignal]);

  // Toggle the base place-labels raster layer without re-creating the style.
  useEffect(() => {
    const map = ref.current?.getMap();
    if (!map) return;
    const apply = () => {
      if (map.getLayer("labels"))
        map.setLayoutProperty(
          "labels",
          "visibility",
          labelsVisible ? "visible" : "none"
        );
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [labelsVisible]);

  return (
    <Map
      ref={ref}
      initialViewState={{
        longitude: pilot.center[0],
        latitude: pilot.center[1],
        zoom: 11,
      }}
      mapStyle={STYLE}
      attributionControl={false}
      interactiveLayerIds={construction ? ["construction-fill"] : []}
      onLoad={(e) => {
        // MapLibre's compact attribution renders open by default; collapse it
        // so it shows only the (i) until the user clicks it.
        const el = e.target
          .getContainer()
          .querySelector(".maplibregl-ctrl-attrib");
        el?.removeAttribute("open");
        el?.classList.remove("maplibregl-compact-show");
      }}
      onClick={(e) => {
        const f = e.features?.[0];
        if (f && onSelectFeature && typeof f.properties?._idx === "number") {
          onSelectFeature(f.properties._idx as number);
        }
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <AttributionControl compact />
      {zones && (
        <Source id="zones" type="geojson" data={zones}>
          <Layer
            id="zones-fill"
            type="fill"
            layout={{ visibility: zonesVisible ? "visible" : "none" }}
            paint={{
              "fill-color": [
                "match",
                ["get", "risk_class"],
                1,
                "#3b82f6",
                2,
                "#eab308",
                3,
                "#f97316",
                4,
                "#ef4444",
                "#3b82f6",
              ],
              "fill-opacity": 0.5,
            }}
          />
          <Layer
            id="zones-line"
            type="line"
            layout={{ visibility: zonesVisible ? "visible" : "none" }}
            paint={{
              "line-color": [
                "match",
                ["get", "risk_class"],
                4,
                "#ef4444",
                3,
                "#f97316",
                "#60a5fa",
              ],
              "line-width": 0.6,
              "line-opacity": 0.7,
            }}
          />
        </Source>
      )}
      {construction && (
        <Source id="construction" type="geojson" data={construction}>
          <Layer
            id="construction-fill"
            type="fill"
            paint={{
              "fill-color": [
                "match",
                ["get", "confidence"],
                3,
                "#ec4899",
                2,
                "#f59e0b",
                1,
                "#94a3b8",
                "#ec4899",
              ],
              "fill-opacity": 0.55,
            }}
          />
          <Layer
            id="construction-line"
            type="line"
            paint={{
              "line-color": [
                "match",
                ["get", "confidence"],
                3,
                "#fbcfe8",
                2,
                "#fde68a",
                1,
                "#e2e8f0",
                "#fbcfe8",
              ],
              "line-width": 1.2,
              "line-opacity": 0.9,
            }}
          />
          <Layer
            id="construction-selected"
            type="line"
            filter={["==", ["get", "_idx"], selectedIdx ?? -1]}
            paint={{
              "line-color": "#ffffff",
              "line-width": 3,
              "line-opacity": 1,
            }}
          />
        </Source>
      )}
      {showStation && (
        <Marker longitude={pilot.center[0]} latitude={pilot.center[1]} anchor="bottom">
          <div className="flex flex-col items-center" title={`${pilot.name} monitoring point`}>
            <span className="text-[10px] font-semibold text-white bg-ink-900/80 px-1.5 py-0.5 rounded mb-0.5 whitespace-nowrap">
              {pilot.name}
            </span>
            <span className="relative flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60 animate-ping" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-cyan-400 border-2 border-ink-900" />
            </span>
          </div>
        </Marker>
      )}
    </Map>
  );
}
