# Real-Time Running Coach – Technical README

## Overview

This repository hosts a **local, real-time running coach**.  
The backend ingests live metrics (distance, pace, heart rate) and, according to rule-based triggers, feeds them to a local LLM (served by **Ollama**) that returns context-aware text messages:

* **Start briefing**
* **Per-kilometre feedback**
* **Slow-down alerts**
* **Final summary**

No data leaves the machine; latency stays below one second on a 7-B model.

---

## Architecture (high level)

| Layer | Responsibility | Main files |
|-------|----------------|------------|
| **FastAPI** | REST + (optionally) WebSocket endpoints | `optionA/route_api.py` |
| **RunHistoryBuilder** | Stores samples, computes pace, HR and splits | `optionA/run_history_builder.py` |
| **Trigger engine** | Decides *when* a message is needed | `optionA/triggers/` |
| **Prompt builder** | Assembles the text fed to the LLM | `optionA/ollama_wrapper.py` + `optionA/triggers/prompts.py` |
| **LLM** | Generates final coaching text | served by Ollama |

All components run in the same process; no external services are required besides Ollama.

---

## API surface (REST)

| Method & path | Payload (∼) | Purpose |
|---------------|-------------|---------|
| `POST /start` | `{distance_goal, pace_goal}` *(optional)* | Initialise a new session, reset counters |
| `POST /tick`  | Live metrics JSON (see `CoachIn` model) | Main data feed; may return a coaching message |
| `POST /coach` | same as `/tick` | Manual “Ask coach now” |
| `POST /end`   | – | Force a clean shutdown + final summary |
| `GET  /status`* | – | Current stats + last messages *(optional)* |

*(Endpoints marked optional may not be enabled in the minimal demo.)*

---

## Data model (excerpt)

```python
class CoachIn(BaseModel):
    done_km: float
    remain_km: float
    pace_now: float
    next_change_km: float
    pace_obj: float
    pace_avg: float
    pace_gap: float
    time_next_change_min: float
    heart_rate: int | None = None
    time_run_min: float
    eta_gap_min: float
    pace_cv: float
```
All numeric fields are rounded to **4 significant digits** as soon as they reach the
backend.  
That keeps every prompt under the token limit while preserving meaningful
precision.

---

## Trigger catalogue

| Trigger ID | Fires when…                                                          | Prompt function |
|------------|----------------------------------------------------------------------|-----------------|
| `RUN_START` | first valid `/tick` after `/start`                                  | `prompt_run_start` |
| `NEW_KM`    | `floor(done_km)` just increased                                     | `prompt_new_km` |
| `PACE_SLOW` | `pace_gap > 0.20 min/km`                                            | `prompt_pace_slow` |
| `RUN_END`   | `remain_km ≤ 0.02` **and** `next_change_km ≤ 0.02` (≈ 20 m)          | `prompt_run_end` |

Each trigger is flagged internally to prevent duplicate firings.

---

## Tick pipeline (0.3 s end-to-end on M2 CPU)

1. **Receive** `/tick` JSON from the client.  
2. **Round** floats → 4 SF.  
3. `RunHistoryBuilder.add_sample()` stores distance, pace, HR.  
4. **Evaluate** triggers in the order above.  
5. If a trigger fires → build prompt → call `ask_ollama()` → return `{status, message}` and log.  
6. Otherwise → return `{"status": "logged"}`.

---

## Local setup (macOS/Linux)

```bash
git clone https://github.com/<you>/realtime-running-coach.git
cd realtime-running-coach

python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

brew install ollama            # or follow Linux instructions
ollama pull llama2:7b          # or any chat-

