from ..ollama_wrapper import build_prompt  
from ..models import CoachIn

def prompt_new_km(data_dict: dict) -> str:
    core = build_prompt(**data_dict)
    return "=== Bilan du km écoulé ===\n\n" + core


def prompt_pace_slow(data_dict: dict) -> str:
    core = build_prompt(**data_dict)
    return (
        "=== Alerte : allure en retard ===\n"
        "(Réagis avec un conseil court et incisif)\n\n" + core
    )