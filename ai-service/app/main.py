"""LocalScore AI microservice — FastAPI app exposing prediction + LLM endpoints.

Isolated from the core backend so the heavy ML/LLM dependency tree never
destabilises live scoring. The backend calls these over HTTP and caches results.
"""
from __future__ import annotations

from fastapi import FastAPI

from app.config import settings
from app.models import best_player, win_probability
from app.schemas import (
    BestPlayerRequest,
    BestPlayerResponse,
    CommentaryRequest,
    CommentaryResponse,
    PlayerInsightRequest,
    PlayerInsightResponse,
    PredictionRequest,
    SummaryRequest,
    SummaryResponse,
    WinProbability,
)
from app.services import commentary, insights, summary
from app.services.llm import llm_available

app = FastAPI(
    title=settings.SERVICE_NAME,
    version="0.1.0",
    description="Predictions, performance indices, commentary, and insights for LocalScore.",
)


@app.get("/health", tags=["meta"])
async def health() -> dict:
    return {"status": "ok", "service": settings.SERVICE_NAME, "llm": llm_available()}


@app.post("/predict/win-probability", response_model=WinProbability, tags=["predict"])
async def win_prob(req: PredictionRequest) -> WinProbability:
    return win_probability.predict(req.live_score)


@app.post("/predict/best-player", response_model=BestPlayerResponse, tags=["predict"])
async def best(req: BestPlayerRequest) -> BestPlayerResponse:
    return best_player.rank(req)


@app.post("/commentary", response_model=CommentaryResponse, tags=["llm"])
async def make_commentary(req: CommentaryRequest) -> CommentaryResponse:
    return commentary.generate(req)


@app.post("/summary", response_model=SummaryResponse, tags=["llm"])
async def make_summary(req: SummaryRequest) -> SummaryResponse:
    return summary.generate(req)


@app.post("/insights/player", response_model=PlayerInsightResponse, tags=["insights"])
async def player_insights(req: PlayerInsightRequest) -> PlayerInsightResponse:
    return insights.generate(req)
