# ─── route_api.py ───────────────────────────────────────────────────────────────
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime

from .run_history_builder import RunHistoryBuilder
from .ollama_wrapper      import build_prompt, ask_ollama

from .prompt_logger import reset as reset_prompt_log, log as log_prompt
from .triggers.checks import reset_new_km_counter, reset_run_start_flag

app = FastAPI(title="Realtime LLM Coach – v5")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def _round_sig(x: float, sig: int = 4) -> float:
    try:
        return float(f"{x:.{sig}g}")
    except Exception:
        return x              

def _round_recursive(obj, sig: int = 3):
    if isinstance(obj, float):
        return _round_sig(obj, sig)
    if isinstance(obj, list):
        return [_round_recursive(el, sig) for el in obj]
    if isinstance(obj, dict):
        return {k: _round_recursive(v, sig) for k, v in obj.items()}
    return obj

def _build_summary(run: RunHistoryBuilder, duration_min: float) -> dict:
    total_km = round(run.km_stats[-1].km_idx if run.km_stats else 0, 3)

    all_paces = [p for km in run.km_stats for p in km.paces]
    all_hrs   = [hr for km in run.km_stats for hr in km.hrs if hr is not None]

    avg_pace = sum(all_paces) / len(all_paces) if all_paces else 0
    cv_pace  = (
        ((sum((p - avg_pace) ** 2 for p in all_paces) /
          (len(all_paces) - 1)) ** 0.5) / avg_pace
    ) if len(all_paces) > 1 else 0

    return {
        "total_km"   : total_km,
        "avg_pace"   : avg_pace,
        "cv_pace"    : cv_pace,
        "avg_hr"     : (sum(all_hrs) / len(all_hrs)) if all_hrs else None,
        "duration_min": duration_min,
    }
class CoachIn(BaseModel):
    done_km: float
    remain_km: float
    pace_now: float
    next_change_km: float
    pace_obj: float
    pace_avg: float
    pace_gap: float
    time_next_change_min: float
    heart_rate: int | None = None
    time_next_change_obj_min: float
    time_run_min: float
    eta_gap_min: float
    pace_cv: float
    
from .triggers.registry import TRIGGERS

logger:   RunHistoryBuilder | None = None
start_ts: datetime | None = None
_start_prompt_sent: bool = False

@app.post("/start")
def start_run():
    global logger, start_ts
    logger   = RunHistoryBuilder(seg_len_m=100, autosave=True)
    start_ts = datetime.utcnow()

    reset_prompt_log()
    reset_new_km_counter()
    reset_run_start_flag()
    return {"status": "logger_ready"}

@app.post("/coach")
def coach(data: CoachIn):
    if logger is None:
        return {"error": "run_not_started"}

    logger.add_sample(dist_m=data.done_km * 1000,
                      pace=data.pace_now,
                      hr=data.heart_rate)

    data_dict = _round_recursive(data.model_dump())

    prompt = build_prompt(**data_dict)
    try:
        msg = ask_ollama(prompt)
    except Exception as err:
        msg = f"Model error: {err}"

    log_prompt("ASK_COACH", prompt, data_dict, msg)
    return {"message": msg}

@app.post("/tick")
def tick(data: CoachIn):
    global logger, start_ts
    if logger is None:
        return {"error": "run_not_started"}

    logger.add_sample(
        dist_m = data.done_km * 1000,
        pace   = data.pace_now,
        hr     = data.heart_rate,
    )

    dist_left_km = min(data.remain_km, data.next_change_km)
    if data.remain_km <= 0.08: 
        duration = round((datetime.utcnow() - start_ts).total_seconds() / 60, 3)
        summary  = _build_summary(logger, duration)

        from .triggers.prompts import prompt_run_end
        prompt  = prompt_run_end(summary)
        try:
            advice = ask_ollama(prompt)
        except Exception as err:
            advice = f"Model error: {err}"

        log_prompt("RUN_END", prompt, summary, advice)

        logger.save_json()
        logger = None
        return {
            "status"      : "RUN_END",
            "duration_min": duration,
            "message"     : advice,
        }
    km_idx  = int(data.done_km)
    km_stat = None
    if 0 < km_idx <= len(logger.km_stats):
        km_stat = logger.km_stats[km_idx - 1].to_json()
    data_dict = _round_recursive(data.model_dump())
    for trig in TRIGGERS:
        if trig.check(data):                        
            prompt = trig.prompt(data_dict, km_stat)
            try:
                advice = ask_ollama(prompt)
            except Exception as err:
                advice = f"Model error: {err}"

            log_prompt(trig.name, prompt, data_dict, advice, km_stat)
            return {"status": trig.name, "message": advice}

    return {"status": "logged"}

@app.post("/end")
def end_run():
    global logger, start_ts
    if logger is None:
        return {"error": "run_not_started"}

    total_km   = round(logger.km_stats[-1].km_idx if logger.km_stats else 0, 3)
    all_paces  = [p for km in logger.km_stats for p in km.paces]
    all_hrs    = [hr for km in logger.km_stats for hr in km.hrs if hr is not None]

    summary = {
        "total_km"   : total_km,
        "avg_pace"   : sum(all_paces)/len(all_paces) if all_paces else 0,
        "cv_pace"    : ( (lambda m: (sum((p-m)**2 for p in all_paces) / (len(all_paces)-1))**0.5 / m)
                         (sum(all_paces)/len(all_paces)) ) if len(all_paces) > 1 else 0,
        "avg_hr"     : sum(all_hrs)/len(all_hrs) if all_hrs else None,
        "duration_min": round((datetime.utcnow() - start_ts).total_seconds() / 60, 3)
    }

    from .triggers.prompts import prompt_run_end        
    prompt  = prompt_run_end(summary)
    try:
        advice = ask_ollama(prompt)
    except Exception as err:
        advice = f"Model error: {err}"
    log_prompt("RUN_END", prompt, summary, advice)
    logger.save_json()    
    logger = None            

    return {
        "status"      : "RUN_END",
        "duration_min": summary["duration_min"],
        "message"     : advice
    }