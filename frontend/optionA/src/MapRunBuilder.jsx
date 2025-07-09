import { useState, useRef, useCallback } from "react";
import Map, { Marker, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import haversine from "haversine-distance";
import RacePlayer from "./RacePlayer";

export default function MapRunBuilder() {
  const [pts,  setPts]  = useState([]); 
  const [pace, setPace] = useState(5.0);
  const [session, setSession] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const mapRef = useRef();

  const handleClick = useCallback(e => {
    if (!drawing || session) return;
    const { lat, lng } = e.lngLat;
    setPts(p => [...p, [lat, lng]]);
  }, [drawing, session]);

  async function buildRoute() {
    if (pts.length < 2) return alert("Ajoute au moins deux points !");
    const coords = pts.map(([la,ln]) => `${ln},${la}`).join(";");
    const url    = `https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=geojson`;

    let js;
    try { js = await fetch(url).then(r => r.json()); }
    catch { return alert("Erreur réseau OSRM"); }

    if (!js?.routes?.length) return alert("OSRM n'a pas renvoyé d'itinéraire.");

    const line = js.routes[0].geometry.coordinates.map(([lng,lat]) => [lat,lng]);
    const pace_s_m = pace * 60 / 1000;

    const dur = [], distCum = [0];
    for (let i=0;i<line.length-1;i++) {
      const d_m = haversine([line[i][1],line[i][0]], [line[i+1][1],line[i+1][0]]);
      distCum.push(distCum.at(-1)+d_m);
      dur.push(Math.max(200, Math.round(d_m * pace_s_m * 1000)));
    }
    setSession({ line, dur, distCum, pace });
  }

  const reset = () => { setSession(null); setPts([]); setDrawing(false); };

  if (session) return <RacePlayer {...session} onReset={reset} />;

  return (
    <div style={{ height:"100vh", width:"100vw", display:"flex", flexDirection:"column" }}>
      <Map
        ref={mapRef}
        initialViewState={{ latitude:48.86, longitude:2.35, zoom:12 }}
        mapStyle="https://tiles.stadiamaps.com/styles/alidade_smooth.json"
        mapLib={import("maplibre-gl")}
        style={{ flex:1 }}
        onClick={handleClick}
        cursor={drawing ? "crosshair" : "grab"}
      >
        {pts.map(([la,ln],i)=>(
          <Marker key={i} latitude={la} longitude={ln} color="#d9534f">{i+1}</Marker>
        ))}
        {pts.length>1 && (
          <Source id="preview" type="geojson"
            data={{ type:"Feature", geometry:{ type:"LineString",
              coordinates:pts.map(([la,ln])=>[ln,la]) }}}>
            <Layer id="preview-line" type="line"
              paint={{ "line-color":"#999", "line-dasharray":[2,2] }} />
          </Source>
        )}
      </Map>

      <div style={{ padding:16, background:"#f5f5f5",
                    display:"flex", gap:16, alignItems:"center", color:"#000" }}>
        <button
          onClick={() => setDrawing(d=>!d)}
          style={{ background:drawing?"#2563eb":"#e0e0e0",
                   color:drawing?"#fff":"#000" }}>
          Pointeur {drawing?"✔":""}
        </button>

        <button onClick={buildRoute} disabled={pts.length<2}>Démarrer</button>
        <button onClick={()=>setPts(p=>p.slice(0,-1))} disabled={!pts.length}>Annuler</button>
        <button onClick={()=>setPts([])} disabled={!pts.length}>Effacer</button>

        <label style={{ marginLeft:"auto" }}>
          Pace&nbsp;(min/km):
          <input
            type="number" step="0.1" value={pace}
            onChange={e=>setPace(Math.max(3, parseFloat(e.target.value)||5))}
            style={{ width:60, marginLeft:8, color:"#000", background:"#fff" }}
          />
        </label>
      </div>
    </div>
  );
}