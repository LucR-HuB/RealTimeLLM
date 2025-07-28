from ..ollama_wrapper import build_prompt  
from ..models import CoachIn
from typing import Dict, Any

def prompt_new_km(data_dict: dict, km_stat: dict | None) -> str:
    core = build_prompt(**data_dict)

    recap = ""
    if km_stat:
        recap = (
            f"\n\n--- KM {km_stat['km']} summary ---\n"
            f"- Avg pace  : {km_stat['avg_pace']:.2f} min/km\n"
            f"- Pace CV   : {km_stat['cv_pace']:.3f}\n"
            f"- Avg HR    : {km_stat['avg_hr']:.0f} bpm\n"
        )

    return "=== End of kilometre ===\n" + core + recap


def prompt_pace_slow(data_dict: dict, km_stat: dict | None) -> str:
    core = build_prompt(**data_dict)
    return (
        "=== Pace Alert ===\n"
        "You are falling behind the target pace. Give one short, punchy tip.\n\n"
        + core
    )