# backend/optionA/models.py
from pydantic import BaseModel
from typing import Optional

class CoachIn(BaseModel):
    done_km:   float
    remain_km: float
    pace_now:  float
    next_change_km: float
    pace_obj:  float
    pace_avg:  float
    pace_gap:  float
    time_next_change_min:  float
    heart_rate: Optional[int] = None
    time_next_change_obj_min: float
    time_run_min: float
    eta_gap_min:  float
    pace_cv: float