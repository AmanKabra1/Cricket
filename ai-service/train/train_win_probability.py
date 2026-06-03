"""Training pipeline for the win-probability model.

This is the path that upgrades the live heuristic to a learned model. In
production you'd pull historical ball-by-ball data from the platform DB and
label each in-progress state with the eventual match result. Until that data
exists, this script SYNTHESISES a labelled dataset from the same heuristic so
the end-to-end pipeline (train → persist → serve) is runnable and verifiable.

Run (synthetic):  python -m train.train_win_probability
Run (real data):  TRAINING_DATA_FILE=data.json python -m train.train_win_probability
  where data.json is the backend export GET /api/v1/admin/ai/training-data.
Output:  models/win_probability.joblib  (auto-detected by app.models.win_probability)
"""
from __future__ import annotations

import json
import os
import random

FEATURES = [
    "is_chase", "runs", "wickets", "balls_bowled", "balls_left",
    "wickets_in_hand", "current_run_rate", "required_run_rate", "runs_needed",
]


def _load_real(path: str):
    """Load the backend export ({rows:[{feature..., label}]}) into (X, y)."""
    import numpy as np

    with open(path, encoding="utf-8") as fh:
        payload = json.load(fh)
    rows = payload.get("rows", payload) if isinstance(payload, dict) else payload
    X = [[float(r[k]) for k in FEATURES] for r in rows]
    y = [int(r["label"]) for r in rows]
    return np.array(X, dtype=float), np.array(y)


def _synthesise(n: int = 20000):
    """Generate (X, y) where y = batting side won (1) or not (0)."""
    import numpy as np

    rng = np.random.default_rng(42)
    X, y = [], []
    for _ in range(n):
        overs_limit = random.choice([10, 20, 50])
        total = overs_limit * 6
        balls_bowled = rng.integers(1, total)
        balls_left = total - balls_bowled
        wickets = rng.integers(0, 10)
        wih = 10 - wickets
        crr = max(0.5, rng.normal(7.5, 2.5))
        runs = int(crr * balls_bowled / 6)
        target = runs + int(rng.integers(5, 90))
        runs_needed = target - runs
        rrr = runs_needed / max(1, balls_left) * 6

        # Ground-truth-ish label: chase succeeds more often with cushion+wickets.
        prob = 1 / (1 + np.exp(-(1.2 * (crr - rrr) + 0.4 * (wih - 5) + rng.normal(0, 0.6))))
        won = 1 if rng.random() < prob else 0

        X.append([1.0, runs, wickets, balls_bowled, balls_left, wih, crr, rrr, runs_needed])
        y.append(won)
    return np.array(X, dtype=float), np.array(y)


def main() -> None:
    import joblib
    import numpy as np
    from sklearn.metrics import accuracy_score, roc_auc_score
    from sklearn.model_selection import train_test_split

    data_file = os.environ.get("TRAINING_DATA_FILE")
    if data_file and os.path.exists(data_file):
        Xr, yr = _load_real(data_file)
        print(f"Loaded {len(yr)} real labelled rows from {data_file}.")
        # Real local-cricket data is often sparse — augment with synthetic so the
        # model still generalises across game states.
        if len(yr) < 2000:
            Xs, ys = _synthesise()
            X = np.vstack([Xr, Xs]) if len(yr) else Xs
            y = np.concatenate([yr, ys]) if len(yr) else ys
            print(f"Augmented with synthetic → {len(y)} total rows.")
        else:
            X, y = Xr, yr
    else:
        print("No TRAINING_DATA_FILE — synthesising data (heuristic-labelled).")
        X, y = _synthesise()

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=1)

    # Prefer XGBoost; fall back to LightGBM, then sklearn.
    model = None
    try:
        from xgboost import XGBClassifier

        model = XGBClassifier(
            n_estimators=300, max_depth=5, learning_rate=0.05,
            subsample=0.9, eval_metric="logloss",
        )
        backend = "xgboost"
    except Exception:  # noqa: BLE001
        try:
            from lightgbm import LGBMClassifier

            model = LGBMClassifier(n_estimators=300, max_depth=5, learning_rate=0.05)
            backend = "lightgbm"
        except Exception:  # noqa: BLE001
            from sklearn.ensemble import GradientBoostingClassifier

            model = GradientBoostingClassifier()
            backend = "sklearn"

    print(f"Training {backend} model on {len(X_tr)} samples…")
    model.fit(X_tr, y_tr)

    preds = model.predict(X_te)
    proba = model.predict_proba(X_te)[:, 1]
    print(f"Accuracy: {accuracy_score(y_te, preds):.3f}  AUC: {roc_auc_score(y_te, proba):.3f}")

    os.makedirs("models", exist_ok=True)
    out = os.path.join("models", "win_probability.joblib")
    joblib.dump(model, out)
    print(f"Saved → {out}  (feature order: {FEATURES})")
    print("Restart the AI service; predictions will now use this model.")


if __name__ == "__main__":
    main()
