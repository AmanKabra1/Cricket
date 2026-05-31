# AI Module Architecture — LocalScore

The AI capabilities live in a **separate Python microservice** (`ai-service/`),
not in the core backend. Rationale:

- **Dependency isolation** — XGBoost, LightGBM, LangChain, and the OpenAI SDK are
  heavy and release on their own cadence. Keeping them out of the scoring API
  means a bad ML dependency can never take down live scoring.
- **Independent scaling** — prediction/LLM calls are bursty and latency-tolerant;
  they scale on their own signal (queue depth) and can scale to zero when no
  matches are live.
- **Graceful degradation** — the backend calls the AI service over HTTP with a
  short timeout and caches results. If the service is down or slow, AI tabs show
  "warming up" and the rest of the platform is unaffected (see
  `backend/app/api/v1/public.py::ai_prediction`).

```
 backend  ──HTTP──▶  ai-service (FastAPI :8100)
 (caches)            ├─ /predict/win-probability   model | heuristic
                     ├─ /predict/best-player        performance index
                     ├─ /commentary                 LLM | template
                     ├─ /summary                    LLM | template
                     └─ /insights/player            form + strengths/weaknesses
                            │
                            ├─ app/features.py     state → features (stdlib only)
                            ├─ app/models/*        predictors (heuristic + joblib)
                            ├─ app/services/llm.py LangChain+OpenAI (optional)
                            └─ train/*             XGBoost/LightGBM pipeline
```

## Two-tier predictor pattern

Every model ships a **heuristic** that works on day one and a **slot for a
trained model** that overrides it once data exists — same API, no client change.

```
predict(state):
    if models/<name>.joblib exists:  use trained model (XGBoost/LightGBM)
    else:                            use transparent cricket heuristic
```

### Win probability & projected score
- Features: chase flag, runs, wickets, balls bowled/left, wickets in hand, CRR,
  RRR, runs needed (`app/features.py`).
- Heuristic: logistic blend of run-rate cushion (CRR−RRR), wickets in hand, and
  the difficulty of the remaining ask; first-innings projects a final score from
  current rate dampened by wickets lost.
- Trained path: `train/train_win_probability.py` builds a labelled dataset
  (in-progress state → eventual result), trains XGBoost (→ LightGBM → sklearn
  fallback), and persists `models/win_probability.joblib`. Until real historical
  data is wired in, it synthesises a dataset so the full train→serve loop is
  runnable.

### Best-player performance index
Transparent weighted score over batting (runs + SR bonus), bowling (wickets +
economy bonus), and fielding (catches). Documented weights; swappable for a
learned "player of the match" classifier later.

### Smart commentary & match summary
`app/services/llm.py` wraps LangChain + OpenAI and is **fully optional**: with no
`OPENAI_API_KEY`, commentary and summaries fall back to deterministic templates,
so the feature degrades to readable text rather than failing.

### Player insights
Form classification (hot/steady/cold) + strengths/weaknesses from recent scores,
strike rates, and wickets, with a recency-weighted form index.

## Roadmap to production models
1. Add a backend job exporting completed matches' ball-by-ball states + outcomes.
2. Point `train/` at that export instead of the synthetic generator.
3. Schedule retraining (e.g. nightly) writing new `*.joblib` artifacts to shared
   storage; the service hot-loads them on next request.
4. Add model versioning + offline eval (AUC/Brier) gates before promotion.
