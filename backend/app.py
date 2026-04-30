from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from backend.database import conn, cursor
import io
import csv
import base64
import os
import requests
import numpy as np
import tensorflow as tf
import cv2

from PIL import Image
from tensorflow.keras.applications.resnet import preprocess_input

# ============================================================
# FASTAPI INITIALIZATION
# ============================================================

app = FastAPI(title="SkinScan API - Binary + Multiclass + GradCAM")

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
MODEL_PATH = BASE_DIR / "models" / "resnet50.keras"
MODEL_URL = "https://www.dropbox.com/scl/fi/x3chlk40drznm2ycdfcqm/resnet50.keras?rlkey=zkk49fga1h0d8u5lkoi81mwza&st=w5smw2pf&dl=1"

import os
import requests

def download_model():
    os.makedirs(MODEL_PATH.parent, exist_ok=True)

    # Delete bad file if exists
    if MODEL_PATH.exists():
        size = os.path.getsize(MODEL_PATH)
        print("Existing model size:", size)

        if size < 100_000_000:
            print("Corrupted model detected. Deleting...")
            os.remove(MODEL_PATH)

    if not MODEL_PATH.exists():
        print("Downloading model...")

        with requests.get(MODEL_URL, stream=True) as r:
            with open(MODEL_PATH, "wb") as f:
                for chunk in r.iter_content(8192):
                    if chunk:
                        f.write(chunk)

        print("Download complete.")
        print("Final model size:", os.path.getsize(MODEL_PATH))

from tensorflow.keras.models import load_model

DATASET_META = BASE_DIR / "metadata.csv"

IMG_SIZE = 224
THRESHOLD = 0.5

# 11 multiclass labels
# CHANGE THIS ORDER to your exact training order
CLASS_NAMES = [
    "Actinic Keratosis",
    "Basal Cell Carcinoma",
    "Basal cell carcinoma",
    "Dermatofibroma",
    "Melanoma",
    "Melanoma, NOS",
    "Nevus",
    "Pigmented benign keratosis",
    "Solar or actinic keratosis",
    "Squamous Cell Carcinoma",
    "Squamous cell carcinoma, NOS"
]

CLASS_DESCRIPTIONS = {
    "Actinic Keratosis": "Actinic Keratosis",
    "Basal Cell Carcinoma": "Basal Cell Carcinoma",
    "Basal cell carcinoma": "Basal Cell Carcinoma",
    "Dermatofibroma": "Dermatofibroma",
    "Melanoma": "Melanoma",
    "Melanoma, NOS": "Melanoma",
    "Nevus": "Nevus",
    "Pigmented benign keratosis": "Pigmented Benign Keratosis",
    "Solar or actinic keratosis": "Solar / Actinic Keratosis",
    "Squamous Cell Carcinoma": "Squamous Cell Carcinoma",
    "Squamous cell carcinoma, NOS": "Squamous Cell Carcinoma"
}

LAST_CONV_LAYER = "conv5_block3_out"

# ============================================================
# LOAD MODEL
# ============================================================

if not MODEL_PATH.exists():
    raise RuntimeError(f"Model not found: {MODEL_PATH}")

model = tf.keras.models.load_model(MODEL_PATH, compile=False)

# ============================================================
# PREPROCESS
# ============================================================

def preprocess_image(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE))

    original = np.array(img, dtype=np.uint8)

    x = original.astype(np.float32)
    x = np.expand_dims(x, axis=0)
    x = preprocess_input(x)

    return x, original

# ============================================================
# PREDICTION
# ============================================================

def predict_outputs(x):
    preds = model.predict(x, verbose=0)

    binary_pred = np.array(preds[0]).reshape(-1)[0]
    class_pred = np.array(preds[1]).reshape(-1)

    return float(binary_pred), class_pred


def binary_result(score):
    label = "malignant" if score >= THRESHOLD else "benign"
    confidence = score if score >= THRESHOLD else (1 - score)

    risk = (
        "High" if score >= 0.75
        else "Moderate" if score >= THRESHOLD
        else "Low"
    )

    return label, confidence, risk


def class_result(class_scores):
    idx = int(np.argmax(class_scores))
    code = CLASS_NAMES[idx]
    label = CLASS_DESCRIPTIONS.get(code, code)
    conf = float(class_scores[idx])

    return idx, code, label, conf


