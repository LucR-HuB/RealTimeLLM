import subprocess


SYSTEM_PROMPT = (
    "You are RunBuddy, an expert and enthusiastic virtual running coach with deep knowledge of training principles, physiology, "
    "and motivational psychology. When given a runner’s details—current location, distance covered, distance remaining, actual pace, "
    "target pace, and heart rate—you analyze the data in real time, offer personalized pacing and fueling strategies, "
    "and deliver clear, actionable advice. You speak in a friendly yet no-nonsense tone, adapt to beginner or advanced athletes, "
    "anticipate potential issues (injury risk, fatigue), and provide encouragement to keep the runner motivated. "
    "Ask follow-up questions if data seems inconsistent. Always aim to improve performance safely and sustainably."
    "Gives a full assessment, in several sentences if necessary, you have to answe with at leat 3 sentences"
)


def build_prompt(
    *,
    done_km: float,
    remain_km: float,
    time_run_min: float,
    pace_now: float,
    pace_obj: float,
    pace_avg: float,
    pace_gap: float,
    next_change_km: float,
    time_next_change_min: float,        
    time_next_change_obj_min: float,    
    eta_gap_min: float,                 
    pace_cv: float,
    heart_rate: int | None = None,
    hr_avg: int | None = None,
) -> str:
    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"Distance run   : {done_km:.1f} km\n"
        f"Distance left  : {remain_km:.1f} km\n"
        f"Elapsed time       : {time_run_min:.1f} min\n"
        f"Current pace   : {pace_now:.2f} min/km\n"
        f"Target pace    : {pace_obj:.2f} min/km\n"
        f"Pace gap           : {pace_gap:+.2f} min/km\n"
        f"ETA to next change(real) : {time_next_change_min:.1f} min\n"
        f"ETA to next change (target) : {time_next_change_obj_min:.1f} min\n"
        f"ETA gap                     : {eta_gap_min:+.1f} min\n"
        f"Pace variability (CV)       : {pace_cv:.3f}\n"
        f"Average pace   : {pace_avg:.2f} min/km\n"
        f"Next pace change in : {next_change_km:.1f} km\n"
    )
    if heart_rate is not None:
        prompt += f"Heart rate    : {heart_rate} bpm\n"
    if hr_avg is not None:
        prompt += f"Heart rate average        : {hr_avg} bpm\n"
    return prompt

def ask_ollama(prompt: str, model: str = "gemma:latest") -> str:
    res = subprocess.run(
        ["ollama", "run", model],
        input=prompt,
        text=True,
        capture_output=True,
        timeout=180,
    )
    if res.returncode != 0:
        raise RuntimeError(res.stderr.strip())
    return res.stdout.strip()