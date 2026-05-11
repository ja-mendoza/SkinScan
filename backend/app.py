from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from backend.database import save_scan, get_history
import io
import csv
import requests
import cv2
import numpy as np
import tensorflow as tf
import base64

from PIL import Image

from tensorflow.keras.applications.densenet import preprocess_input

app = FastAPI(title="SkinScan API - Binary + Multiclass + GradCAM")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all for deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# CONFIG
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "densenet121.keras"
DATASET_META = BASE_DIR / "metadata.csv"

IMG_SIZE = 224
THRESHOLD = 0.5

# MODEL_URL = "https://www.dropbox.com/scl/fi/e05cpuvf17z50p3jfetxw/resnet50.keras?rlkey=n5oc2uedsewuhocje4ay4q48q&st=e8eam6o3&dl=1"

CLASS_NAMES = [
    "Actinic Keratosis",
    "Basal Cell Carcinoma",
    "Dermatofibroma",
    "Melanoma",
    "Nevus",
    "Pigmented Benign Keratosis",
    "Solar / Actinic Keratosis",
    "Squamous Cell Carcinoma"
]

CLASS_DESCRIPTIONS = {

    "Actinic Keratosis":
        "Actinic Keratosis",
    "Basal Cell Carcinoma":
        "Basal Cell Carcinoma.",
    "Dermatofibroma":
        "Dermatofibroma.",
    "Melanoma":
        "Melanoma",
    "Nevus":
        "Nevus",
    "Pigmented Benign Keratosis":
        "Nevus",
    "Solar / Actinic Keratosis":
        " Actinic Keratosis",
    "Squamous Cell Carcinoma":
        "Squamous Cell Carcinoma"
}

def download_model():
    if MODEL_PATH.exists():
        print("Model already exists")
        return

    print("Downloading model...")
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)

    response = requests.get(MODEL_URL, stream=True)
    if response.status_code != 200:
        raise RuntimeError("Failed to download model")

    with open(MODEL_PATH, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)

    print("Model downloaded successfully")

download_model()

model = tf.keras.models.load_model(MODEL_PATH, compile=False)

FILTER_MODEL_PATH = BASE_DIR / "models" / "skin_filter_model.keras"

filter_model = tf.keras.models.load_model(
    FILTER_MODEL_PATH,
    compile=False
)

# PREPROCESS
def preprocess_image(image_bytes):

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    resized = img.resize((IMG_SIZE, IMG_SIZE))
    original = np.array(img, dtype=np.uint8)
    x = np.array(resized, dtype=np.float32)
    x = preprocess_input(x)
    x = np.expand_dims(x, axis=0)

    return x, original

# SKIN FILTER (ADD THIS SECTION)
def predict_skin_validity(image):

    resized = cv2.resize(image, (224, 224))
    x = resized.astype(np.float32) / 255.0
    x = np.expand_dims(x, axis=0)
    score = filter_model.predict(x, verbose=0)[0][0]

    return float(score)

def has_enough_skin(image):

    hsv = cv2.cvtColor(image, cv2.COLOR_RGB2HSV)

    lower = np.array([0, 30, 60], dtype=np.uint8)
    upper = np.array([25, 180, 255], dtype=np.uint8)

    skin_mask = cv2.inRange(hsv, lower, upper)

    skin_pixels = np.sum(skin_mask > 0)
    total_pixels = skin_mask.size

    skin_ratio = skin_pixels / total_pixels

    print("SKIN RATIO:", skin_ratio)

    return skin_ratio > 0.25

# PREDICTION

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
# OPTIONAL GROUND TRUTH

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

# ROUTES
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
        
        if not has_enough_skin(original_img):

            raise HTTPException(
                status_code=400,
                detail="No significant skin region detected."
            )
        
        validity_score = predict_skin_validity(original_img)

        print("VALIDITY SCORE:", validity_score)

        if validity_score < 0.8:
            raise HTTPException(
                status_code=400,
                detail="Please upload a valid skin or dermoscopic image."
            )

        binary_score, class_scores = predict_outputs(x)

        binary_label, binary_conf, risk = binary_result(binary_score)

        idx, class_code, class_label, class_conf = class_result(class_scores)
            
        image_base64 = base64.b64encode(contents).decode("utf-8")

        save_scan(
            file.filename,
            contents,
            binary_label,
            class_label,
            float(binary_conf),
            float(binary_score),
            risk,
            float(class_conf),
            "",
            image_base64
        )
        return {
            "prediction": binary_label,
            "probability_malignant": round(binary_score, 4),
            "confidence": round(binary_conf, 4),
            "risk_level": risk,

            "lesion_code": class_code,
            "lesion_type": class_label,
            "lesion_confidence": round(class_conf, 4),

            "top_predictions": top_classes(class_scores, 3),
            "image_base64":
                base64.b64encode(contents).decode("utf-8"),
            "model": MODEL_PATH.name
        }

    except HTTPException as e:
        raise e

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/history")
def history(limit: int = 20):
    results = get_history(limit)
    return {"history": results}

@app.get("/layers")
def layers():

    result = []

    for i, layer in enumerate(model.layers):

        result.append({
            "index": i,
            "name": layer.name,
            "type": str(type(layer))
        })

    return result

