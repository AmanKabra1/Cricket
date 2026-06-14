"""In-process AI engine (merged from the former standalone ai-service).

Win-probability + projected score, best-player index, commentary, match summary
and player insights — all run inside the backend now, so there's no separate AI
service to host. LLM features (Gemini/OpenAI) activate only when a key is set;
otherwise transparent heuristics/templates are used.
"""
