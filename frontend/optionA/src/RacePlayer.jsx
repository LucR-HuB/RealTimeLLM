import { useEffect, useRef, useState } from "react";
import Map, { Marker, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchCoach } from "./api";

export default function RacePlayer({ line, dur, distCum, pace, onReset }) {
  const [idx, setIdx] = useState(0);
  const [msg, setMsg] = useState("");
  const timerRef = useRef(null);

  useEffect(() => {
    function step(i) {
      setIdx(i);
      const delay = dur[i] ?? dur.at(-1) ?? 1000;
      timerRef.current = setTimeout(() => step((i + 1) % line.length), delay);
    }
    step(0);
    return () => clearTimeout(timerRef.current);
  }, [dur, line.length]);

  /* Stats en temps réel */
  const done_km   = distCum[idx] / 1000;
  const remain_km = (distCum.at(-1) - distCum[idx]) / 1000;
  const paceTxt   = pace.toFixed(2);

  /* Ask Coach : envoie les vraies stats */
  async function handleAsk() {
    try {
      const data = await fetchCoach({
        done_km  : parseFloat(done_km.toFixed(2)),
        remain_km: parseFloat(remain_km.toFixed(2)),
        pace_now : pace,
      });
      setMsg(data.message);
    } catch (err) {
      setMsg("⚠️ " + err.message);
    }
  }

  const [lat, lng] = line[idx];
  return (
    <div style={{ height:"100vh", width:"100vw", display:"flex", flexDirection:"column" }}>
      <Map
        initialViewState={{ latitude:lat, longitude:lng, zoom:14 }}
        mapStyle="https://tiles.stadiamaps.com/styles/alidade_smooth.json"
        mapLib={import("maplibre-gl")}
        style={{ height:"85vh", width:"100%" }}
      >
        <Source id="route" type="geojson"
          data={{ type:"Feature", geometry:{ type:"LineString",
                 coordinates:line.map(([la,ln])=>[ln,la]) }}}>
          <Layer id="route-line" type="line"
            paint={{ "line-color":"#2563eb", "line-width":4 }} />
        </Source>
        <Marker latitude={lat} longitude={lng} />
      </Map>

      {}
      <div style={{ padding:16, background:"#f5f5f5",
                    display:"flex", gap:24, alignItems:"center", color:"#000" }}>
        <button onClick={onReset}>Reset</button>
        <button onClick={handleAsk}>Ask Coach</button>
        <div>
          <strong>Done:</strong> {done_km.toFixed(2)} km |&nbsp;
          <strong>To go:</strong> {remain_km.toFixed(2)} km |&nbsp;
          <strong>Pace:</strong> {paceTxt} min/km
        </div>
      </div>

      {/* Message LLM contrasté */}
      {msg && (
        <div style={{ padding:12, fontStyle:"italic",
                      color:"#f5f5f5", background:"#1a1a1a" }}>
          {msg}
        </div>
      )}
    </div>
  );
}