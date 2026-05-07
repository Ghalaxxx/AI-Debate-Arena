"""FastAPI entrypoint for AI Debate Arena."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.debate import router as debate_router
from api.ws import router as websocket_router
from config import SETTINGS

app = FastAPI(
    title="AI Debate Arena",
    description="Real-time LLM debate platform with live judging and audience voting.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=SETTINGS.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(debate_router, prefix="/api/debate", tags=["debate"])
app.include_router(websocket_router, tags=["websocket"])


@app.get("/health")
async def health() -> dict[str, str]:
    """Health probe used by local development and Docker."""

    return {"status": "ok"}
