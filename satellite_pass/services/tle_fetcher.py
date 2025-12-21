import requests
import logging
from datetime import datetime, timezone
from typing import Optional
from models.satellite import TLEData

logger = logging.getLogger(__name__)

class TLEFetcher:
    """Fetches and caches TLE data from Celestrak or other sources"""
    
    def __init__(self, tle_url: str, norad_id: str):
        self.tle_url = tle_url
        self.norad_id = norad_id
        self.cached_tle: Optional[TLEData] = None
        self.last_fetch: Optional[datetime] = None
    
    def fetch_tle(self, force_refresh: bool = False) -> TLEData:
        """
        Fetch TLE data from source.
        Uses cache unless force_refresh=True or cache is older than 24 hours.
        """
        now = datetime.now(timezone.utc)
        
        # Return cached TLE if valid
        if (not force_refresh and 
            self.cached_tle is not None and 
            self.last_fetch is not None):
            age_hours = (now - self.last_fetch).total_seconds() / 3600
            if age_hours < 24:
                logger.info(f"Using cached TLE (age: {age_hours:.1f} hours)")
                return self.cached_tle
        
        logger.info(f"Fetching fresh TLE from {self.tle_url}")
        
        try:
            response = requests.get(self.tle_url, timeout=10)
            response.raise_for_status()
            
            lines = response.text.strip().split('\n')
            
            # Parse TLE (assuming 3-line format: name, line1, line2)
            if len(lines) >= 3:
                name = lines[0].strip()
                line1 = lines[1].strip()
                line2 = lines[2].strip()
            elif len(lines) == 2:
                # 2-line format (no name line)
                name = f"NORAD {self.norad_id}"
                line1 = lines[0].strip()
                line2 = lines[1].strip()
            else:
                raise ValueError("Invalid TLE format")
            
            # Extract epoch from TLE line 1
            # Format: 1 NNNNNC NNNNNAAA NNNNN.NNNNNNNN ±.NNNNNNNN...
            epoch_year = int(line1[18:20])
            epoch_day = float(line1[20:32])
            
            # Convert to full year (00-56 = 2000-2056, 57-99 = 1957-1999)
            if epoch_year < 57:
                full_year = 2000 + epoch_year
            else:
                full_year = 1900 + epoch_year
            
            # Convert day of year to datetime
            epoch = datetime(full_year, 1, 1, tzinfo=timezone.utc)
            epoch = epoch.replace(day=1)
            from datetime import timedelta
            epoch = epoch + timedelta(days=epoch_day - 1)
            
            tle_data = TLEData(
                line1=line1,
                line2=line2,
                epoch=epoch,
                satellite_name=name,
                norad_id=self.norad_id
            )
            
            self.cached_tle = tle_data
            self.last_fetch = now
            
            logger.info(f"Successfully fetched TLE for {name}, epoch: {epoch}")
            return tle_data
            
        except Exception as e:
            logger.error(f"Error fetching TLE: {e}")
            
            # Return cached TLE if available, even if stale
            if self.cached_tle is not None:
                logger.warning("Returning stale cached TLE due to fetch error")
                return self.cached_tle
            
            raise