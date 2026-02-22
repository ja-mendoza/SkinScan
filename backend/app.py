from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import io
import csv

import numpy as np
import tensorflow as tf
from PIL import Image

# ============================================================
# FASTAPI INITIALIZATION
# ============================================================

app = FastAPI(title="SkinScan API - ResNet50")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# CONFIG
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "best_resnet50.keras"
DATASET_META = BASE_DIR / "metadata.csv"

IMG_SIZE = 224
THRESHOLD = 0.5  # Change if you later optimize threshold

NEG_LABEL = "benign"
POS_LABEL = "malignant"

# ============================================================
# LOAD MODEL
# ============================================================

if not MODEL_PATH.exists():
    raise RuntimeError(f"Model not found: {MODEL_PATH}")

model = tf.keras.models.load_model(MODEL_PATH, compile=False)

# Import correct preprocessing for ResNet
from tensorflow.keras.applications.resnet import preprocess_input


# ============================================================
# IMAGE PREPROCESSING (MATCHES TRAINING)
# ============================================================

def preprocess_image(image_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE))

    x = np.array(img, dtype=np.float32)
    x = np.expand_dims(x, axis=0)

    # IMPORTANT: Must match training
    x = preprocess_input(x)

    return x


# ============================================================
# PREDICTION
# ============================================================

def predict_score(x: np.ndarray) -> float:
    y = model.predict(x, verbose=0)

    if isinstance(y, (list, tuple)):
        y = y[0]

    y = np.array(y)

    if y.shape == (1, 1):
        return float(y[0, 0])

    if y.shape == (1,):
        return float(y[0])

    y = y.reshape(-1)
    if y.size < 1:
        raise ValueError("Model returned empty output")

    return float(y[0])


def score_to_label(score: float):
    s = float(score)

    label = POS_LABEL if s >= THRESHOLD else NEG_LABEL
    confidence = s if s >= THRESHOLD else 1.0 - s

    risk_level = (
        "High" if s >= 0.75
        else "Moderate" if s >= THRESHOLD
        else "Low"
    )

    return label, s, confidence, risk_level


# ============================================================
# OPTIONAL: GROUND TRUTH LOOKUP
# ============================================================

def get_truth(isic_id: str):
    if not DATASET_META.exists():
        return None

    with open(DATASET_META, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("isic_id") == isic_id:
                return (
                    row.get("diagnosis_1")
                    or row.get("diagnosis")
                    or row.get("diagnosis_2")
                )
    return None


# ============================================================
# ROUTES
# ============================================================

@app.get("/")
def root():
    return {
        "message": "SkinScan API is running",
        "docs": "/docs",
        "health": "/health"
    }
    
@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_PATH.name,
        "threshold": THRESHOLD,
        "preprocessing": "resnet_preprocess_input",
        "img_size": IMG_SIZE,
    }


@app.get("/truth")
def truth(isic_id: str = Query(...)):
    t = get_truth(isic_id)
    if t is None:
        return {"error": "id not found or metadata missing"}
    return {"isic_id": isic_id, "truth": t}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if file is None:
        raise HTTPException(status_code=400, detail="No file uploaded")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        x = preprocess_image(contents)
        raw_score = predict_score(x)
        label, prob_malignant, confidence, risk_level = score_to_label(raw_score)

        return {
            "prediction": label,
            "probability_malignant": round(prob_malignant, 4),
            "confidence": round(confidence, 4),
            "risk_level": risk_level,
            "model": MODEL_PATH.name,
            "threshold": THRESHOLD,
            "disclaimer": "This AI system is for research purposes only and not a substitute for professional medical diagnosis."
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))