from ..ollama_wrapper import build_prompt  
from ..models import CoachIn
from typing import Dict, Any

_RUNBUDDY = (
    "You are **RunBuddy**, an expert and enthusiastic virtual running coach with deep "
    "knowledge of training principles, physiology, and motivational psychology. "
    "You analyse the runner’s data in real-time, spot issues, and deliver clear, "
    "actionable advice. "
)

_PROMPT_KM = (
    _RUNBUDDY +
    "The athlete has just completed a kilometre.  \n"
    "• Give a **brief recap** of that km (pace consistency, heart-rate, etc.).  \n"
    "• Explain what this means for the **overall pacing strategy**.  \n"
    "• Suggest 1–2 concrete actions for the **next kilometre** (cadence, breathing, "
    "fuel, mental cues…).  \n"
    "Write **at least three sentences**, friendly but no-nonsense.\n"
)

_PROMPT_SLOW = (
    _RUNBUDDY +
    "The current pace has dropped **significantly below target**.  \n"
    "Give **one short, punchy tip** (1–2 sentences max) that the runner can apply "
    "immediately to get back on pace.  \n"
    "Be direct, motivational, and time-critical.\n"
)

_PROMPT_START = (
    _RUNBUDDY +
    "The runner is about to start.  \n"
    "• Give a quick **pre-race briefing**: pacing strategy, warm-up reminders, "
    "fuel/hydration timing, mental cue.  \n"
    "• Keep it short (≈ 3 sentences), energetic, and confidence-boosting.\n"
)

_PROMPT_END = (
    _RUNBUDDY +
    "The run has just finished.  \n"
    "• Provide a concise **post-race debrief**: overall pace vs target, HR trends, "
    "moments of strength/weakness.  \n"
    "• Suggest 2-3 recovery or next-workout recommendations (cool-down, stretching, "
    "nutrition, training focus).  \n"
    "Write at least three sentences, supportive and forward-looking.\n"
)


def prompt_run_start(data_dict: dict, km_stat: dict | None = None) -> str:
    core = build_prompt(**data_dict)     
    return _PROMPT_START + "\n=== Race Start ===\n" + core

def prompt_new_km(data_dict: dict, km_stat: dict | None) -> str:
    km_num = None
    if km_stat and "km" in km_stat:
        km_num = km_stat["km"]
    else:
        km_num = round(data_dict.get("done_km", 0))
    core = build_prompt(**data_dict)
    recap = ""
    if km_stat:
        recap = (
            f"\n\n--- KM {km_num} SUMMARY ---\n"
            f"- Avg pace : {km_stat['avg_pace']:.2f} min/km\n"
            f"- Pace CV  : {km_stat['cv_pace']:.3f}\n"
            f"- Avg HR   : {km_stat['avg_hr']:.0f} bpm\n"
        )
    header = f"\n=== End of Kilometre {km_num} ===\n"
    return _PROMPT_KM + header + core + recap

def prompt_pace_slow(data_dict: dict, km_stat: dict | None) -> str:
    core = build_prompt(**data_dict)
    return _PROMPT_SLOW + "\n=== Pace Alert ===\n\n" + core


def prompt_run_end(summary_dict: dict) -> str:
    recap = (
        f"\n\n--- RUN SUMMARY ---\n"
        f"- Distance : {summary_dict['total_km']:.1f} km\n"
        f"- Avg pace : {summary_dict['avg_pace']:.2f} min/km\n"
        f"- Pace CV  : {summary_dict['cv_pace']:.3f}\n"
        f"- Avg HR   : {summary_dict['avg_hr']:.0f} bpm\n"
        f"- Duration : {summary_dict['duration_min']:.1f} min\n"
    )
    return _PROMPT_END + recap