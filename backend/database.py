import sqlite3
from pathlib import Path
import hashlib

# =========================
# DATABASE SETUP
# =========================
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "results.db"

conn = sqlite3.connect(DB_PATH, check_same_thread=False)
cursor = conn.cursor()

# =========================
# CREATE TABLE
# =========================
cursor.execute("""
CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_name TEXT,
    image_hash TEXT UNIQUE,
    prediction TEXT,
    lesion_type TEXT,
    confidence REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
""")

conn.commit()

# =========================
# HASH FUNCTION (IMPORTANT)
# =========================
def get_image_hash(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()

# =========================
# INSERT OR UPDATE (UPSERT)
# =========================
def save_scan(image_name, file_bytes, prediction, lesion_type, confidence):
    image_hash = get_image_hash(file_bytes)

    cursor.execute("""
    INSERT INTO scans (image_name, image_hash, prediction, lesion_type, confidence)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(image_hash) DO UPDATE SET
        image_name = excluded.image_name,
        prediction = excluded.prediction,
        lesion_type = excluded.lesion_type,
        confidence = excluded.confidence,
        created_at = CURRENT_TIMESTAMP
    """, (image_name, image_hash, prediction, lesion_type, confidence))

    conn.commit()

# =========================
# GET ALL SCANS
# =========================
def get_all_scans():
    cursor.execute("SELECT * FROM scans ORDER BY created_at DESC")
    return cursor.fetchall()

# =========================
# DELETE ALL DATA
# =========================
def clear_scans():
    cursor.execute("DELETE FROM scans")
    cursor.execute("DELETE FROM sqlite_sequence WHERE name='scans'")
    conn.commit()

# =========================
# DELETE ONE SCAN BY HASH
# =========================
def delete_scan_by_hash(image_hash):
    cursor.execute("DELETE FROM scans WHERE image_hash = ?", (image_hash,))
    conn.commit()

# =========================
# CLOSE CONNECTION (optional)
# =========================
def close_connection():
    conn.close()


# =========================
# TEST (RUN FILE DIRECTLY)
# =========================
if __name__ == "__main__":
    # Simulate image bytes
    fake_image = b"this_is_a_test_image"

    # First insert
    save_scan("test.jpg", fake_image, "benign", "nevus", 0.92)

    # Duplicate upload (will UPDATE, not insert)
    save_scan("test.jpg", fake_image, "malignant", "melanoma", 0.98)

    scans = get_all_scans()

    for scan in scans:
        print(scan)

    print("\nTotal rows:", len(scans))
    
def get_history(limit=20):
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

    return results