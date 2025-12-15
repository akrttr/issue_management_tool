import psycopg2
from psycopg2.extras import RealDictCursor
from .config import Config

def get_connection():
    return psycopg2.connect(
        host=Config.DB_HOST,
        port=Config.DB_PORT,
        dbname=Config.DB_NAME,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
    )

def get_latest_tle(satellite_name: str):
    """Return latest TLE (line1, line2) for given satellite name."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT tl.line1, tl.line2
                FROM tle_history tl
                JOIN satellites s ON s.id = tl.satellite_id
                WHERE s.name = %s
                ORDER BY tl.created_at DESC
                LIMIT 1;
            """, (satellite_name,))
            row = cur.fetchone()
            if not row:
                return None, None
            return row["line1"], row["line2"]
    finally:
        conn.close()

def upsert_satellite_and_insert_tle(satellite_name: str, line1: str, line2: str):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO satellites(name)
                VALUES (%s)
                ON CONFLICT (name) DO NOTHING;
            """, (satellite_name,))

            cur.execute("""
                INSERT INTO tle_history (satellite_id, line1, line2, epoch)
                SELECT id, %s, %s, NOW()
                FROM satellites
                WHERE name = %s;
            """, (line1, line2, satellite_name))

        conn.commit()
    finally:
        conn.close()

