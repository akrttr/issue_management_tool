from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional

@dataclass
class TLEData:
    """Two-Line Element set data"""
    line1: str
    line2: str
    epoch: datetime
    satellite_name: str = "GKT1"
    norad_id: str = "UNKNOWN"

@dataclass
class Position:
    """Geographic position with altitude"""
    latitude: float
    longitude: float
    altitude: float  # km above Earth
    timestamp: datetime

@dataclass
class PassData:
    """Satellite pass information"""
    aos_time: datetime  # Acquisition of Signal
    los_time: datetime  # Loss of Signal
    tca_time: datetime  # Time of Closest Approach
    max_elevation: float  # degrees
    duration: float  # seconds
    aos_azimuth: float
    los_azimuth: float
    max_azimuth: float

@dataclass
class TrackData:
    """Complete tracking information"""
    current_position: Position
    past_track: List[Position]
    future_track: List[Position]
    orbit_track: List[Position]

@dataclass
class CoverageFootprint:
    """Ground station coverage footprint"""
    center_lat: float
    center_lon: float
    min_elevation: float
    footprint: List[dict]  # List of {latitude, longitude} points