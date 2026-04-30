import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "results.db"

# CREATE CONNECTION
conn = sqlite3.connect(DB_PATH, check_same_thread=False)
cursor = conn.cursor()

# CREATE TABLE
cursor.execute("""
CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_name TEXT,
    prediction TEXT,
    lesion_type TEXT,
    confidence REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
""")

conn.commit()