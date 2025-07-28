# optionA/triggers/registry.py
from typing import Callable, Any, NamedTuple

from .checks   import is_run_start, is_new_km, pace_too_slow
from .prompts  import (
    prompt_run_start,
    prompt_new_km,
    prompt_pace_slow,
)

class Trigger(NamedTuple):
    name:   str
    check:  Callable[[Any], bool]
    prompt: Callable[[dict, dict | None], str]

TRIGGERS = [
    Trigger("RUN_START", is_run_start,  prompt_run_start),
    Trigger("NEW_KM",    is_new_km,     prompt_new_km),
    Trigger("PACE_SLOW", pace_too_slow, prompt_pace_slow),
]