from skyfield.api import load, wgs84, EarthSatellite
from datetime import datetime, timedelta
import logging
import pytz

logger = logging.getLogger(__name__)

class PassCalculator:
    """Calculate satellite passes using Skyfield"""
    
    def __init__(self, ground_station_lat, ground_station_lon, ground_station_alt=0):
        self.ts = load.timescale()
        self.ground_station = wgs84.latlon(ground_station_lat, ground_station_lon, ground_station_alt)
        
    def compute_passes_today(self, tle_data, min_elevation=10):
        """Compute all passes for today above min elevation"""
        try:
            satellite = EarthSatellite(tle_data['line1'], tle_data['line2'], tle_data['name'], self.ts)
            
            # Today's time range in UTC
            now = datetime.utcnow()
            t0 = self.ts.utc(now.year, now.month, now.day, 0, 0, 0)
            t1 = self.ts.utc(now.year, now.month, now.day, 23, 59, 59)
            
            # Find events (rise, culminate, set)
            t, events = satellite.find_events(self.ground_station, t0, t1, altitude_degrees=min_elevation)
            
            passes = []
            current_pass = {}
            
            for ti, event in zip(t, events):
                if event == 0:  # Rise (AOS)
                    current_pass = {
                        'aos': ti.utc_datetime().replace(tzinfo=pytz.UTC).isoformat(),
                    }
                elif event == 1:  # Culminate
                    if current_pass:
                        topocentric = (satellite - self.ground_station).at(ti)
                        alt, az, distance = topocentric.altaz()
                        current_pass['maxElevation'] = alt.degrees
                        current_pass['maxElevationTime'] = ti.utc_datetime().replace(tzinfo=pytz.UTC).isoformat()
                elif event == 2:  # Set (LOS)
                    if current_pass:
                        current_pass['los'] = ti.utc_datetime().replace(tzinfo=pytz.UTC).isoformat()
                        
                        # Calculate duration
                        aos_dt = datetime.fromisoformat(current_pass['aos'].replace('Z', '+00:00'))
                        los_dt = datetime.fromisoformat(current_pass['los'].replace('Z', '+00:00'))
                        duration = (los_dt - aos_dt).total_seconds()
                        current_pass['duration'] = duration
                        
                        passes.append(current_pass)
                        current_pass = {}
            
            logger.info(f"Found {len(passes)} passes for today")
            return passes
            
        except Exception as e:
            logger.error(f"Error computing passes: {e}")
            return []
    
    def compute_track_today(self, tle_data, interval_seconds=60):
        """Compute ground track points for today"""
        try:
            satellite = EarthSatellite(tle_data['line1'], tle_data['line2'], tle_data['name'], self.ts)
            
            now = datetime.utcnow()
            t0 = self.ts.utc(now.year, now.month, now.day, 0, 0, 0)
            t1 = self.ts.utc(now.year, now.month, now.day, 23, 59, 59)
            
            # Generate time points
            total_seconds = int((t1.tt - t0.tt) * 86400)
            num_points = total_seconds // interval_seconds
            
            times = self.ts.linspace(t0, t1, num_points)
            
            geocentric = satellite.at(times)
            subpoint = wgs84.subpoint(geocentric)
            
            points = []
            for i, time in enumerate(times):
                points.append({
                    'time': time.utc_datetime().replace(tzinfo=pytz.UTC).isoformat(),
                    'latitude': subpoint.latitude.degrees[i],
                    'longitude': subpoint.longitude.degrees[i],
                    'altitude': subpoint.elevation.km[i],
                })
            
            logger.info(f"Generated {len(points)} track points")
            return points
            
        except Exception as e:
            logger.error(f"Error computing track: {e}")
            return []
    
    def get_current_position(self, tle_data):
        """Get current satellite position"""
        try:
            satellite = EarthSatellite(tle_data['line1'], tle_data['line2'], tle_data['name'], self.ts)
            
            now = datetime.utcnow()
            t = self.ts.utc(now.year, now.month, now.day, now.hour, now.minute, now.second)
            
            geocentric = satellite.at(t)
            subpoint = wgs84.subpoint(geocentric)
            
            # Velocity
            velocity = geocentric.velocity.km_per_s
            speed = (velocity[0]**2 + velocity[1]**2 + velocity[2]**2)**0.5
            
            return {
                'time': t.utc_datetime().replace(tzinfo=pytz.UTC).isoformat(),
                'latitude': subpoint.latitude.degrees,
                'longitude': subpoint.longitude.degrees,
                'altitude': subpoint.elevation.km,
                'velocity': speed,
            }
            
        except Exception as e:
            logger.error(f"Error getting current position: {e}")
            return None