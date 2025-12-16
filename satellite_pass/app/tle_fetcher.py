import requests
from datetime import datetime
import logging
from .db import db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TLEFetcher:
    """Fetch TLEs from Celestrak and Space-Track"""
    
    CELESTRAK_URL = "https://celestrak.org/NORAD/elements/gp.php"
    
    def __init__(self):
        pass
    
    def fetch_tle_from_celestrak(self, norad_id):
        """
        Fetch TLE from Celestrak by NORAD ID
        Returns: (line1, line2, epoch) or (None, None, None)
        """
        try:
            # Celestrak API parameters
            params = {
                'CATNR': norad_id,
                'FORMAT': 'TLE'
            }
            
            response = requests.get(self.CELESTRAK_URL, params=params, timeout=10)
            response.raise_for_status()
            
            lines = response.text.strip().split('\n')
            
            if len(lines) >= 2:
                # TLE format: [name], line1, line2
                # Find the actual TLE lines (they start with '1 ' and '2 ')
                line1 = None
                line2 = None
                
                for line in lines:
                    if line.startswith('1 '):
                        line1 = line.strip()
                    elif line.startswith('2 '):
                        line2 = line.strip()
                
                if line1 and line2:
                    # Extract epoch from line1
                    epoch = self._parse_tle_epoch(line1)
                    logger.info(f"✓ Fetched TLE for NORAD {norad_id} from Celestrak")
                    return line1, line2, epoch
            
            logger.warning(f"Invalid TLE format for NORAD {norad_id}")
            return None, None, None
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch TLE for NORAD {norad_id}: {e}")
            return None, None, None
    
    def _parse_tle_epoch(self, line1):
        """
        Parse epoch from TLE line 1
        Format: YYDDDfraction where YY=year, DDD=day of year, fraction=decimal part
        """
        try:
            # Extract epoch from positions 18-32 of line1
            epoch_str = line1[18:32].strip()
            
            # Parse year (first 2 digits)
            year_2digit = int(epoch_str[:2])
            year = 2000 + year_2digit if year_2digit < 57 else 1900 + year_2digit
            
            # Parse day of year
            day_of_year = float(epoch_str[2:])
            
            # Convert to datetime
            epoch = datetime(year, 1, 1) + \
                    datetime.timedelta(days=day_of_year - 1)
            
            return epoch
            
        except Exception as e:
            logger.error(f"Failed to parse TLE epoch: {e}")
            return datetime.utcnow()
    
    def update_tle_for_satellite(self, satellite_name):
        """
        Update TLE for a specific satellite
        Returns: True if successful, False otherwise
        """
        try:
            # Get satellite info
            satellite = db.get_satellite_by_name(satellite_name)
            if not satellite:
                logger.error(f"Satellite '{satellite_name}' not found in database")
                return False
            
            if not satellite['norad_id']:
                logger.error(f"Satellite '{satellite_name}' has no NORAD ID")
                return False
            
            # Fetch TLE from Celestrak
            line1, line2, epoch = self.fetch_tle_from_celestrak(satellite['norad_id'])
            
            if not line1 or not line2:
                logger.error(f"Failed to fetch TLE for '{satellite_name}'")
                return False
            
            # Check if we already have this TLE
            latest_tle = db.get_latest_tle(satellite_name)
            if latest_tle and latest_tle['line1'] == line1 and latest_tle['line2'] == line2:
                logger.info(f"TLE for '{satellite_name}' is already up to date")
                return True
            
            # Insert new TLE
            tle_id = db.insert_tle(
                satellite['id'],
                line1,
                line2,
                epoch,
                source='celestrak'
            )
            
            if tle_id:
                logger.info(f"✓ Updated TLE for '{satellite_name}' (epoch: {epoch})")
                return True
            else:
                logger.warning(f"TLE for '{satellite_name}' already exists for this epoch")
                return True
                
        except Exception as e:
            logger.error(f"Error updating TLE for '{satellite_name}': {e}")
            return False
    
    def update_all_satellites(self):
        """Update TLEs for all active satellites"""
        logger.info("Starting TLE update for all satellites...")
        
        satellites = db.get_all_satellites()
        success_count = 0
        fail_count = 0
        
        for satellite in satellites:
            if satellite['norad_id']:
                if self.update_tle_for_satellite(satellite['name']):
                    success_count += 1
                else:
                    fail_count += 1
            else:
                logger.warning(f"Skipping '{satellite['name']}' - no NORAD ID")
        
        logger.info(f"TLE update complete: {success_count} success, {fail_count} failed")
        return success_count, fail_count

tle_fetcher = TLEFetcher()