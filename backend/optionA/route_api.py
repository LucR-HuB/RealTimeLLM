# backend/optionA/route_api.py
"""FastAPI backend – v2 (distance = géodésique)

• /route  : renvoie la poly-ligne snappée + la durée *réelle* (ms) de chaque
            micro-segment, calculée avec la distance haversine et le pace
            présent dans l’Excel.
• /status : identique (LLM via Ollama).

Le fichier Excel doit comporter :
    Lat | Lng | Actual_pace_min_per_km | Target_pace_min_per_km
    Distance_done_m | Distance_remaining_m | (facultatif Runner / Address …)

Aucun pas fixe (200 m) n’est supposé : les durées sont recalculées pour CHAQUE
segment consécutif.
"""
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
from haversine import haversine  # pip install haversine
from pydantic import BaseModel

###############################################################################
# 1. Load Excel                                                               #
###############################################################################
ROOT = pathlib.Path(__file__).resolve().parents[2]  # …/RealTimeLLM
EXCEL = ROOT / "data" / "Alex_run_data.xlsx"   # change here if needed

DATA = pd.read_excel(EXCEL, engine="openpyxl")
RAW_ROUTE: List[List[float]] = DATA[["Lat", "Lng"]].values.tolist()

###############################################################################
# 2. Snap with OSRM (max 100 points, fallback)                                #
###############################################################################

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

###############################################################################
# 3. Durations – distance réelle × pace (sec/m)                               #
###############################################################################
pace_sec_per_m = DATA["Actual_pace_min_per_km"].values * 60 / 1000
pace_cycle = np.resize(pace_sec_per_m, len(SNAPPED_ROUTE) - 1)

durations_ms: List[int] = []
for i in range(len(SNAPPED_ROUTE) - 1):
    d_m = haversine(SNAPPED_ROUTE[i], SNAPPED_ROUTE[i + 1]) * 1000
    durations_ms.append(int(d_m * pace_cycle[i] * 1000))

###############################################################################
# 4. LLM helper                                                               #
###############################################################################
SYSTEM_PROMPT = (
    "You are an enthusiastic, concise running coach. "
    "Answer in ONE sentence (≤25 words). No extra text."
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
    return res.stdout.strip().split("\n")[0]

###############################################################################
# 5. FastAPI                                                                  #
###############################################################################
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
