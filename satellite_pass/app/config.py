import os

class Config:
    DB_HOST = os.environ.get("SATPASS_DB_HOST", "localhost")
    DB_PORT = int(os.environ.get("SATPASS_DB_PORT", "5432"))
    DB_NAME = os.environ.get("SATPASS_DB_NAME", "satpass")
    DB_USER = os.environ.get("SATPASS_DB_USER", "satpass_user")
    DB_PASSWORD = os.environ.get("SATPASS_DB_PASSWORD", "satpass_password")
    JWT_SECRET = os.environ.get("JWT_SECRET", "change-me")
    # Ankara location
    ANKARA_LAT = float(os.environ.get("ANKARA_LAT", "39.93"))
    ANKARA_LON = float(os.environ.get("ANKARA_LON", "32.86"))
    MIN_ELEV_DEG = float(os.environ.get("MIN_ELEV_DEG", "5"))
