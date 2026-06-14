"""Match summary generation (LLM-optional)."""
from __future__ import annotations

from app.ai.llm import complete
from app.ai.schemas import SummaryRequest, SummaryResponse


def _innings_line(state) -> str:
    return f"{state.runs}/{state.wickets} ({state.overs} ov)"


def _template(req: SummaryRequest) -> tuple[str, list[str]]:
    parts = [f"{req.team_a} took on {req.team_b}."]
    for inn in req.innings:
        side = req.team_a if inn.innings_number == 1 else req.team_b
        parts.append(f"{side} posted {_innings_line(inn)}.")
    if req.result_text:
        parts.append(req.result_text + ".")
    moments = []
    if req.top_performers:
        top = req.top_performers[0]
        if top.runs >= top.wickets * 20:
            moments.append(f"{top.name} top-scored with {top.runs} ({top.balls_faced} balls).")
        else:
            moments.append(f"{top.name} starred with the ball, taking {top.wickets} wickets.")
    return " ".join(parts), moments


def generate(req: SummaryRequest) -> SummaryResponse:
    innings_desc = "; ".join(
        f"Innings {i.innings_number}: {_innings_line(i)}" for i in req.innings
    )
    performers = ", ".join(
        f"{p.name} {p.runs}({p.balls_faced}) / {p.wickets}w" for p in req.top_performers[:3]
    )
    prompt = (
        "Write a concise 3-4 sentence local cricket match report. "
        f"{req.team_a} vs {req.team_b}. {innings_desc}. "
        f"Result: {req.result_text or 'in progress'}. Top performers: {performers}. "
        "Neutral, energetic tone."
    )
    text = complete(prompt)
    if text:
        moments = [m.strip() for m in text.split(".") if "wicket" in m.lower() or "fifty" in m.lower()][:3]
        return SummaryResponse(summary=text, key_moments=moments, source="llm")
    summary, moments = _template(req)
    return SummaryResponse(summary=summary, key_moments=moments, source="template")
