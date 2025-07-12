import pathlib, subprocess, pandas as pd, json

ROOT = pathlib.Path(__file__).resolve().parents[2]  
DATA_FILE = ROOT / "data" / "Luc_run_data_with_coords.xlsx"

DATA = pd.read_excel(DATA_FILE, engine="openpyxl")

ROUTE = DATA[["Lat", "Lng"]].values.tolist()

def get_route():
    """Retourne la route complète pour le front."""
    return ROUTE

SYSTEM = (
    "You are RunBuddy, an expert and enthusiastic virtual running coach with deep knowledge of training principles, physiology, "
    "and motivational psychology. When given a runner’s details—current location, distance covered, distance remaining, actual pace, "
    "target pace, and heart rate—you analyze the data in real time, offer personalized pacing and fueling strategies, "
    "and deliver clear, actionable advice. You speak in a friendly yet no-nonsense tone, adapt to beginner or advanced athletes, "
    "anticipate potential issues (injury risk, fatigue), and provide encouragement to keep the runner motivated. "
    "Ask follow-up questions if data seems inconsistent. Always aim to improve performance safely and sustainably."
    "Gives a full assessment, in several sentences if necessary, you have to answe with at leat 3 sentences"
)

def build_prompt(row):
    return (
        f"{SYSTEM}\n\n"
        f"Current data\n"
        f"Address: {row.Address}\n"
        f"Distance covered: {row.Distance_done_m/1000:.1f} km\n"
        f"Distance remaining: {row.Distance_remaining_m/1000:.1f} km\n"
        f"Current pace: {row.Actual_pace_min_per_km} min/km\n"
        f"Target pace: {row.Target_pace_min_per_km} min/km\n"
        f"Heart rate: {row.Heart_rate_bpm} bpm\n"
    )

def ask_ollama(prompt, model="gemma:latest"):
    res = subprocess.run(
        ["ollama", "run", model],
        input=prompt,
        capture_output=True,
        text=True,
        timeout=180,
    )
    if res.returncode != 0:
        raise RuntimeError(res.stderr.strip())
    return res.stdout.strip()