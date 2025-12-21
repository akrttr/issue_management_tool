from flask import Flask, jsonify
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
import logging
import os
from datetime import datetime
from threading import Lock

from tle_updater import TLECache
from pass_calculator import PassCalculator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration from environment
TLE_SOURCE_URL = os.getenv('TLE_SOURCE_URL', 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle')
NORAD_ID = int(os.getenv('NORAD_ID', '25544'))  # Default to ISS for testing
GS_LAT = float(os.getenv('GS_LATITUDE', '39.9334'))  # Ankara
GS_LON = float(os.getenv('GS_LONGITUDE', '32.8597'))
GS_ALT = float(os.getenv('GS_ALTITUDE', '0.9'))  # km
MIN_ELEVATION = float(os.getenv('MIN_ELEVATION', '10'))

# Initialize Flask
app = Flask(__name__)
CORS(app)

# Initialize components
tle_cache = TLECache(TLE_SOURCE_URL, NORAD_ID)
pass_calc = PassCalculator(GS_LAT, GS_LON, GS_ALT)

# Pass/track cache with lock
cache_lock = Lock()
passes_cache = {'data': None, 'updated_at': None}
track_cache = {'data': None, 'updated_at': None}

def update_all_data():
    """Background job to update TLE and recompute passes/track"""
    logger.info("Running scheduled update...")
    
    # Fetch fresh TLE
    tle = tle_cache.get_tle(force_refresh=True)
    if not tle:
        logger.error("Failed to fetch TLE, skipping pass/track update")
        return
    
    # Recompute passes and track
    passes = pass_calc.compute_passes_today(tle, MIN_ELEVATION)
    track = pass_calc.compute_track_today(tle, interval_seconds=60)
    
    with cache_lock:
        passes_cache['data'] = passes
        passes_cache['updated_at'] = datetime.utcnow().isoformat() + 'Z'
        
        track_cache['data'] = track
        track_cache['updated_at'] = datetime.utcnow().isoformat() + 'Z'
    
    logger.info("Scheduled update completed successfully")

# Initialize scheduler
scheduler = BackgroundScheduler()
scheduler.add_job(update_all_data, 'interval', hours=6, id='update_data')
scheduler.add_job(update_all_data, 'cron', hour=0, minute=5, id='daily_update')  # Daily at 00:05 UTC
scheduler.start()

# Run initial update on startup
update_all_data()

# ==================== API Endpoints ====================

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'tle_last_update': tle_cache.last_update.isoformat() + 'Z' if tle_cache.last_update else None,
    })

@app.route('/api/gkt1/tle', methods=['GET'])
def get_tle():
    """Get latest TLE data"""
    tle = tle_cache.get_tle()
    if not tle:
        return jsonify({'error': 'TLE data not available'}), 503
    
    return jsonify(tle)

@app.route('/api/gkt1/passes/today', methods=['GET'])
def get_passes_today():
    """Get today's pass predictions"""
    with cache_lock:
        if not passes_cache['data']:
            return jsonify({'error': 'Pass data not available yet'}), 503
        
        return jsonify({
            'passes': passes_cache['data'],
            'updated_at': passes_cache['updated_at'],
            'ground_station': {
                'latitude': GS_LAT,
                'longitude': GS_LON,
                'altitude_km': GS_ALT,
            },
            'min_elevation': MIN_ELEVATION,
        })

@app.route('/api/gkt1/track/today', methods=['GET'])
def get_track_today():
    """Get today's ground track points"""
    with cache_lock:
        if not track_cache['data']:
            return jsonify({'error': 'Track data not available yet'}), 503
        
        return jsonify({
            'points': track_cache['data'],
            'updated_at': track_cache['updated_at'],
        })

@app.route('/api/gkt1/position/current', methods=['GET'])
def get_current_position():
    """Get current satellite position"""
    tle = tle_cache.get_tle()
    if not tle:
        return jsonify({'error': 'TLE data not available'}), 503
    
    position = pass_calc.get_current_position(tle)
    if not position:
        return jsonify({'error': 'Unable to compute position'}), 500
    
    return jsonify(position)

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal error: {error}")
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    try:
        port = int(os.getenv('PORT', '5001'))
        app.run(host='0.0.0.0', port=port, debug=False)
    except KeyboardInterrupt:
        scheduler.shutdown()
        logger.info("Application shutdown")