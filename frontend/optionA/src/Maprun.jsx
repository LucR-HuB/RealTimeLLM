import { useEffect, useState, useRef, useCallback } from "react";
import Map, { Marker, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchStatus } from "./api";

export default function MapRunGl() {
  const [route, setRoute] = useState([]);
  const [idx, setIdx] = useState(0);
  const [msg, setMsg] = useState("Click Ask Coach");
  const mapRef = useRef();

  // → charger l'itinéraire depuis le backend
  useEffect(() => {
    fetch("http://localhost:8000/route")
      .then((r) => r.json())
      .then(setRoute);
  }, []);

  // → simulation d'avancement
  useEffect(() => {
    if (!route.length) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % route.length), 2000);
    return () => clearInterval(id);
  }, [route]);

  // → bouton Ask Coach
  const handleAsk = useCallback(async () => {
    try {
      const data = await fetchStatus(idx);
      setMsg(`[${data.km} km] ${data.message}`);
    } catch (e) {
      setMsg("⚠️ " + e.message);
    }
  }, [idx]);

  if (!route.length) return <p>Loading route…</p>;

  const current = route[idx];
  const geojson = {
    type: "Feature",
    geometry: { type: "LineString", coordinates: route.map(([lat, lng]) => [lng, lat]) },
  };

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column" }}>
      <Map
        initialViewState={{ longitude: current[1], latitude: current[0], zoom: 14 }}
        ref={mapRef}
        mapLib={import("maplibre-gl")}
        style={{ height: "85vh", width: "100%" }}
        mapStyle="https://tiles.stadiamaps.com/styles/osm_bright.json"
      >
        <Source id="line" type="geojson" data={geojson}>
          <Layer
            id="line-layer"
            type="line"
            paint={{ "line-color": "#2563eb", "line-width": 4 }}
          />
        </Source>

        <Marker latitude={current[0]} longitude={current[1]} />
      </Map>

      <div style={{ padding: "1rem", display: "flex", gap: "1rem" }}>
        <button onClick={handleAsk} style={{ background: "#2563eb", color: "#fff", padding: "0.6rem 1.2rem", borderRadius: 6 }}>
          Ask Coach
        </button>
        <span>{msg}</span>
      </div>
    </div>
  );
}