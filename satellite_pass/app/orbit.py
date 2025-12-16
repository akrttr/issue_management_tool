from skyfield.api import load, wgs84, EarthSatellite
from datetime import datetime, timedelta
import numpy as np
from .db import db

class OrbitCalculator:
    """Calculate satellite orbits and ground tracks using Skyfield"""
    
    def __init__(self):
        # Load timescale
        self.ts = load.timescale()
    
    def create_satellite(self, line1, line2, name="Satellite"):
        """Create Skyfield satellite object from TLE"""
        return EarthSatellite(line1, line2, name, self.ts)
    
    def calculate_ground_track(self, satellite_name, start_time, duration_hours=24, step_minutes=1):
        """
        Calculate satellite ground track
        
        Args:
            satellite_name: Name of satellite
            start_time: datetime object for start
            duration_hours: How many hours to calculate
            step_minutes: Time step in minutes
            
        Returns:
            List of dicts with {time, lat, lng, alt, velocity}
        """
        # Get latest TLE
        tle = db.get_latest_tle(satellite_name)
        if not tle:
            raise ValueError(f"No TLE found for satellite '{satellite_name}'")
        
        # Create satellite
        sat = self.create_satellite(tle['line1'], tle['line2'], satellite_name)
        
        # Generate time range
        times = []
        current = start_time
        end_time = start_time + timedelta(hours=duration_hours)
        
        while current <= end_time:
            times.append(current)
            current += timedelta(minutes=step_minutes)
        
        # Convert to Skyfield times
        t = self.ts.utc(
            [dt.year for dt in times],
            [dt.month for dt in times],
            [dt.day for dt in times],
            [dt.hour for dt in times],
            [dt.minute for dt in times],
            [dt.second for dt in times]
        )
        
        # Calculate positions
        geocentric = sat.at(t)
        subpoint = wgs84.subpoint(geocentric)
        
        # Calculate velocity
        velocity = geocentric.velocity.km_per_s
        speed = np.sqrt(
            velocity[0]**2 + velocity[1]**2 + velocity[2]**2
        )
        
        # Build result
        track = []
        for i, time in enumerate(times):
            track.append({
                'time': time.isoformat() + 'Z',
                'lat': subpoint.latitude.degrees[i],
                'lng': subpoint.longitude.degrees[i],
                'alt': subpoint.elevation.km[i],
                'velocity': float(speed[i])
            })
        
        return track
    
    def calculate_passes(self, satellite_name, observer_lat, observer_lng, observer_alt_m, 
                        start_time, duration_hours=24, min_elevation=10):
        """
        Calculate satellite passes over a ground station
        
        Args:
            satellite_name: Name of satellite
            observer_lat: Observer latitude in degrees
            observer_lng: Observer longitude in degrees
            observer_alt_m: Observer altitude in meters
            start_time: datetime object for start
            duration_hours: How many hours to calculate
            min_elevation: Minimum elevation angle in degrees
            
        Returns:
            List of pass dicts with start, end, max_elevation, etc.
        """
        # Get latest TLE
        tle = db.get_latest_tle(satellite_name)
        if not tle:
            raise ValueError(f"No TLE found for satellite '{satellite_name}'")
        
        # Create satellite and observer
        sat = self.create_satellite(tle['line1'], tle['line2'], satellite_name)
        observer = wgs84.latlon(observer_lat, observer_lng, elevation_m=observer_alt_m)
        
        # Time range
        t0 = self.ts.from_datetime(start_time)
        t1 = self.ts.from_datetime(start_time + timedelta(hours=duration_hours))
        
        # Find passes
        t, events = sat.find_events(observer, t0, t1, altitude_degrees=min_elevation)
        
        # Group events into passes
        passes = []
        current_pass = {}
        
        for ti, event in zip(t, events):
            dt = ti.utc_datetime()
            
            if event == 0:  # Rise
                current_pass = {
                    'start': dt.isoformat() + 'Z',
                    'rise_azimuth': None
                }
            elif event == 1:  # Culmination (max elevation)
                if current_pass:
                    # Calculate elevation and azimuth at culmination
                    difference = sat.at(ti) - observer.at(ti)
                    topocentric = difference.altaz()
                    
                    current_pass['max_elevation'] = float(topocentric[0].degrees)
                    current_pass['max_elevation_time'] = dt.isoformat() + 'Z'
                    current_pass['azimuth'] = float(topocentric[1].degrees)
            elif event == 2:  # Set
                if current_pass:
                    current_pass['end'] = dt.isoformat() + 'Z'
                    current_pass['set_azimuth'] = None
                    passes.append(current_pass)
                    current_pass = {}
        
        return passes
    
    def get_current_position(self, satellite_name):
        """Get current satellite position"""
        # Get latest TLE
        tle = db.get_latest_tle(satellite_name)
        if not tle:
            raise ValueError(f"No TLE found for satellite '{satellite_name}'")
        
        # Create satellite
        sat = self.create_satellite(tle['line1'], tle['line2'], satellite_name)
        
        # Current time
        t = self.ts.now()
        
        # Calculate position
        geocentric = sat.at(t)
        subpoint = wgs84.subpoint(geocentric)
        velocity = geocentric.velocity.km_per_s
        speed = np.sqrt(velocity[0]**2 + velocity[1]**2 + velocity[2]**2)
        
        return {
            'time': t.utc_datetime().isoformat() + 'Z',
            'lat': float(subpoint.latitude.degrees),
            'lng': float(subpoint.longitude.degrees),
            'alt': float(subpoint.elevation.km),
            'velocity': float(speed)
        }

orbit_calc = OrbitCalculator()