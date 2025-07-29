# Real-Time Running Coach – Technical README
This project delivers a **fully-local personal running coach**.  
It listens to a live stream of running metrics (distance, pace, heart-rate, etc.), maintains an in-memory model of the session and, when appropriate, asks a Large Language Model—served on-device by **Ollama**—to write a coaching message that is returned to the runner within a second.

Unlike conventional running apps that replay canned sentences or upload data to the cloud, all computation (API, statistics, rule engine, LLM inference) stays on the runner’s computer.  No external network traffic means low latency and zero privacy concerns.

---

## 1  Conceptual Flow
1. **Sampling** – the client (mobile or web) posts a JSON “tick” every second or every few metres.  
2. **State update** – `RunHistoryBuilder` records the sample, updates pace averages, heart-rate trends and opens / closes kilometre splits.  
3. **Rule evaluation** – a trigger engine decides whether the current situation calls for a message: the very first tick creates a *start briefing*; every whole kilometre spawns a *split feedback*; a sustained pace drop raises a *slow-down alert*; the last metres conclude the run and request a *final summary*.  
4. **Prompt building** – numeric values are rounded (four significant digits) and injected into a prompt template that also describes the coach’s persona and the expected style of answer.  
5. **LLM call** – the prompt is sent to the model chosen in Ollama (default: `llama2:7b-chat` in int4).  The backend waits for the short completion—usually a handful of sentences—and receives the text.  
6. **Return** – the advice is logged for traceability and delivered to the front-end, where it can be rendered on screen or spoken aloud.

Everything above happens in ~300 ms on an Apple M2 CPU; a mid-range laptop easily keeps up.

---

## 2  Execution Environment
* **FastAPI** exposes four REST routes:  
  `/start`, `/tick`, `/coach` (manual prompt) and `/end`.  
  WebSockets can be enabled but the reference implementation sticks to HTTP polling for clarity.
* **Ollama** is launched separately (`ollama serve`) and listens on `localhost:11434`.  The backend never blocks the event loop: it awaits the HTTP call and frees Uvicorn workers immediately after the response arrives.
* A small **React + MapLibre** front-end (folder `frontend/`) shows the path on a map and prints each message in a scrolling timeline.  It is optional; `curl` is enough to exercise the API.

---

## 3  Core Objects
### 3.1  Incoming frame
```python
class CoachIn(BaseModel):
    done_km: float          # total distance so far
    remain_km: float        # distance left to goal
    pace_now: float         # current instantaneous pace (min/km)
    next_change_km: float   # metres until next planned pace change
    pace_obj: float         # target pace from the training plan
    pace_avg: float         # average pace since start
    pace_gap: float         # pace_now − pace_obj (signed)
    time_next_change_min: float
    heart_rate: int | None
    time_run_min: float
    eta_gap_min: float      # real ETA − theoretical ETA
    pace_cv: float          # coefficient of variation on pace

### 3.3 Prompt factory

Every trigger in `optionA/triggers/prompts.py` builds its prompt by concatenating:

1. **SYSTEM_ROLE** (constant `_RUNBUDDY`)  
2. **Header** (e.g. `=== Pace Alert ===`)  
3. **Core data block** (`build_prompt(**data)` with floats rounded to 4 SF)  
4. **Instruction** (specific to the trigger)

Example — *pace drop*:

```python
def prompt_pace_slow(data: dict, *_):
    header = "=== Pace Alert ===\n"
    core   = build_prompt(**data)
    instr  = (
        "\nGive one punchy tip (1–2 sentences max) to bring pace back to target."
    )
    return _RUNBUDDY + header + core + instr
```

- `prompt_run_start`   → start briefing  
- `prompt_new_km`      → per-kilometre feedback  
- `prompt_pace_slow`   → slow-down alert  
- `prompt_run_end`     → final summary  

---

## 4  Rule → Prompt → LLM → Reply (walk-through)

**Scenario:** runner hits 5 km but slows from 4:30 → 4:55 min/km.

1. **Rule**  
   - `pace_too_slow(data)` returns `True` (pace_gap = +0.25 > 0.20)  
2. **Prompt**  
   ```text
   === Pace Alert ===
   Distance run         : 5.00 km
   Current pace         : 4.55 min/km
   Target pace          : 4.30 min/km
   Heart rate           : 172 bpm

   Give one punchy tip to bring pace back to target.

### 3.3  Prompt factory

Built-in factories (in `optionA/triggers/prompts.py`):

- `prompt_run_start`   → start briefing  
- `prompt_new_km`      → per-kilometre feedback  
- `prompt_pace_slow`   → slow-down alert  
- `prompt_run_end`     → final summary  

---

### 3.4  LLM call

Submit the assembled prompt to Ollama:

```python
response = ask_ollama(
    prompt,
    model="llama2:7b-chat",
    temperature=0.4,
)
```

- **Returns**: a short text completion (usually 1–4 sentences)  
- **Logged**: `[timestamp, TRIGGER_ID, prompt, response]`  
- **Latency**: ~200–300 ms on M2 CPU  