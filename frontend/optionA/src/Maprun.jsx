import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker } from "react-leaflet";
import L from "leaflet";
import { fetchStatus } from "./api";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function MapRun({ route }) {
  const [idx, setIdx] = useState(0);
  const [msg, setMsg] = useState("Click ‘Ask Coach’ to get feedback");
  const mapRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % route.length), 2000);
    return () => clearInterval(id);
  }, [route.length]);

  useEffect(() => {
    if (mapRef.current) mapRef.current.setView(route[idx], mapRef.current.getZoom());
  }, [idx, route]);

  async function handleAsk() {
    try {
      const data = await fetchStatus(idx);
      setMsg(`[${data.km} km] ${data.message}`);
    } catch (err) {
      setMsg("⚠️ " + err.message);
    }
  }

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column" }}>
      <MapContainer
        center={route[0]}
        zoom={14}
        whenCreated={(m) => (mapRef.current = m)}
        style={{ height: "85vh", width: "100%" }} 
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Polyline positions={route} pathOptions={{ color: "#2563eb" }} />
        <Marker position={route[idx]} />
      </MapContainer>

      <div style={{ padding: "1rem", display: "flex", gap: "1rem" }}>
        <button
          onClick={handleAsk}
          style={{
            background: "#2563eb",
            color: "#fff",
            border: "none",
            padding: "0.6rem 1.2rem",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Ask Coach
        </button>
        <span>{msg}</span>
      </div>
    </div>
  );
}