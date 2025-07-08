"""
Expose deux endpoints :
GET /route   → polyline snappée sur les rues + durées (ms) entre points
POST /status → message LLM (inchangé)
"""
import pathlib, subprocess, pandas as pd, requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import JSONResponse

# 1) Charger le fichier Excel
ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = pd.read_excel(ROOT / "data" / "Luc_run_data_with_coords.xlsx", engine="openpyxl")

# 2) Polyline d'origine
RAW_ROUTE = DATA[["Lat", "Lng"]].values.tolist()

# 3) Durée (ms) pour passer d'un point à l'autre selon le pace réel
segment_duration = (
    0.2 * DATA["Actual_pace_min_per_km"].values * 60 * 1000  # 200 m × pace (min/km) → ms
).astype(int).tolist()

# 4) Snapping OSRM (foot)
def snapped_route():
    coords = ";".join(f"{lng},{lat}" for lat, lng in RAW_ROUTE)
    url = (
        "https://router.project-osrm.org/route/v1/foot/"
        f"{coords}?overview=full&geometries=geojson"
    )
    js = requests.get(url, timeout=10).json()
    snapped = [[lat, lng] for lng, lat in js["routes"][0]["geometry"]["coordinates"]]
    return snapped

SNAPPED = snapped_route()

# 5) LLM utils (identiques)
SYSTEM = ("You are an enthusiastic, concise running coach. "
          "Answer in ONE sentence (≤25 words). No extra text.")
def build_prompt(row):
    return (
        f"{SYSTEM}\n\n"
        f"Address: {row.Address}\n"
        f"Distance: {row.Distance_done_m/1000:.1f} km "
        f"(remaining {row.Distance_remaining_m/1000:.1f} km)\n"
        f"Pace: {row.Actual_pace_min_per_km} / {row.Target_pace_min_per_km} min/km\n"
        f"Heart rate: {row.Heart_rate_bpm} bpm\n"
    )
def ask_ollama(prompt, model="gemma:latest"):
    res = subprocess.run(
        ["ollama", "run", model],
        input=prompt,
        capture_output=True,
        text=True,
        timeout=180,
    )
    return res.stdout.strip().split("\n")[0]

# 6) FastAPI
app = FastAPI(title="Realtime LLM Coach – Option A")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class LLMRequest(BaseModel):
    index: int

@app.post("/status")
def status(req: LLMRequest):
    if not 0 <= req.index < len(DATA):
        return {"error": "index out of range"}
    row = DATA.iloc[req.index]
    return {
        "km": round(row.Distance_done_m / 1000, 1),
        "message": ask_ollama(build_prompt(row)),
    }

@app.get("/route")
def route():
    """Polyline snappée + durations (ms)"""
    return JSONResponse({"line": SNAPPED, "dur": segment_duration})