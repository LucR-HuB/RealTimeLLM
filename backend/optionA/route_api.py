# backend/optionA/route_api.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from pathlib import Path

from .run_history_builder import RunHistoryBuilder
from .ollama_wrapper import build_prompt, ask_ollama

app = FastAPI(title="Realtime LLM Coach – v4 (logger intégré)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
class CoachIn(BaseModel):
    done_km:   float
    remain_km: float
    pace_now:  float
    next_change_km: float
    pace_obj:  float
    pace_avg:  float
    pace_gap:  float
    time_next_change_min:  float
    heart_rate: int | None = None 
    time_next_change_obj_min:   float 
    time_run_min: float
    eta_gap_min:  float
    pace_cv: float

logger: RunHistoryBuilder | None = None
start_ts: datetime | None = None

@app.post("/start")
def start_run():
    global logger, start_ts
    logger = RunHistoryBuilder(seg_len_m=100, autosave=True) 
    start_ts = datetime.utcnow()
    return {"status": "logger_ready"}

@app.post("/coach")
def coach(data: CoachIn):
    global logger
    if logger is None:
        return {"error": "run_not_started"}

    logger.add_sample(
        dist_m=data.done_km * 1000,
        pace=data.pace_now,
        hr=data.heart_rate,
    )
    prompt = build_prompt(**data.model_dump())
    try:
        msg = ask_ollama(prompt)
    except Exception as err:
        msg = f"Model error: {err}"
    return {"message": msg}

@app.post("/tick")
def tick(data: CoachIn):
    global logger
    if logger is None:
        return {"error": "run_not_started"}

    logger.add_sample(
        dist_m=data.done_km * 1000,
        pace=data.pace_now,
        hr=data.heart_rate,
    )
    return {"status": "logged"}

@app.post("/end")
def end_run():
    global logger, start_ts
    if logger is None:
        return {"error": "run_not_started"}
    logger.save_json()
    duration = round((datetime.utcnow() - start_ts).total_seconds() / 60, 1)
    logger = None
    return {"status": "saved", "duration_min": duration}