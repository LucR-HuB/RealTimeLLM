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


def build_prompt(*, done_km: float, remain_km: float, pace_now: float, heart_rate: float | None = None) -> str:
    text = (
        f"{SYSTEM_PROMPT}\n\n"
        f"Distance run   : {done_km:.1f} km\n"
        f"Distance left  : {remain_km:.1f} km\n"
        f"Current pace   : {pace_now:.2f} min/km\n"
    )
    if heart_rate is not None:
        text += f"Heart rate     : {heart_rate:.0f} bpm\n"
    return text

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