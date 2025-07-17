import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchCoach } from "./api";
import Dashboard from "./Dashboard";

const paceExpr = [
  "case",
  ["<", ["get", "pace"], 4], "#d73027", 
  ["<", ["get", "pace"], 5], "#fc8d59",  
  ["<", ["get", "pace"], 6], "#fee08b", 
  "#91cf60",                             
];

const lerp = (a, b, t) => ({
  lat: a.lat + (b.lat - a.lat) * t,
  lng: a.lng + (b.lng - a.lng) * t,
});

export default function RacePlayer({ line, dur, distCum, pace, segments = [], onReset }) {
  const [idx, setIdx] = useState(0);
  const [pos, setPos] = useState({ lat: line[0][0], lng: line[0][1] });
  const [msg, setMsg] = useState("");
  const timer = useRef();

  const cumTimes = useMemo(
    () => dur.reduce((a, d) => [...a, a.at(-1) + d], [0]).slice(1),
    [dur]
  );

  useEffect(() => {
    const t0 = performance.now();
    timer.current = setInterval(() => {
      const el = performance.now() - t0;
      const i  = cumTimes.findIndex((t) => el < t);
      if (i === -1) return clearInterval(timer.current);  

      const tPrev = i === 0 ? 0 : cumTimes[i - 1];
      const r = (el - tPrev) / (cumTimes[i] - tPrev);
      setIdx(i);

      const curr = line[i];
      const next = line[i + 1] ?? curr;   
      setPos(lerp(
        { lat: curr[0], lng: curr[1] },
        { lat: next[0], lng: next[1] },
        r,
      ));
    }, 200);
    return () => clearInterval(timer.current);
  }, [cumTimes, line]);

  const done_km   = distCum[idx] / 1000;
  const remain_km = (distCum.at(-1) - distCum[idx]) / 1000;
  const pace_now  = pace;  
  const pace_avg  = pace;

  const geoSegs = useMemo(() => ({
    type: "FeatureCollection",
    features: segments.map((s) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [s.start.lng, s.start.lat],
          [s.end.lng  , s.end.lat  ],
        ],
      },
      properties: { pace: s.pace },
    })),
  }), [segments]);

  async function handleAsk() {
    try {
      const data = await fetchCoach({ done_km, remain_km, pace_now });
      setMsg(data.message);
    } catch (err) {
      setMsg("⚠️ " + err.message);
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw" }}>
      {/* === MAP === */}
      <Map
        initialViewState={{ latitude: pos.lat, longitude: pos.lng, zoom: 14 }}
        mapStyle="https://tiles.stadiamaps.com/styles/alidade_smooth.json"
        mapLib={import("maplibre-gl")}
        style={{ flex: 1, minWidth: 0, minHeight: 0 }}
      >
        {/* ligne complète (bleu clair) */}
        <Source
          id="route"
          type="geojson"
          data={{
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: line.map(([la, ln]) => [ln, la]),
            },
          }}
        >
          <Layer id="route-line" type="line" paint={{ "line-color": "#5fa5ff", "line-width": 2 }} />
        </Source>

        {}
        {segments.length > 0 && (
          <Source id="segs" type="geojson" data={geoSegs}>
            <Layer id="segs-line" type="line" paint={{ "line-color": paceExpr, "line-width": 4 }} />
          </Source>
        )}

        {}
        {segments.map((s, i) => {
          const midLat = (s.start.lat + s.end.lat) / 2;
          const midLng = (s.start.lng + s.end.lng) / 2;
          const col =
              s.pace < 4 ? "#d73027"
            : s.pace < 5 ? "#fc8d59"
            : s.pace < 6 ? "#fee08b"
            : "#91cf60";
          return (
            <Marker key={i} latitude={midLat} longitude={midLng} anchor="bottom">
              <div
                style={{
                  background: col,
                  padding: "2px 4px",
                  fontSize: 12,
                  borderRadius: 4,
                  transform: "translateY(-4px)",
                  color: "#000",
                  whiteSpace: "nowrap",
                }}
              >
                {s.pace.toFixed(1)}′
              </div>
            </Marker>
          );
        })}

        {}
        <Marker latitude={pos.lat} longitude={pos.lng} />
      </Map>

      {}
      <Dashboard
        done_km={done_km}
        remain_km={remain_km}
        pace_now={pace_now}
        pace_avg={pace_avg}
      />

      {}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 300,  
          bottom: 0,
          padding: 16,
          background: "#f5f5f5",
          display: "flex",
          gap: 24,
          alignItems: "center",
        }}
      >
        <button onClick={onReset}>Reset</button>
        <button onClick={handleAsk}>Ask Coach</button>
        <div>
          <strong>Done:</strong> {done_km.toFixed(2)} km&nbsp;|&nbsp;
          <strong>To&nbsp;go:</strong> {remain_km.toFixed(2)} km&nbsp;|&nbsp;
          <strong>Pace&nbsp;(avg):</strong> {pace.toFixed(2)}&nbsp;min/km
        </div>
      </div>

      {/* réponse LLM */}
      {msg && (
        <div
          style={{
            position: "absolute",
            right: 300,
            bottom: 60,
            maxWidth: 400,
            padding: 12,
            background: "#1a1a1a",
            color: "#f5f5f5",
            fontStyle: "italic",
            borderRadius: 4,
          }}
        >
          {msg}
        </div>
      )}
    </div>
  );
}