def top_classes(class_scores, top_k=3):
    indices = np.argsort(class_scores)[::-1][:top_k]

    result = []
    for i in indices:
        code = CLASS_NAMES[i]
        result.append({
            "code": code,
            "label": CLASS_DESCRIPTIONS.get(code, code),
            "confidence": round(float(class_scores[i]), 4)
        })

    return result

# ============================================================
# GRAD-CAM
# ============================================================

def make_gradcam_heatmap(img_array):
    """
    Reliable Grad-CAM for nested ResNet50 multi-output model
    Uses final conv layer directly.
    """

    base_model = model.get_layer("resnet50")
    last_conv_layer = base_model.get_layer("conv5_block3_out")

    # Feature extractor
    conv_model = tf.keras.models.Model(
        inputs=base_model.input,
        outputs=last_conv_layer.output
    )

    # Build classifier head from conv features
    classifier_input = tf.keras.Input(shape=(7, 7, 2048))

    x = classifier_input
    x = model.get_layer("global_average_pooling2d_1")(x)
    x = model.get_layer("dropout_1")(x)
    class_output = model.get_layer("class_output")(x)

    classifier_model = tf.keras.models.Model(
        classifier_input,
        class_output
    )

    with tf.GradientTape() as tape:
        conv_outputs = conv_model(img_array)
        tape.watch(conv_outputs)

        preds = classifier_model(conv_outputs)
        pred_index = tf.argmax(preds[0])
        loss = preds[:, pred_index]

    grads = tape.gradient(loss, conv_outputs)

    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    conv_outputs = conv_outputs[0]

    heatmap = tf.reduce_sum(conv_outputs * pooled_grads, axis=-1)
    heatmap = np.maximum(heatmap, 0)
    heatmap = heatmap / (np.max(heatmap) + 1e-8)

    return heatmap


def overlay_heatmap(original_img, heatmap):
    """
    Properly aligned overlay
    original_img = RGB 224x224
    """

    heatmap = cv2.resize(heatmap, (224, 224))
    heatmap = np.uint8(255 * heatmap)

    heatmap = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)
    heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)

    overlay = cv2.addWeighted(original_img, 0.65, heatmap, 0.35, 0)

    _, buffer = cv2.imencode(
        ".jpg",
        cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR)
    )

    return base64.b64encode(buffer).decode("utf-8")
# ============================================================
# OPTIONAL GROUND TRUTH
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
        "message": "SkinScan API Running",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_PATH.name,
        "binary_output": "binary_output",
        "class_output": "class_output",
        "img_size": IMG_SIZE
    }

@app.get("/truth")
def truth(isic_id: str = Query(...)):
    t = get_truth(isic_id)

    if t is None:
        return {"error": "id not found"}

    return {
        "isic_id": isic_id,
        "truth": t
    }

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if file is None:
        raise HTTPException(status_code=400, detail="No file uploaded")

    contents = await file.read()

    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        x, original_img = preprocess_image(contents)

        binary_score, class_scores = predict_outputs(x)

        binary_label, binary_conf, risk = binary_result(binary_score)

        idx, class_code, class_label, class_conf = class_result(class_scores)

        heatmap = make_gradcam_heatmap(x)
        gradcam_img = overlay_heatmap(original_img, heatmap)
        
        # Save to database
        cursor.execute("""
        INSERT INTO scans (image_name, prediction, lesion_type, confidence)
        VALUES (?, ?, ?, ?)
        """, (
            file.filename,
            binary_label,
            class_label,
            float(binary_conf)
        ))

        conn.commit()

        return {
            "prediction": binary_label,
            "probability_malignant": round(binary_score, 4),
            "confidence": round(binary_conf, 4),
            "risk_level": risk,

            "lesion_code": class_code,
            "lesion_type": class_label,
            "lesion_confidence": round(class_conf, 4),

            "top_predictions": top_classes(class_scores, 3),

            "gradcam": gradcam_img,

            "model": MODEL_PATH.name,
            "disclaimer": "This AI system is for research purposes only and not a substitute for professional medical diagnosis."
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/history")
def get_history(limit: int = 20):
    cursor.execute("""
        SELECT id, image_name, prediction, lesion_type, confidence, created_at
        FROM scans
        ORDER BY created_at DESC
        LIMIT ?
    """, (limit,))

    rows = cursor.fetchall()

    results = []
    for r in rows:
        results.append({
            "id": r[0],
            "image_name": r[1],
            "prediction": r[2],
            "lesion_type": r[3],
            "confidence": r[4],
            "created_at": r[5]
        })

    return {"history": results}