import requests
import logging
from datetime import datetime, timedelta
from threading import Lock

logger = logging.getLogger(__name__)

class TLECache:
    """Thread-safe TLE cache with TTL"""
    
    def __init__(self, tle_url, norad_id, ttl_hours=24):
        self.tle_url = tle_url
        self.norad_id = int(norad_id)
        self.ttl_hours = ttl_hours
        self.lock = Lock()
        
        self.tle_data = None
        self.last_update = None
        
    def is_expired(self):
        if not self.last_update:
            return True
        return datetime.utcnow() - self.last_update > timedelta(hours=self.ttl_hours)
    
    def fetch_tle(self):
        """Fetch TLE from source URL"""
        try:
            logger.info(f"Fetching TLE from {self.tle_url}")
            response = requests.get(self.tle_url, timeout=30)
            response.raise_for_status()
            
            lines = response.text.strip().split('\n')
            
            # Parse TLE file and find our satellite
            for i in range(0, len(lines), 3):
                if i + 2 >= len(lines):
                    break
                    
                name = lines[i].strip()
                line1 = lines[i + 1].strip()
                line2 = lines[i + 2].strip()
                
                # Extract catalog number from line 1 (columns 3-7)
                if len(line1) >= 8:
                    try:
                        catalog_num = int(line1[2:7])
                        if catalog_num == self.norad_id:
                            logger.info(f"Found TLE for NORAD ID {self.norad_id}: {name}")
                            return {
                                'name': name,
                                'line1': line1,
                                'line2': line2,
                                'norad_id': self.norad_id,
                                'epoch': self._parse_epoch(line1),
                                'fetched_at': datetime.utcnow().isoformat() + 'Z'
                            }
                    except ValueError:
                        continue
            
            logger.error(f"NORAD ID {self.norad_id} not found in TLE source")
            return None
            
        except Exception as e:
            logger.error(f"Error fetching TLE: {e}")
            return None
    
    def _parse_epoch(self, line1):
        """Parse epoch from TLE line 1"""
        try:
            # Epoch is in columns 19-32 (format: YYDDD.DDDDDDDD)
            epoch_str = line1[18:32]
            year_str = epoch_str[:2]
            day_of_year = float(epoch_str[2:])
            
            year = 2000 + int(year_str) if int(year_str) < 57 else 1900 + int(year_str)
            
            # Calculate date from day of year
            base_date = datetime(year, 1, 1)
            epoch = base_date + timedelta(days=day_of_year - 1)
            
            return epoch.isoformat() + 'Z'
        except:
            return None
    
    def get_tle(self, force_refresh=False):
        """Get TLE (from cache or fetch new)"""
        with self.lock:
            if force_refresh or self.is_expired() or not self.tle_data:
                new_tle = self.fetch_tle()
                if new_tle:
                    self.tle_data = new_tle
                    self.last_update = datetime.utcnow()
                    logger.info("TLE cache updated successfully")
                else:
                    logger.warning("Failed to update TLE, using cached data if available")
            
            return self.tle_data