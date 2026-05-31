# LocalScore — AI Service

Python FastAPI microservice for predictions, performance indices, commentary,
match summaries, and player insights. See [../docs/AI_MODULE.md](../docs/AI_MODULE.md)
for the architecture.

## Run (local, no Docker)
```bash
cd ai-service
python -m venv .venv && .venv\Scripts\Activate.ps1   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8100
# → http://localhost:8100/docs
```

Works with **zero configuration**: predictions use cricket heuristics and
commentary uses templates. Set `OPENAI_API_KEY` to enable LLM text.

## Endpoints
| Method | Path                          | Purpose |
|--------|-------------------------------|---------|
| GET    | `/health`                     | Status + whether LLM is enabled |
| POST   | `/predict/win-probability`    | Win prob both sides + projected score + key moments |
| POST   | `/predict/best-player`        | Performance-index ranking |
| POST   | `/commentary`                 | One-line ball commentary (LLM/template) |
| POST   | `/summary`                    | Match report (LLM/template) |
| POST   | `/insights/player`            | Form + strengths/weaknesses |

## Train the win-probability model
```bash
python -m train.train_win_probability   # writes models/win_probability.joblib
```
The service auto-detects the artifact and switches from heuristic to the trained
model on the next request — no code or API change.

## Test
```bash
pytest -q   # heuristic-path tests; no ML libs or API key needed
```
