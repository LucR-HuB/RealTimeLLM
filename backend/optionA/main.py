from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from .ollama_wrapper import DATA, build_prompt, ask_ollama, get_route

app = FastAPI(title="Realtime LLM Coach – Option A")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class LLMRequest(BaseModel):
    index: int

@app.post("/status")
def status(req: LLMRequest):
    if not 0 <= req.index < len(DATA):
        return {"error": "index out of range"}
    row = DATA.iloc[req.index]
    prompt = build_prompt(row)
    message = ask_ollama(prompt)
    return {
        "km": round(row.Distance_done_m / 1000, 1),
        "message": message,
        "address": row.Address,
    }

@app.get("/route")
def route():
    """Renvoie la polyline complète pour le front."""
    return JSONResponse(get_route())