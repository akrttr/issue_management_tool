import logging
from datetime import datetime, timezone, timedelta
from typing import List
from skyfield.api import load, wgs84, EarthSatellite
from skyfield.timelib import Time
import numpy as np
from models.satellite import TLEData, PassData, Position, TrackData, CoverageFootprint

logger = logging.getLogger(__name__)

class PassPredictor:
    """Predicts satellite passes and computes ground tracks"""
    
    # Ankara ground station coordinates
    GS_LAT = 39.9334
    GS_LON = 32.8597
    GS_ELEVATION = 850.0  # meters
    MIN_ELEVATION = 10.0  # degrees - minimum elevation for visibility
    
    def __init__(self):
        self.ts = load.timescale()
        self.ground_station = wgs84.latlon(
            self.GS_LAT, 
            self.GS_LON, 
            elevation_m=self.GS_ELEVATION
        )
    
    def create_satellite(self, tle: TLEData) -> EarthSatellite:
        """Create skyfield satellite object from TLE"""
        return EarthSatellite(tle.line1, tle.line2, tle.satellite_name, self.ts)
    
    def predict_passes_today(self, tle: TLEData) -> List[PassData]:
        """Predict all passes for current UTC day"""
        satellite = self.create_satellite(tle)
        
        # Define time range for today (UTC)
        now = datetime.now(timezone.utc)
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        
        t0 = self.ts.from_datetime(start_of_day)
        t1 = self.ts.from_datetime(end_of_day)
        
        logger.info(f"Finding passes from {start_of_day} to {end_of_day}")
        
        # Find events (rise, culminate, set)
        t, events = satellite.find_events(
            self.ground_station,
            t0,
            t1,
            altitude_degrees=self.MIN_ELEVATION
        )
        
        passes = []
        i = 0
        
        while i < len(events):
            if events[i] == 0:  # Rise event
                aos_time = t[i].utc_datetime()
                aos_topocentric = (satellite - self.ground_station).at(t[i])
                aos_alt, aos_az, _ = aos_topocentric.altaz()
                
                # Find corresponding culmination and set
                tca_time = None
                tca_elevation = 0
                tca_azimuth = 0
                los_time = None
                los_azimuth = 0
                
                j = i + 1
                while j < len(events):
                    if events[j] == 1:  # Culmination
                        tca_time = t[j].utc_datetime()
                        tca_topocentric = (satellite - self.ground_station).at(t[j])
                        tca_alt, tca_az, _ = tca_topocentric.altaz()
                        tca_elevation = tca_alt.degrees
                        tca_azimuth = tca_az.degrees
                    elif events[j] == 2:  # Set
                        los_time = t[j].utc_datetime()
                        los_topocentric = (satellite - self.ground_station).at(t[j])
                        los_alt, los_az, _ = los_topocentric.altaz()
                        los_azimuth = los_az.degrees
                        break
                    j += 1
                
                if tca_time and los_time:
                    duration = (los_time - aos_time).total_seconds()
                    
                    pass_data = PassData(
                        aos_time=aos_time,
                        los_time=los_time,
                        tca_time=tca_time,
                        max_elevation=tca_elevation,
                        duration=duration,
                        aos_azimuth=aos_az.degrees,
                        los_azimuth=los_azimuth,
                        max_azimuth=tca_azimuth
                    )
                    passes.append(pass_data)
                    logger.debug(f"Found pass: AOS {aos_time}, Max El {tca_elevation:.1f}°, LOS {los_time}")
                
                i = j + 1
            else:
                i += 1
        
        logger.info(f"Found {len(passes)} passes today")
        return passes
    
    def get_current_track(self, tle: TLEData, minutes_past: int = 90, minutes_future: int = 90) -> TrackData:
        """Get current position and ground track"""
        satellite = self.create_satellite(tle)
        now = datetime.now(timezone.utc)
        
        # Current position
        t_now = self.ts.from_datetime(now)
        geocentric = satellite.at(t_now)
        subpoint = wgs84.subpoint(geocentric)
        
        current_pos = Position(
            latitude=subpoint.latitude.degrees,
            longitude=subpoint.longitude.degrees,
            altitude=subpoint.elevation.km,
            timestamp=now
        )
        
        # Past track (last N minutes)
        past_track = []
        for i in range(minutes_past, 0, -2):  # Sample every 2 minutes
            t_past = self.ts.from_datetime(now - timedelta(minutes=i))
            geo = satellite.at(t_past)
            sub = wgs84.subpoint(geo)
            past_track.append(Position(
                latitude=sub.latitude.degrees,
                longitude=sub.longitude.degrees,
                altitude=sub.elevation.km,
                timestamp=(now - timedelta(minutes=i))
            ))
        
        # Future track (next N minutes)
        future_track = []
        for i in range(2, minutes_future + 1, 2):  # Sample every 2 minutes
            t_future = self.ts.from_datetime(now + timedelta(minutes=i))
            geo = satellite.at(t_future)
            sub = wgs84.subpoint(geo)
            future_track.append(Position(
                latitude=sub.latitude.degrees,
                longitude=sub.longitude.degrees,
                altitude=sub.elevation.km,
                timestamp=(now + timedelta(minutes=i))
            ))
        
        # Complete orbit track (one full orbit period)
        # Estimate orbital period from TLE (mean motion)
        mean_motion = float(tle.line2[52:63])  # revolutions per day
        orbital_period_minutes = (24 * 60) / mean_motion
        
        orbit_track = []
        for i in range(0, int(orbital_period_minutes), 3):  # Sample every 3 minutes
            t_orbit = self.ts.from_datetime(now + timedelta(minutes=i))
            geo = satellite.at(t_orbit)
            sub = wgs84.subpoint(geo)
            orbit_track.append(Position(
                latitude=sub.latitude.degrees,
                longitude=sub.longitude.degrees,
                altitude=sub.elevation.km,
                timestamp=(now + timedelta(minutes=i))
            ))
        
        return TrackData(
            current_position=current_pos,
            past_track=past_track,
            future_track=future_track,
            orbit_track=orbit_track
        )
    
    def get_coverage_footprint(self, tle: TLEData) -> CoverageFootprint:
        """
        Calculate ground station coverage footprint.
        Simple circle approximation based on min elevation angle.
        """
        # For a simple approximation, calculate horizon distance
        # based on satellite altitude and minimum elevation
        satellite = self.create_satellite(tle)
        t_now = self.ts.from_datetime(datetime.now(timezone.utc))
        geocentric = satellite.at(t_now)
        subpoint = wgs84.subpoint(geocentric)
        sat_altitude_km = subpoint.elevation.km
        
        # Earth radius
        earth_radius_km = 6371.0
        
        # Calculate maximum range based on min elevation
        min_el_rad = np.radians(self.MIN_ELEVATION)
        
        # Slant range to horizon
        slant_range = np.sqrt(
            (earth_radius_km + sat_altitude_km)**2 - 
            earth_radius_km**2 * (np.cos(min_el_rad)**2)
        ) - earth_radius_km * np.sin(min_el_rad)
        
        # Ground range (arc distance)
        ground_range_rad = np.arcsin(
            slant_range * np.cos(min_el_rad) / earth_radius_km
        )
        ground_range_deg = np.degrees(ground_range_rad)
        
        # Create circle of points around ground station
        footprint_points = []
        for azimuth in range(0, 360, 10):
            az_rad = np.radians(azimuth)
            
            # Calculate point at ground_range_deg distance in azimuth direction
            lat_rad = np.radians(self.GS_LAT)
            lon_rad = np.radians(self.GS_LON)
            
            # Haversine forward calculation
            lat2 = np.arcsin(
                np.sin(lat_rad) * np.cos(ground_range_rad) +
                np.cos(lat_rad) * np.sin(ground_range_rad) * np.cos(az_rad)
            )
            lon2 = lon_rad + np.arctan2(
                np.sin(az_rad) * np.sin(ground_range_rad) * np.cos(lat_rad),
                np.cos(ground_range_rad) - np.sin(lat_rad) * np.sin(lat2)
            )
            
            footprint_points.append({
                'latitude': np.degrees(lat2),
                'longitude': np.degrees(lon2)
            })
        
        return CoverageFootprint(
            center_lat=self.GS_LAT,
            center_lon=self.GS_LON,
            min_elevation=self.MIN_ELEVATION,
            footprint=footprint_points
        )