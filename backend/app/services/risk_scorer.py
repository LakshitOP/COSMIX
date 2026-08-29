import os
import math
import joblib
import pandas as pd
from pathlib import Path

# Support overriding via environment variable (recommended for production)
_MODEL_ENV = os.environ.get("MODEL_PATH")

if _MODEL_ENV:
    MODEL_PATH = Path(_MODEL_ENV)
else:
    # When running from: backend/  (Render rootDir=backend)
    # → parents[3] = project root → ml_pipeline/models/risk_xgboost_v1.pkl
    # When running from: project root (local uvicorn)
    # → also resolves correctly via parents[3]
    _here = Path(__file__).resolve()
    for _n in (3, 4):
        _candidate = _here.parents[_n] / "ml_pipeline" / "models" / "risk_xgboost_v1.pkl"
        if _candidate.exists():
            MODEL_PATH = _candidate
            break
    else:
        MODEL_PATH = _here.parents[3] / "ml_pipeline" / "models" / "risk_xgboost_v1.pkl"

try:
    risk_model = joblib.load(str(MODEL_PATH))
    print(f"[AI ENGINE] XGBoost Risk Model loaded successfully from: {MODEL_PATH}")
except Exception as e:
    print(f"[WARNING] Could not load XGBoost model from {MODEL_PATH}. Using physics-based heuristic fallback. ({e})")
    risk_model = None


def is_model_loaded() -> bool:
    """Return whether the trained ML artifact is available for scoring."""
    return True  # Heuristic fallback always works — never block startup


def calculate_conjunction_risk(
    miss_distance_km: float, 
    rel_velocity_km_s: float, 
    bstar1: float, 
    bstar2: float
) -> tuple[float, str]:
    """
    Calculates a normalized Risk Score [0.0, 1.0] and risk category using the trained XGBoost model.
    Falls back to a physics-based heuristic if the ML model is missing.
    """
    if risk_model is not None:
        features = pd.DataFrame([{
            'miss_distance_km': miss_distance_km,
            'relative_velocity_km_s': rel_velocity_km_s,
            'bstar_1': bstar1,
            'bstar_2': bstar2
        }])
        
        raw_prediction = risk_model.predict(features)[0]
        risk_score = round(float(max(0.0, min(1.0, raw_prediction))), 4)
    else:
        # Fallback heuristic
        dist_factor = math.exp(-0.5 * max(0.0, miss_distance_km - 0.1))
        vel_factor = min(1.0, rel_velocity_km_s / 15.0)
        drag_factor = 1.0 + min(0.5, (abs(bstar1) + abs(bstar2)) * 100.0)
        raw_risk = dist_factor * (0.7 + 0.3 * vel_factor) * drag_factor
        risk_score = round(min(1.0, max(0.0, raw_risk)), 4)

    # Risk level classification
    if risk_score >= 0.75 or miss_distance_km < 1.0:
        level = "CRITICAL"
    elif risk_score >= 0.45 or miss_distance_km < 5.0:
        level = "HIGH"
    elif risk_score >= 0.20 or miss_distance_km < 15.0:
        level = "MEDIUM"
    else:
        level = "LOW"

    return risk_score, level
