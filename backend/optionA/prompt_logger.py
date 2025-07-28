# backend/optionA/prompt_logger.py
import json, datetime
from pathlib import Path

_LOG = Path(__file__).resolve().parent / "logs" / "prompt_history.json"
_LOG.parent.mkdir(exist_ok=True)

def reset() -> None:
    _LOG.write_text("[]", encoding="utf8")

def _split_lines(txt: str) -> list[str]:
    return [line.rstrip() for line in txt.strip().splitlines()]

def log(title: str,
        prompt: str,          
        data:   dict,
        response: str | list[str],
        km_stat: dict | None = None) -> None:

    entry = {
        "ts"      : datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "title"   : title,
        "prompt"  : prompt,       
        "data"    : data,
        "km_stat" : km_stat,
        "response": response,
    }

    hist = json.loads(_LOG.read_text() or "[]")
    hist.append(entry)
    _LOG.write_text(json.dumps(hist, indent=2, ensure_ascii=False))