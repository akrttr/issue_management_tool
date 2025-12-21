from flask import Flask, jsonify, request
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import logging
import os
from datetime import datetime, timezone
from dataclasses import asdict

from services.tle_fetcher import TLEFetcher
from services.pass_predictor import PassPredictor
from models.satellite import TLEData

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configuration from environment variables
TLE_URL = os.getenv('TLE_URL', 'https://celestrak.org/NORAD/elements/gp.php?CATNR=41875&FORMAT=TLE')
NORAD_ID = os.getenv('NORAD_ID', '41875')
UPDATE_HOUR = int(os.getenv('TLE_UPDATE_HOUR', '3'))  # Default 03:00 UTC

# Initialize services
tle_fetcher = TLEFetcher(TLE_URL, NORAD_ID)
pass_predictor = PassPredictor()

# Cache for today's passes
cached_passes = []
passes_cache_time = None

def update_tle_data():
    """Scheduled job to update TLE data daily"""
    try:
        logger.info("Running scheduled TLE update...")
        tle_fetcher.fetch_tle(force_refresh=True)
        logger.info("TLE update completed successfully")
        
        # Invalidate pass cache
        global passes_cache_time
        passes_cache_time = None
        
    except Exception as e:
        logger.error(f"Error in scheduled TLE update: {e}")

def update_pass_cache():
    """Update cached pass predictions"""
    global cached_passes, passes_cache_time
    
    try:
        tle = tle_fetcher.fetch_tle()
        cached_passes = pass_predictor.predict_passes_today(tle)
        passes_cache_time = datetime.now(timezone.utc)
        logger.info(f"Updated pass cache with {len(cached_passes)} passes")
    except Exception as e:
        logger.error(f"Error updating pass cache: {e}")

# Initialize scheduler
scheduler = BackgroundScheduler()
scheduler.add_job(
    func=update_tle_data,
    trigger=CronTrigger(hour=UPDATE_HOUR, minute=0),
    id='tle_update',
    name='Daily TLE update',
    replace_existing=True
)
scheduler.start()

# Initial data fetch on startup
logger.info("Performing initial data fetch...")
try:
    tle_fetcher.fetch_tle()
    update_pass_cache()
    logger.info("Initial data fetch completed")
except Exception as e:
    logger.error(f"Error in initial data fetch: {e}")

# ===== API ENDPOINTS =====

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for Docker"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'tle_cached': tle_fetcher.cached_tle is not None,
        'passes_cached': len(cached_passes) > 0
    }), 200

@app.route('/api/satellite/tle', methods=['GET'])
def get_tle():
    """Get latest TLE data"""
    try:
        tle = tle_fetcher.fetch_tle()
        return jsonify({
            'satellite_name': tle.satellite_name,
            'norad_id': tle.norad_id,
            'epoch': tle.epoch.isoformat(),
            'line1': tle.line1,
            'line2': tle.line2
        }), 200
    except Exception as e:
        logger.error(f"Error in /api/satellite/tle: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/satellite/passes/today', methods=['GET'])
def get_today_passes():
    """Get all passes for current UTC day"""
    try:
        # Check if cache is still valid (valid for current UTC day)
        now = datetime.now(timezone.utc)
        cache_valid = False
        
        if passes_cache_time:
            # Cache valid if from same UTC day
            if (passes_cache_time.year == now.year and
                passes_cache_time.month == now.month and
                passes_cache_time.day == now.day):
                cache_valid = True
        
        # Update cache if invalid
        if not cache_valid:
            logger.info("Pass cache invalid or expired, updating...")
            update_pass_cache()
        
        # Convert to dict for JSON serialization
        passes_data = []
        for p in cached_passes:
            passes_data.append({
                'aos_time': p.aos_time.isoformat(),
                'los_time': p.los_time.isoformat(),
                'tca_time': p.tca_time.isoformat(),
                'max_elevation': p.max_elevation,
                'duration': p.duration,
                'aos_azimuth': p.aos_azimuth,
                'los_azimuth': p.los_azimuth,
                'max_azimuth': p.max_azimuth
            })
        
        return jsonify({
            'passes': passes_data,
            'count': len(passes_data),
            'date': now.date().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Error in /api/satellite/passes/today: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/satellite/track/current', methods=['GET'])
def get_current_track():
    """Get current satellite position and ground track"""
    try:
        minutes = int(request.args.get('minutes', 90))
        tle = tle_fetcher.fetch_tle()
        track_data = pass_predictor.get_current_track(tle, minutes_past=minutes, minutes_future=minutes)
        
        # Convert to dict
        result = {
            'current_position': {
                'latitude': track_data.current_position.latitude,
                'longitude': track_data.current_position.longitude,
                'altitude': track_data.current_position.altitude,
                'timestamp': track_data.current_position.timestamp.isoformat()
            },
            'past_track': [
                {
                    'latitude': p.latitude,
                    'longitude': p.longitude,
                    'altitude': p.altitude,
                    'timestamp': p.timestamp.isoformat()
                } for p in track_data.past_track
            ],
            'future_track': [
                {
                    'latitude': p.latitude,
                    'longitude': p.longitude,
                    'altitude': p.altitude,
                    'timestamp': p.timestamp.isoformat()
                } for p in track_data.future_track
            ],
            'orbit_track': [
                {
                    'latitude': p.latitude,
                    'longitude': p.longitude,
                    'altitude': p.altitude,
                    'timestamp': p.timestamp.isoformat()
                } for p in track_data.orbit_track
            ]
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error in /api/satellite/track/current: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/satellite/coverage', methods=['GET'])
def get_coverage():
    """Get ground station coverage footprint"""
    try:
        tle = tle_fetcher.fetch_tle()
        coverage = pass_predictor.get_coverage_footprint(tle)
        
        return jsonify({
            'center_lat': coverage.center_lat,
            'center_lon': coverage.center_lon,
            'min_elevation': coverage.min_elevation,
            'footprint': coverage.footprint
        }), 200
        
    except Exception as e:
        logger.error(f"Error in /api/satellite/coverage: {e}")
        return jsonify({'error': str(e)}), 500

# Cleanup scheduler on shutdown
import atexit
atexit.register(lambda: scheduler.shutdown())

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)