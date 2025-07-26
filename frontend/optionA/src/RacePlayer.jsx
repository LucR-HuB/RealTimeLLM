import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchCoach, sendTick } from "./api";
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

const randn = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const SIGMA_PACE = 0.05;
const SIGMA_HR   = 3;
const UPDATE_MS  = 5000;
const MAX_POINTS = 300;

export default function RacePlayer({
  line,
  dur,
  distCum,
  paceArr,
  paceAvg,
  segments = [],
  onReset,
}) {
  const [idx, setIdx]             = useState(0);
  const [pos, setPos]             = useState({ lat: line[0][0], lng: line[0][1] });
  const [paceReal, setPaceReal]   = useState(paceArr[0]);
  const [paceHist, setPaceHist]   = useState([{ t: 0, pace: paceArr[0] }]);
  const [hrHist, setHrHist]       = useState([]);
  const [msg, setMsg]             = useState("");
  const [timeSec, setTimeSec]     = useState(0);

  const timerRef      = useRef(null);
  const lastTickRef   = useRef(0);
  const paceRealRef   = useRef(paceArr[0]);

  /* cumulative times (ms) */
  const cumTimes = useMemo(
    () => dur.reduce((a, d) => [...a, a.at(-1) + d], [0]).slice(1),
    [dur]
  );

  useEffect(() => {
    const t0 = performance.now();

    timerRef.current = setInterval(() => {
      const elapsed = performance.now() - t0;

      /* — progress along the polyline — */
      const i = cumTimes.findIndex(t => elapsed < t);
      if (i === -1) { clearInterval(timerRef.current); return; }
      setIdx(i);
      setTimeSec(Math.floor(elapsed / 1000));

      const tPrev = i === 0 ? 0 : cumTimes[i - 1];
      const r     = (elapsed - tPrev) / (cumTimes[i] - tPrev);
      const curr  = line[i];
      const next  = line[i + 1] ?? curr;
      setPos(lerp({ lat: curr[0], lng: curr[1] }, { lat: next[0], lng: next[1] }, r));

      if (elapsed - lastTickRef.current >= UPDATE_MS) {

        const paceObj = paceArr[i];
        const drift   = 0.25 * (paceObj - paceRealRef.current);
        const noise   = randn() * SIGMA_PACE;
        const newPace = Math.max(3, paceRealRef.current + drift + noise);

        paceRealRef.current = newPace;
        setPaceReal(newPace);
        setPaceHist(h => [
          ...h.slice(-MAX_POINTS + 1),
          { t: Math.floor(elapsed / 1000), pace: newPace },
        ]);

        const doneKm       = distCum[i] / 1000;
        const totalKm      = distCum.at(-1) / 1000;
        const baseHR       = 120 + (5 - newPace) * 10 + (doneKm / totalKm) * 25;
        const hrSim        = Math.round(
          Math.min(190, Math.max(95, baseHR + randn() * SIGMA_HR + 3 * Math.sin(elapsed / 6000)))
        );

        setHrHist(h => [
          ...h.slice(-MAX_POINTS + 1),
          { t: Math.floor(elapsed / 1000), hr: hrSim },
        ]);

        /* 2) calculs back-end */
        const remainKm = (distCum.at(-1) - distCum[i]) / 1000;
        const paceGap  = newPace - paceObj;

        const distNextKm = (() => {
          let j = i + 1;
          while (j < paceArr.length && paceArr[j] === paceObj) j++;
          return ((j < distCum.length ? distCum[j] : distCum.at(-1)) - distCum[i]) / 1000;
        })();

        const timeNextReal = distNextKm * newPace;
        const timeNextObj  = distNextKm * paceObj;
        const etaGapMin    = timeNextReal - timeNextObj;

        const paceCv = (() => {
          if (paceHist.length < 3) return 0;
          const mean = paceHist.reduce((s, p) => s + p.pace, 0) / paceHist.length;
          const var_ = paceHist.reduce((s, p) => s + (p.pace - mean) ** 2, 0) / (paceHist.length - 1);
          return Math.sqrt(var_) / mean;
        })();

        const payload = {
          done_km:               doneKm,
          remain_km:             remainKm,
          pace_now:              newPace,
          next_change_km:        distNextKm,
          pace_obj:              paceObj,
          pace_avg:              paceAvg,
          pace_gap:              paceGap,
          time_next_change_min:  timeNextReal,
          heart_rate:            hrSim,
          time_next_change_obj_min: timeNextObj,
          time_run_min:          timeSec / 60,
          eta_gap_min:           etaGapMin,
          pace_cv:               paceCv,
        };

        sendTick(payload, tip => {
          if (tip && tip !== "NO_TIP") setMsg(tip);
        });

        lastTickRef.current = elapsed;
      }
    }, 200);

    return () => clearInterval(timerRef.current);
  }, [cumTimes, line, paceArr, distCum]);


  const done_km  = distCum[idx] / 1000;
  const remain_km = (distCum.at(-1) - distCum[idx]) / 1000;
  const pace_obj  = paceArr[idx];
  const hr_now    = hrHist.at(-1)?.hr ?? 120;
  const time_min  = timeSec / 60;
  const pace_gap  = paceReal - pace_obj;

  const dist_next_km = (() => {
    const paceNow = paceArr[idx];
    let j = idx + 1;
    while (j < paceArr.length && paceArr[j] === paceNow) j++;
    const distNow  = distCum[idx];
    const distNext = j < distCum.length ? distCum[j] : distCum.at(-1);
    return (distNext - distNow) / 1000;
  })();

  const time_next_change_min = dist_next_km * paceReal;
  const time_next_change_sec = Math.round(time_next_change_min * 60);
  const time_next_change_obj_min = dist_next_km * pace_obj;
  const time_next_change_obj_sec = Math.round(time_next_change_obj_min * 60);
  const eta_gap_min = time_next_change_min - time_next_change_obj_min;
  const eta_gap_sec = time_next_change_sec - time_next_change_obj_sec;

  const pace_cv = useMemo(() => {
    if (paceHist.length < 3) return 0;
    const mean = paceHist.reduce((s, p) => s + p.pace, 0) / paceHist.length;
    const var_ = paceHist.reduce((s, p) => s + (p.pace - mean) ** 2, 0) / (paceHist.length - 1);
    return Math.sqrt(var_) / mean;
  }, [paceHist]);

  const hr_avg = useMemo(() => {
    if (hrHist.length === 0) return hr_now;
    return Math.round(hrHist.reduce((s, p) => s + p.hr, 0) / hrHist.length);
  }, [hrHist, hr_now]);

  const geoSegs = useMemo(
    () => ({
      type: "FeatureCollection",
      features: segments.map(s => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [s.start.lng, s.start.lat],
            [s.end.lng,   s.end.lat],
          ],
        },
        properties: { pace: s.pace },
      })),
    }),
    [segments]
  );

  async function handleAsk() {
    try {
      const res = await fetchCoach({
        done_km,
        remain_km,
        next_change_km: dist_next_km,
        time_next_change_obj_min,
        pace_now: paceReal,
        pace_obj,
        pace_avg: paceAvg,
        time_next_change_min,
        pace_gap,
        eta_gap_min,
        time_run_min: time_min,
        heart_rate: hr_now,
        pace_cv,
        hr_avg,
      });
      if (res.message && res.message !== "NO_TIP") setMsg(res.message);
    } catch (err) {
      setMsg("⚠️ " + err.message);
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw" }}>
      <Map
        initialViewState={{ latitude: pos.lat, longitude: pos.lng, zoom: 14 }}
        mapStyle="https://tiles.stadiamaps.com/styles/alidade_smooth.json"
        mapLib={import("maplibre-gl")}
        style={{ flex: 1 }}
      >
        {}
        <Source id="route" type="geojson"
                data={{ type: "LineString", coordinates: line.map(([la, ln]) => [ln, la]) }}>
          <Layer id="route-line" type="line"
                 paint={{ "line-color": "#5fa5ff", "line-width": 2 }} />
        </Source>

        {}
        {segments.length > 0 && (
          <Source id="segs" type="geojson" data={geoSegs}>
            <Layer id="segs-line" type="line"
                   paint={{ "line-color": paceExpr, "line-width": 4 }} />
          </Source>
        )}

        {}
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
                background: col,
                padding: "2px 4px",
                fontSize: 12,
                borderRadius: 4,
                transform: "translateY(-4px)",
                color: "#000",
              }}>
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
        pace_obj={pace_obj}
        pace_real={paceReal}
        pace_avg={paceAvg}
        paceHist={paceHist}
        hr_now={hr_now}
        hrHist={hrHist}
        dist_next_km={dist_next_km}
        time_next_change_sec={time_next_change_sec}
        timeSec={timeSec}
        time_next_change_obj_sec={time_next_change_obj_sec}
        eta_gap_sec={eta_gap_sec}
        pace_gap={pace_gap}
        pace_cv={pace_cv}
        hr_avg={hr_avg}
      />

      {}
      <div style={{
        position: "absolute",
        left: 0,
        right: 300,
        bottom: 0,
        padding: 16,
        background: "#f5f5f5",
        display: "flex",
        gap: 24,
        alignItems: "center",
      }}>
        <button
          onClick={async () => {
            try { await fetch("http://localhost:8000/end", { method: "POST" }); } catch {}
            onReset();
          }}
        >
          Reset
        </button>

        <button onClick={handleAsk}>Ask Coach</button>

        <div>
          <strong>Obj:</strong> {pace_obj.toFixed(2)}&nbsp;|&nbsp;
          <strong>Real:</strong> {paceReal.toFixed(2)}&nbsp;|&nbsp;
          <strong>Avg:</strong> {paceAvg.toFixed(2)}&nbsp;|&nbsp;
          <strong>HR:</strong> {hr_now} bpm
        </div>
      </div>

      {}
      {msg && (
        <div style={{
          position: "absolute",
          right: 300,
          bottom: 60,
          maxWidth: 400,
          padding: 12,
          background: "#1a1a1a",
          color: "#f5f5f5",
          fontStyle: "italic",
          borderRadius: 4,
        }}>
          {msg}
        </div>
      )}
    </div>
  );
}