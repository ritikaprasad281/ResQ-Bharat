import { useEffect, useRef } from "react";
import Map, {
  Layer,
  Source,
  type MapRef,
} from "react-map-gl/maplibre";
import type { Pilot, ZonesGeoJSON } from "../types";

const STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

interface Props {
  pilot: Pilot;
  zones?: ZonesGeoJSON;
}

export default function MapView({ pilot, zones }: Props) {
  const ref = useRef<MapRef>(null);

  useEffect(() => {
    const map = ref.current;
    if (!map) return;
    const [w, s, e, n] = pilot.bbox;
    map.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      { padding: 60, duration: 1200 }
    );
  }, [pilot]);

  return (
    <Map
      ref={ref}
      initialViewState={{
        longitude: pilot.center[0],
        latitude: pilot.center[1],
        zoom: 9,
      }}
      mapStyle={STYLE}
      attributionControl={false}
      style={{ width: "100%", height: "100%" }}
    >
      {zones && (
        <Source id="zones" type="geojson" data={zones}>
          <Layer
            id="zones-fill"
            type="fill"
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
    </Map>
  );
}
