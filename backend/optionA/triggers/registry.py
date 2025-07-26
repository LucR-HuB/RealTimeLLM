from dataclasses import dataclass
from typing import Callable, Dict, Any

from .checks  import is_new_km, pace_too_slow
from .prompts import prompt_new_km, prompt_pace_slow
from ..route_api import CoachIn         
from ..models import CoachIn 

CheckFn   = Callable[[CoachIn], bool]
PromptFn  = Callable[[Dict[str, Any]], str]

@dataclass
class Trigger:
    name:   str
    check:  CheckFn
    prompt: PromptFn

TRIGGERS = [
    Trigger("NEW_KM",     is_new_km,     prompt_new_km),
    Trigger("PACE_SLOW",  pace_too_slow, prompt_pace_slow),
]