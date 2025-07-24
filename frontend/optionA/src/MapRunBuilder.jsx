// src/MapRunBuilder.jsx
import { useState, useRef, useCallback } from "react";
import Map, { Marker, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import haversine from "haversine-distance";
import RacePlayer from "./RacePlayer";

export default function MapRunBuilder() {
  const [pts,       setPts]       = useState([]);    
  const [segments,  setSegments]  = useState([]);     
  const [drawing,   setDrawing]   = useState(false);
  const [session,   setSession]   = useState(null);
  const mapRef                    = useRef();

  const handleClick = useCallback(
    (e) => {
      if (!drawing || session) return;

      const { lat, lng } = e.lngLat;

      if (pts.length) {
        const pace = parseFloat(prompt("Pace de ce segment (min/km) :", "5.0"));
        if (!pace || pace < 3) {
          alert("Pace invalide (≥ 3 min/km) — segment ignoré");
          return;                
        }
        const seg = {
          start: { lat: pts.at(-1)[0], lng: pts.at(-1)[1] },
          end  : { lat, lng },
          pace,
        };
        setSegments((s) => [...s, seg]);
      }

      setPts((p) => [...p, [lat, lng]]);
    },
    [drawing, session, pts]
  );
  async function buildRoute() {
    if (!segments.length) return alert("Trace au moins un segment !");
  
    const line      = [];
    const dur       = [];
    const distCum   = [0];
    const paceArr   = [];               
  
    for (const seg of segments) {
      const coords = `${seg.start.lng},${seg.start.lat};${seg.end.lng},${seg.end.lat}`;
      const url    = `https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=geojson`;
  
      let js;
      try { js = await fetch(url).then(r => r.json()); }
      catch { return alert("Erreur réseau OSRM"); }
      if (!js?.routes?.length) return alert("OSRM n'a pas renvoyé d'itinéraire.");
  
      const subLine   = js.routes[0].geometry.coordinates.map(([lng,lat]) => [lat,lng]);
      const pace_s_m  = seg.pace * 60 / 1000;
      const startIdx  = line.length ? 1 : 0;   
  
      for (let i = startIdx; i < subLine.length; i++) line.push(subLine[i]);
  
      for (let i = 0; i < subLine.length - 1; i++) {
        const d_m = haversine(
          [subLine[i][1], subLine[i][0]],
          [subLine[i+1][1], subLine[i+1][0]]
        );
        distCum.push(distCum.at(-1) + d_m);
        dur.push(Math.max(200, Math.round(d_m * pace_s_m * 1000)));
        paceArr.push(seg.pace);         
      }
    }
  
    const totalMin  = dur.reduce((a,b)=>a+b,0) / 60000;
    const totalKm   = distCum.at(-1) / 1000;
    const paceMean  = totalMin / totalKm || 0;
  
    setSession({ line, dur, distCum, paceArr, paceAvg: paceMean });
  }

  const reset = () => {
    setSession(null);
    setPts([]);
    setSegments([]);
    setDrawing(false);
  };

  if (session) return <RacePlayer {...session} onReset={reset} />;

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column" }}>
      <Map
        ref={mapRef}
        initialViewState={{ latitude: 48.86, longitude: 2.35, zoom: 12 }}
        mapStyle="https://tiles.stadiamaps.com/styles/alidade_smooth.json"
        mapLib={import("maplibre-gl")}
        style={{ flex: 1 }}
        onClick={handleClick}
        cursor={drawing ? "crosshair" : "grab"}
      >
        {}
        {pts.map(([la, ln], i) => (
          <Marker key={i} latitude={la} longitude={ln} color="#d9534f">
            {i + 1}
          </Marker>
        ))}
        {}
        {pts.length > 1 && (
          <Source
            id="preview"
            type="geojson"
            data={{ type: "Feature", geometry: { type: "LineString", coordinates: pts.map(([la, ln]) => [ln, la]) } }}
          >
            <Layer id="preview-line" type="line" paint={{ "line-color": "#999", "line-dasharray": [2, 2] }} />
          </Source>
        )}
      </Map>

      {}
      <div style={{ padding: 16, background: "#f5f5f5", display: "flex", gap: 16, alignItems: "center", color: "#000" }}>
        <button
          onClick={() => setDrawing((d) => !d)}
          style={{ background: drawing ? "#2563eb" : "#e0e0e0", color: drawing ? "#fff" : "#000" }}
        >
          Pointeur {drawing ? "✔" : ""}
        </button>

        <button onClick={buildRoute} disabled={segments.length === 0}>Démarrer</button>
        <button
          onClick={() => setPts((p) => p.slice(0, -1))}
          disabled={pts.length === 0}
        >
          Annuler
        </button>
        <button onClick={reset} disabled={pts.length === 0 && segments.length === 0}>
          Reset
        </button>
      </div>
    </div>
  );
}