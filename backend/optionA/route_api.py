from __future__ import annotations

import logging
import math
import pathlib
import subprocess
from typing import List

import numpy as np
import pandas as pd
import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from haversine import haversine 
from pydantic import BaseModel

ROOT = pathlib.Path(__file__).resolve().parents[2] 
EXCEL = ROOT / "data" / "Alex_run_data.xlsx"  

DATA = pd.read_excel(EXCEL, engine="openpyxl")
RAW_ROUTE: List[List[float]] = DATA[["Lat", "Lng"]].values.tolist()

def snapped_route(raw: List[List[float]]) -> List[List[float]]:
    max_wp = 100
    if len(raw) > max_wp:
        step = math.ceil(len(raw) / max_wp)
        raw = raw[::step] + [raw[-1]]

    coords = ";".join(f"{lng},{lat}" for lat, lng in raw)
    url = (
        "https://router.project-osrm.org/route/v1/foot/"
        f"{coords}?overview=full&geometries=geojson"
    )
    try:
        js = requests.get(url, timeout=10).json()
        snapped = [[lat, lng] for lng, lat in js["routes"][0]["geometry"]["coordinates"]]
        return snapped
    except Exception as e:
        logging.warning(f"OSRM fallback: {e}")
        return raw

SNAPPED_ROUTE: List[List[float]] = snapped_route(RAW_ROUTE)

pace_sec_per_m = DATA["Actual_pace_min_per_km"].values * 60 / 1000
pace_cycle = np.resize(pace_sec_per_m, len(SNAPPED_ROUTE) - 1)

durations_ms: List[int] = []
for i in range(len(SNAPPED_ROUTE) - 1):
    d_m = haversine(SNAPPED_ROUTE[i], SNAPPED_ROUTE[i + 1]) * 1000
    durations_ms.append(int(d_m * pace_cycle[i] * 1000))
    
SYSTEM_PROMPT = (
    "You are RunBuddy, an expert and enthusiastic virtual running coach with deep knowledge of training principles, physiology, "
    "and motivational psychology. When given a runner’s details—current location, distance covered, distance remaining, actual pace, "
    "target pace, and heart rate—you analyze the data in real time, offer personalized pacing and fueling strategies, "
    "and deliver clear, actionable advice. You speak in a friendly yet no-nonsense tone, adapt to beginner or advanced athletes, "
    "anticipate potential issues (injury risk, fatigue), and provide encouragement to keep the runner motivated. "
    "Ask follow-up questions if data seems inconsistent. Always aim to improve performance safely and sustainably."
    "Gives a full assessment, in several sentences if necessary, you have to answe with at leat 3 sentences"
)

def build_prompt(row: pd.Series) -> str:
    return (
        f"{SYSTEM_PROMPT}\n\n"
        f"Distance: {row.Distance_done_m/1000:.1f} km "
        f"(remaining {row.Distance_remaining_m/1000:.1f} km)\n"
        f"Pace: {row.Actual_pace_min_per_km} / {row.Target_pace_min_per_km} min/km\n"
        f"Heart rate: {row.Heart_rate_bpm} bpm\n"
    )

def ask_ollama(prompt: str, model: str = "gemma:latest") -> str:
    res = subprocess.run(["ollama", "run", model], input=prompt, text=True,
                         capture_output=True, timeout=180)
    return res.stdout.strip()

app = FastAPI(title="Realtime LLM Coach – Option A – v2")
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
    """Polyline snappée + durées (ms) pour chaque micro-segment."""
    return JSONResponse({"line": SNAPPED_ROUTE, "dur": durations_ms})

@app.get("/metrics/{idx}")
def metrics(idx: int):
    """
    Renvoie les stats pour la ligne `idx`
    sans appeler le LLM.
    """
    if not 0 <= idx < len(DATA):
        return {"error": "index out of range"}

    done_m  = float(DATA.Distance_done_m.iloc[idx])
    remain_m = float(DATA.Distance_remaining_m.iloc[idx])
    pace_now = float(DATA.Actual_pace_min_per_km.iloc[idx])
    pace_avg = float(DATA.Actual_pace_min_per_km.iloc[: idx + 1].mean())

    return {
        "done_km": round(done_m / 1000, 2),
        "remain_km": round(remain_m / 1000, 2),
        "pace_now": round(pace_now, 2),
        "pace_avg": round(pace_avg, 2),
    }
    
from pydantic import BaseModel

class CoachIn(BaseModel):
    done_km:   float
    remain_km: float
    pace_now:  float

@app.post("/coach")
def coach(data: CoachIn):
    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"Distance run : {data.done_km:.1f} km\n"
        f"Distance left: {data.remain_km:.1f} km\n"
        f"Current pace : {data.pace_now:.2f} min/km\n"
    )
    try:
        msg = ask_ollama(prompt)
    except Exception as err:
        msg = f"Model error: {err}"
    return {"message": msg}