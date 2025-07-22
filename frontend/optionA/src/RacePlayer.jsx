import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchCoach } from "./api";
import Dashboard from "./Dashboard";

/* palette couleur selon le pace objectif (min/km) */
const paceExpr = [
  "case",
  ["<", ["get", "pace"], 4], "#d73027",
  ["<", ["get", "pace"], 5], "#fc8d59",
  ["<", ["get", "pace"], 6], "#fee08b",
  "#91cf60",
];

/* interpolation entre deux points {lat,lng} */
const lerp = (a, b, t) => ({
  lat: a.lat + (b.lat - a.lat) * t,
  lng: a.lng + (b.lng - a.lng) * t,
});

/* tirage gaussien ~ N(0, 1) */
const randn = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const SIGMA_PACE   = 0.05;   // écart-type du bruit pace (min/km) ≈3 s/km
const SIGMA_HR     = 3;      // écart-type du bruit HR (bpm)
const UPDATE_MS    = 5000;   // cadence des mesures « réelles »
const MAX_POINTS   = 300;    // historique HR maximal

export default function RacePlayer({
  line,
  dur,
  distCum,
  paceArr,      // pace objectif par micro-segment
  paceAvg,
  segments = [],
  onReset,
}) {
  /* états réactifs */
  const [idx,      setIdx]      = useState(0);               // index du micro-segment
  const [pos,      setPos]      = useState({ lat: line[0][0], lng: line[0][1] });
  const [paceReal, setPaceReal] = useState(paceArr[0]);
  const [paceHist, setPaceHist] = useState([{ t: 0, pace: paceArr[0] }]);
  const [hrHist,   setHrHist]   = useState([]);              // [{t,hr}, …]
  const [msg,      setMsg]      = useState("");

  /* refs (persistantes) */
  const timerRef       = useRef(null);
  const lastUpdateRef  = useRef(0);      // dernière MAJ pace/HR
  const paceRealRef    = useRef(paceArr[0]);

  /* tableau des temps cumulés → recherche rapide de l’index courant */
  const cumTimes = useMemo(
    () => dur.reduce((a, d) => [...a, a.at(-1) + d], [0]).slice(1),
    [dur]
  );

  /* ─────────── boucle temps-réel ─────────── */
  useEffect(() => {
    const t0 = performance.now();

    timerRef.current = setInterval(() => {
      const elapsed = performance.now() - t0;

      /* --- trouver le micro-segment courant --- */
      const i = cumTimes.findIndex((t) => elapsed < t);
      if (i === -1) { clearInterval(timerRef.current); return; }  // course terminée
      setIdx(i);

      /* --- interp. position pour animer proprement --- */
      const tPrev = i === 0 ? 0 : cumTimes[i - 1];
      const r     = (elapsed - tPrev) / (cumTimes[i] - tPrev);
      const curr  = line[i];
      const next  = line[i + 1] ?? curr;
      setPos(lerp({ lat: curr[0], lng: curr[1] }, { lat: next[0], lng: next[1] }, r));

      /* --- toutes les 5 s : nouveau pace réel + HR --- */
      if (elapsed - lastUpdateRef.current >= UPDATE_MS) {
        /* pace réel : on se rapproche du pace objectif, plus un bruit gaussien */
        const paceObj    = paceArr[i];
        const drift      = 0.25 * (paceObj - paceRealRef.current);   // rapprochement progressif
        const noise      = randn() * SIGMA_PACE;
        const newPace    = Math.max(3, paceRealRef.current + drift + noise);

        paceRealRef.current = newPace;
        setPaceReal(newPace);
        setPaceHist(h => [...h.slice(-MAX_POINTS + 1), { t: Math.floor(elapsed / 1000), pace: newPace }]); // NEW

        /* HR simulée cohérente avec ce nouveau pace réel */
        const doneKm  = distCum[i] / 1000;
        const totalKm = distCum.at(-1) / 1000;
        const base    = 120 + (5 - newPace) * 10 + (doneKm / totalKm) * 25;
        const hrSim   = Math.round(
          Math.min(
            190,
            Math.max(
              95,
              base + randn() * SIGMA_HR + 3 * Math.sin(elapsed / 6000)
            )
          )
        );

        setHrHist((h) => [
          ...h.slice(-MAX_POINTS + 1),
          { t: Math.floor(elapsed / 1000), hr: hrSim },
        ]);

        lastUpdateRef.current = elapsed;
      }
    }, 200);     // ≈5 FPS pour l’animation

    return () => clearInterval(timerRef.current);
  }, [cumTimes, line, paceArr, distCum]);

  /* valeurs instantanées pour le dashboard */
  const done_km   = distCum[idx] / 1000;
  const remain_km = (distCum.at(-1) - distCum[idx]) / 1000;
  const pace_obj  = paceArr[idx];
  const hr_now    = hrHist.at(-1)?.hr ?? 120;

  /* GeoJSON segments colorés */
  const geoSegs = useMemo(
    () => ({
      type: "FeatureCollection",
      features: segments.map((s) => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [s.start.lng, s.start.lat],
            [s.end.lng  , s.end.lat ],
          ],
        },
        properties: { pace: s.pace },
      })),
    }),
    [segments]
  );

  /* bouton Ask Coach */
  async function handleAsk() {
    try {
      const res = await fetchCoach({
        done_km,
        remain_km,
        pace_now: paceReal,
        heart_rate: hr_now,
      });
      setMsg(res.message);
    } catch (err) {
      setMsg("⚠️ " + err.message);
    }
  }

  /* ───────────── UI ───────────── */
  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw" }}>
      {/* ===== MAP ===== */}
      <Map
        initialViewState={{ latitude: pos.lat, longitude: pos.lng, zoom: 14 }}
        mapStyle="https://tiles.stadiamaps.com/styles/alidade_smooth.json"
        mapLib={import("maplibre-gl")}
        style={{ flex: 1 }}
      >
        {/* tracé principal */}
        <Source id="route" type="geojson"
          data={{ type: "LineString", coordinates: line.map(([la, ln]) => [ln, la]) }}
        >
          <Layer id="route-line" type="line"
                 paint={{ "line-color": "#5fa5ff", "line-width": 2 }} />
        </Source>

        {/* segments colorés */}
        {segments.length > 0 && (
          <Source id="segs" type="geojson" data={geoSegs}>
            <Layer id="segs-line" type="line"
                   paint={{ "line-color": paceExpr, "line-width": 4 }} />
          </Source>
        )}

        {/* étiquettes pace */}
        {segments.map((s, i) => {
          const midLat = (s.start.lat + s.end.lat) / 2;
          const midLng = (s.start.lng + s.end.lng) / 2;
          const col =
            s.pace < 4 ? "#d73027" :
            s.pace < 5 ? "#fc8d59" :
            s.pace < 6 ? "#fee08b" : "#91cf60";
          return (
            <Marker key={i} latitude={midLat} longitude={midLng} anchor="bottom">
              <div style={{
                background: col, padding: "2px 4px", fontSize: 12,
                borderRadius: 4, transform: "translateY(-4px)", color: "#000",
              }}>
                {s.pace.toFixed(1)}′
              </div>
            </Marker>
          );
        })}

        {/* icône coureur */}
        <Marker latitude={pos.lat} longitude={pos.lng} />
      </Map>

      {/* ===== DASHBOARD ===== */}
      <Dashboard
        done_km={done_km}
        remain_km={remain_km}
        pace_obj={pace_obj}
        pace_real={paceReal}
        pace_avg={paceAvg}
        paceHist={paceHist} 
        hr_now={hr_now}
        hrHist={hrHist}
      />

      {/* barre d’actions */}
      <div style={{
        position: "absolute", left: 0, right: 300, bottom: 0,
        padding: 16, background: "#f5f5f5",
        display: "flex", gap: 24, alignItems: "center",
      }}>
        <button onClick={onReset}>Reset</button>
        <button onClick={handleAsk}>Ask Coach</button>
        <div>
          <strong>Obj:</strong> {pace_obj.toFixed(2)}&nbsp;|&nbsp;
          <strong>Real:</strong> {paceReal.toFixed(2)}&nbsp;|&nbsp;
          <strong>Avg:</strong> {paceAvg.toFixed(2)}&nbsp;|&nbsp;
          <strong>HR:</strong> {hr_now} bpm
        </div>
      </div>

      {/* réponse LLM */}
      {msg && (
        <div style={{
          position: "absolute", right: 300, bottom: 60,
          maxWidth: 400, padding: 12,
          background: "#1a1a1a", color: "#f5f5f5",
          fontStyle: "italic", borderRadius: 4,
        }}>
          {msg}
        </div>
      )}
    </div>
  );
}