from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .ollama_wrapper import build_prompt, ask_ollama

app = FastAPI(title="Realtime LLM Coach – v3 (HR)")
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

@app.post("/coach")
def coach(data: CoachIn):
    prompt = build_prompt(**data.model_dump())
    try:
        msg = ask_ollama(prompt)
    except Exception as err:
        msg = f"Model error: {err}"
    return {"message": msg}
