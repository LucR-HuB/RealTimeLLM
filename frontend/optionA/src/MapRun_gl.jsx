import { useEffect, useRef, useState } from "react";
import Map, { Marker, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchStatus } from "./api";

export default function MapRunGl() {
  const [route, setRoute] = useState([]);      // [[lat,lng], …]
  const [dur, setDur] = useState([]);          // durées ms
  const [idx, setIdx] = useState(0);           // index courant
  const [msg, setMsg] = useState("Loading…");
  const timerRef = useRef(null);

  /* Charger polyline + durations */
  useEffect(() => {
    fetch("http://localhost:8000/route")
      .then((r) => r.json())
      .then(({ line, dur }) => {
        setRoute(line);
        setDur(dur);
        setMsg("Click Ask Coach");
        playSegment(0, line, dur);
      });
    return () => clearTimeout(timerRef.current);
  }, []);

  /* Fonction récursive pour avancer à la bonne vitesse */
  function playSegment(i, line, durArr) {
    setIdx(i);
    timerRef.current = setTimeout(() => {
      playSegment((i + 1) % line.length, line, durArr);
    }, durArr[i]);
  }

  /* Bouton Ask Coach */
  async function handleAsk() {
    try {
      const data = await fetchStatus(idx);
      setMsg(`[${data.km} km] ${data.message}`);
    } catch (e) {
      setMsg("⚠️ " + e.message);
    }
  }

  if (!route.length) return <p style={{ padding: 20 }}>Loading route…</p>;
  const [lat, lng] = route[idx];

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column" }}>
      <Map
        initialViewState={{ latitude: lat, longitude: lng, zoom: 14 }}
        mapStyle="https://tiles.stadiamaps.com/styles/alidade_smooth.json"
        style={{ height: "85vh", width: "100%" }}
        mapLib={import("maplibre-gl")}
      >
        <Source id="line" type="geojson"
                data={{ type: "Feature",
                        geometry: { type: "LineString",
                                    coordinates: route.map(([la, ln]) => [ln, la]) } }}>
          <Layer id="l" type="line"
                 paint={{ "line-color": "#2563eb", "line-width": 4 }} />
        </Source>
        <Marker latitude={lat} longitude={lng} />
      </Map>

      <div style={{ padding: 16, display: "flex", gap: 16 }}>
        <button onClick={handleAsk}
                style={{ background: "#2563eb", color: "#fff",
                         padding: "0.6rem 1.2rem", border: "none",
                         borderRadius: 6 }}>
          Ask Coach
        </button>
        <span>{msg}</span>
      </div>
    </div>
  );
}