from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import tensorflow as tf
import numpy as np
from PIL import Image
import io
import traceback

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = Path(__file__).resolve().parent / "models" / "mobilenetv2_clean.keras"
model = tf.keras.models.load_model(MODEL_PATH, compile=False)

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        contents = await file.read()

        img = Image.open(io.BytesIO(contents)).convert("RGB")
        img = img.resize((224, 224))

        x = np.array(img, dtype=np.float32)
        x = np.expand_dims(x, axis=0)

        x = x / 255.0

        y = model.predict(x, verbose=0)

        score = float(y[0][0])
        label = "malignant" if score >= 0.5 else "benign"
        confidence = score if score >= 0.5 else 1.0 - score

        return {
            "label": label,
            "probability_malignant": score,
            "confidence": float(confidence)
        }

    except Exception as e:
        return {
            "error": str(e),
            "trace": traceback.format_exc()
        }
