"""Ball commentary: LLM when available, templates otherwise."""
from __future__ import annotations

from app.ai.llm import complete
from app.ai.schemas import CommentaryRequest, CommentaryResponse


def _template(req: CommentaryRequest) -> str:
    if req.is_wicket:
        return f"OUT! {req.bowler} strikes — {req.striker} has to go."
    if req.extra_type == "WIDE":
        return f"{req.bowler} strays down the leg side, called wide."
    if req.extra_type == "NO_BALL":
        return f"No ball! Extra pressure on {req.bowler}, free hit coming."
    if req.runs == 6:
        return f"SIX! {req.striker} launches {req.bowler} into the stands."
    if req.runs == 4:
        return f"FOUR! Crisp shot from {req.striker}, races to the boundary."
    if req.runs == 0:
        return f"Dot ball. {req.bowler} keeps {req.striker} quiet."
    return f"{req.runs} run{'s' if req.runs != 1 else ''} taken by {req.striker}."


def generate(req: CommentaryRequest) -> CommentaryResponse:
    prompt = (
        "Write a single vivid one-sentence cricket commentary line. "
        f"Over {req.over}.{req.ball}. Striker: {req.striker}. Bowler: {req.bowler}. "
        f"Runs off bat: {req.runs}. Extra: {req.extra_type}. "
        f"Wicket: {'yes' if req.is_wicket else 'no'}. Keep it under 20 words."
    )
    text = complete(prompt)
    if text:
        return CommentaryResponse(text=text, source="llm")
    return CommentaryResponse(text=_template(req), source="template")
