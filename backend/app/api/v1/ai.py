"""AI endpoints — win-probability, best player, commentary, summary, insights.

All run IN-PROCESS (app/ai); the former standalone ai-service is no longer
needed. Public/no-auth (compute only). The spectator win-probability is also
exposed at /public/matches/{id}/prediction (cached); these are the raw tools.
"""
from __future__ import annotations

from fastapi import APIRouter

from app.ai import best_player, commentary, insights, summary, win_probability
from app.ai.llm import llm_available
from app.ai.schemas import (
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

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/health")
async def ai_health() -> dict:
    return {"status": "ok", "llm": llm_available()}


@router.post("/win-probability", response_model=WinProbability)
async def ai_win_probability(req: PredictionRequest) -> WinProbability:
    return win_probability.predict(req.live_score)


@router.post("/best-player", response_model=BestPlayerResponse)
async def ai_best_player(req: BestPlayerRequest) -> BestPlayerResponse:
    return best_player.rank(req)


@router.post("/commentary", response_model=CommentaryResponse)
async def ai_commentary(req: CommentaryRequest) -> CommentaryResponse:
    return commentary.generate(req)


@router.post("/summary", response_model=SummaryResponse)
async def ai_summary(req: SummaryRequest) -> SummaryResponse:
    return summary.generate(req)


@router.post("/insights/player", response_model=PlayerInsightResponse)
async def ai_player_insights(req: PlayerInsightRequest) -> PlayerInsightResponse:
    return insights.generate(req)
