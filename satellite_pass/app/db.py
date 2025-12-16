import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import os

class Database:
    def __init__(self):
        self.conn_params = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': os.getenv('DB_PORT', '5432'),
            'database': os.getenv('DB_NAME', 'sattrack'),
            'user': os.getenv('DB_USER', 'postgres'),
            'password': os.getenv('DB_PASSWORD', 'postgres')
        }
    
    def get_connection(self):
        """Get database connection"""
        return psycopg2.connect(**self.conn_params)
    
    def get_satellite_by_name(self, name):
        """Get satellite info by name"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, name, norad_id, description, active
                    FROM satellites
                    WHERE UPPER(name) = UPPER(%s) AND active = TRUE
                """, (name,))
                return cur.fetchone()
    
    def get_all_satellites(self):
        """Get all active satellites"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, name, norad_id, description, active
                    FROM satellites
                    WHERE active = TRUE
                    ORDER BY name
                """)
                return cur.fetchall()
    
    def get_latest_tle(self, satellite_name):
        """Get the most recent TLE for a satellite"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT t.line1, t.line2, t.epoch, t.source, t.created_at
                    FROM tle_history t
                    JOIN satellites s ON t.satellite_id = s.id
                    WHERE UPPER(s.name) = UPPER(%s)
                    ORDER BY t.epoch DESC
                    LIMIT 1
                """, (satellite_name,))
                return cur.fetchone()
    
    def insert_tle(self, satellite_id, line1, line2, epoch, source='manual'):
        """Insert a new TLE record"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                try:
                    cur.execute("""
                        INSERT INTO tle_history (satellite_id, line1, line2, epoch, source)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (satellite_id, epoch) DO NOTHING
                        RETURNING id
                    """, (satellite_id, line1, line2, epoch, source))
                    conn.commit()
                    result = cur.fetchone()
                    return result[0] if result else None
                except Exception as e:
                    conn.rollback()
                    raise e
    
    def get_tle_history(self, satellite_name, limit=10):
        """Get TLE history for a satellite"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT t.line1, t.line2, t.epoch, t.source, t.created_at
                    FROM tle_history t
                    JOIN satellites s ON t.satellite_id = s.id
                    WHERE UPPER(s.name) = UPPER(%s)
                    ORDER BY t.epoch DESC
                    LIMIT %s
                """, (satellite_name, limit))
                return cur.fetchall()
    
    def get_satellites_needing_tle_update(self, hours=24):
        """Get satellites that haven't had TLE update in specified hours"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT s.id, s.name, s.norad_id, 
                           MAX(t.created_at) as last_update
                    FROM satellites s
                    LEFT JOIN tle_history t ON s.satellite_id = t.satellite_id
                    WHERE s.active = TRUE AND s.norad_id IS NOT NULL
                    GROUP BY s.id, s.name, s.norad_id
                    HAVING MAX(t.created_at) IS NULL 
                        OR MAX(t.created_at) < NOW() - INTERVAL '%s hours'
                """, (hours,))
                return cur.fetchall()

db = Database()