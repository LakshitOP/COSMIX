# ORBITAL (COSMIX) — Space Situational Awareness & Conjunction Risk Platform

**ORBITAL** is an open-source Space Situational Awareness (SSA) dashboard and predictive risk platform designed to track space debris and active satellites in Low Earth Orbit (LEO) using live two-line element (TLE/2LE) telemetry from CelesTrak.

By propagating orbital state vectors with the **SGP4 astrodynamics engine**, screening orbital intersections with a **Time of Closest Approach (TCA) numerical solver**, and assessing encounter severity via an **XGBoost machine learning risk model**, ORBITAL democratizes space traffic management for researchers, operators, and students.

---

## Repository Architecture

```
COSMIX/
├── backend/                  # FastAPI backend & SGP4 astrodynamics service
│   ├── app/
│   │   ├── api/              # REST endpoints & WebSocket streaming
│   │   │   ├── routes.py     # Satellite query, conjunctions, orbit tracks
│   │   │   └── websockets.py # Live 10Hz telemetry push stream
│   │   ├── core/             # Astrodynamics & numerical engines
│   │   │   ├── sgp4_engine.py# High-precision orbit propagation
│   │   │   ├── tca_solver.py # Time of Closest Approach numerical solver
│   │   │   └── filters.py    # Altitude and orbital geometry screening
│   │   ├── data/             # TLE ingestion & parser
│   │   │   ├── fetch_tles.py # CelesTrak live sync & local caching
│   │   │   └── parser.py     # 2LE/3LE format parser
│   │   ├── models/           # Pydantic schemas & SQLAlchemy models
│   │   ├── services/         # Business logic & repository services
│   │   │   └── risk_scorer.py# XGBoost ML risk evaluation & heuristic fallback
│   │   ├── database.py       # Dual SQLite (dev) / PostgreSQL (prod) connection
│   │   └── main.py           # Application entry point & background auto-refresh
│   ├── requirements.txt      # Python backend dependencies
│   └── space_debris.db       # Local SQLite development database
│
├── database/                 # Database initialization & migrations
│   ├── init_db.sql           # Schema definition (satellites, conjunctions, tracked)
│   └── migrations/           # Incremental schema evolution scripts
│
├── frontend/                 # Static web dashboard & visualization UI
│   ├── HOME/                 # Landing page, Three.js 3D earth, authentication
│   │   ├── index.html
│   │   ├── css/style.css
│   │   ├── js/ (auth.js, firebase-config.js, main.js)
│   │   └── images/           # Core crew avatars
│   ├── Explore/              # 3D interactive satellite explorer & CesiumJS map
│   │   ├── explore.html
│   │   └── styles.css
│   ├── MONITOR/              # Real-time conjunction alert stream & collision matrix
│   │   └── montior.html
│   ├── Analytics/            # Orbital statistics, congestion charts & metrics
│   │   └── analytics.html
│   └── assets/               # Shared stylesheets and UI resources
│
└── ml_pipeline/              # Machine learning collision risk pipeline
    ├── datasets/             # Real & synthetic Conjunction Data Messages (CDMs)
    │   ├── real_cdms.csv
    │   └── raw_tles/         # Cached orbital element sets
    ├── models/
    │   └── risk_xgboost_v1.pkl # Trained XGBoost regression artifact
    ├── notebooks/            # Jupyter research notebooks (data prep, training)
    ├── src/                  # Pipeline execution scripts
    │   ├── generate_data.py  # CelesTrak conjunction encounter dataset builder
    │   ├── train_model.py    # Model fitting & artifact export
    │   └── evaluate.py       # Performance evaluation & feature importances
    └── requirements.txt      # ML pipeline dependencies
```

---

## Quick Start

### 1. Backend Service (FastAPI)

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`:
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **Health & Catalog Status**: `http://localhost:8000/api/health`
- **WebSocket Stream**: `ws://localhost:8000/ws/stream`

---

### 2. Frontend Web Dashboard

The frontend consists of modern, vanilla HTML5, CSS3, and JavaScript with WebGL/Three.js and CesiumJS visualizations.

You can serve the `frontend/` directory using any static file server:

```bash
# Example using Python's built-in HTTP server:
cd frontend
python3 -m http.server 3000

# Then open in your browser:
# Landing Page: http://localhost:3000/HOME/index.html
# 3D Explorer:  http://localhost:3000/Explore/explore.html
# Monitor:      http://localhost:3000/MONITOR/montior.html
# Analytics:    http://localhost:3000/Analytics/analytics.html
```

---

### 3. ML Risk Model Pipeline

To inspect or retrain the conjunction risk evaluation model:

```bash
cd ml_pipeline

# Evaluate the current trained model
python3 src/evaluate.py

# (Optional) Re-generate conjunction encounters from live TLEs
python3 src/generate_data.py

# (Optional) Re-train the XGBoost regression model
python3 src/train_model.py
```

---

### 4. Running Automated Tests

Run the full test suite (database partitioning, log services, ML integration, and SGP4/TCA solver performance):

```bash
python3 -m unittest discover -s tests -v
```

---

## Database Configuration

By default, the backend automatically creates and utilizes a local SQLite database at `backend/space_debris.db` with WAL mode enabled.

For PostgreSQL in production:
```bash
export DATABASE_URL="postgresql+psycopg://user:password@hostname:5432/space_debris"
```
You can initialize the tables using `database/init_db.sql`.

---

## Core Technologies
- **Astrodynamics**: `sgp4`, `skyfield`, CelesTrak GP API
- **Machine Learning**: `xgboost`, `scikit-learn`, `pandas`, `joblib`
- **Backend API**: `FastAPI`, `uvicorn`, `websockets`, `SQLAlchemy`
- **Frontend / 3D**: `Three.js`, `CesiumJS`, `Firebase Auth`
