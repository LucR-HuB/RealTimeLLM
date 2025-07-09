import { useEffect, useRef, useState } from "react";
import Map, { Marker, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchStatus } from "./api";

export default function MapRunGl() {
  const [route, setRoute] = useState([]);  
  const [dur,   setDur]   = useState([]);     
  const [idx,   setIdx]   = useState(0);  
  const [msg,   setMsg]   = useState("Loading…");
  const [stats, setStats] = useState({ done_km: 0, remain_km: 0,
                                       pace_now: 0, pace_avg: 0 });
  const timerRef = useRef(null);

  useEffect(() => {
    fetch("http://localhost:8000/route")
      .then((r) => r.json())
      .then(({ line, dur }) => {
        setRoute(line);
        setDur(dur);
        playSegment(0, line, dur);
      });
    return () => clearTimeout(timerRef.current);
  }, []);

  function playSegment(i, line, durArr) {
    setIdx(i);

    fetch(`http://localhost:8000/metrics/${i}`)
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error);

    timerRef.current = setTimeout(() => {
      playSegment((i + 1) % line.length, line, durArr);
    }, durArr[i]);
  }

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
    <div style={{ height: "100vh", width: "100vw",
                  display: "flex", flexDirection: "column" }}>
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

      {}
      <div style={{ padding: 16, display: "flex", gap: 24,
                    background: "#f5f5f5", alignItems: "center" }}>
        <button onClick={handleAsk}
                style={{ background: "#2563eb", color: "#fff",
                         padding: "0.6rem 1.2rem", border: "none",
                         borderRadius: 6 }}>
          Ask Coach
        </button>

        <div>
          <strong>Done :</strong> {stats.done_km} km&nbsp; |&nbsp;
          <strong>To go :</strong> {stats.remain_km} km&nbsp; |&nbsp;
          <strong>Pace now :</strong> {stats.pace_now} min/km&nbsp; |&nbsp;
          <strong>Pace avg :</strong> {stats.pace_avg} min/km
        </div>
      </div>

      {}
      <div style={{ padding: 12, fontStyle: "italic" }}>{msg}</div>
    </div>
  );
}