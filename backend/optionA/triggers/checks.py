
from math import floor
from typing import Any
_last_km     : int  = -1
_run_started: bool = False

def reset_new_km_counter() -> None:
    global _last_km
    _last_km = -1

def reset_run_start_flag() -> None:
    global _run_started
    _run_started = False

def is_run_start(data: Any) -> bool:
    global _run_started
    if not _run_started:
        _run_started = True
        return True
    return False

def is_new_km(data: Any) -> bool:
    global _last_km
    km_now = floor(data.done_km)

    if km_now >= 1 and km_now > _last_km:
        _last_km = km_now
        return True
    return False

def pace_too_slow(data: Any, thresh: float = 0.20) -> bool:
    return data.pace_gap > thresh