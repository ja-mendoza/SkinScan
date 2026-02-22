import numpy as np
import tensorflow as tf
from pathlib import Path

# Load model
MODEL_PATH = Path(__file__).resolve().parent / "models" / "mobilenetv2_clean.keras"
model = tf.keras.models.load_model(MODEL_PATH, compile=False)

print("Model loaded")

# Generate two random images
x1 = np.random.rand(1, 224, 224, 3).astype(np.float32)
x2 = np.random.rand(1, 224, 224, 3).astype(np.float32)

# If you trained with scale 0-1 normalization
# leave as is

# If you trained with MobileNetV2 preprocess_input
# uncomment these lines instead
# from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
# x1 = preprocess_input(x1)
# x2 = preprocess_input(x2)

# Predict
y1 = model.predict(x1, verbose=0)
y2 = model.predict(x2, verbose=0)

print("Output 1:", np.array(y1).reshape(-1))
print("Output 2:", np.array(y2).reshape(-1))
print("Difference:", np.abs(np.array(y1) - np.array(y2)))
