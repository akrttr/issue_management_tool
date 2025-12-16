from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta
import logging
from .db import db
from .orbit import orbit_calc
from .tle_fetcher import tle_fetcher
from .scheduler import tle_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# CORS configuration
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "http://localhost:5173", "http://localhost:8080"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# Start TLE scheduler
tle_scheduler.start()

# Health check
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    })

# Get all satellites
@app.route('/api/satellites', methods=['GET'])
def get_satellites():
    """Get list of all satellites"""
    try:
        satellites = db.get_all_satellites()
        return jsonify({
            'satellites': satellites,
            'count': len(satellites)
        })
    except Exception as e:
        logger.error(f"Error getting satellites: {e}")
        return jsonify({'error': str(e)}), 500

# Get satellite info
@app.route('/api/satellites/<satellite_name>', methods=['GET'])
def get_satellite_info(satellite_name):
    """Get info for a specific satellite"""
    try:
        satellite = db.get_satellite_by_name(satellite_name)
        if not satellite:
            return jsonify({'error': f"Satellite '{satellite_name}' not found"}), 404
        
        # Get latest TLE
        latest_tle = db.get_latest_tle(satellite_name)
        
        return jsonify({
            'satellite': satellite,
            'latest_tle': {
                'epoch': latest_tle['epoch'].isoformat() + 'Z' if latest_tle else None,
                'source': latest_tle['source'] if latest_tle else None,
                'age_hours': (datetime.utcnow() - latest_tle['epoch']).total_seconds() / 3600 if latest_tle else None
            } if latest_tle else None
        })
    except Exception as e:
        logger.error(f"Error getting satellite info: {e}")
        return jsonify({'error': str(e)}), 500

# Get current position
@app.route('/api/position/<satellite_name>', methods=['GET'])
def get_current_position(satellite_name):
    """Get current satellite position"""
    try:
        position = orbit_calc.get_current_position(satellite_name)
        return jsonify(position)
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        logger.error(f"Error calculating position: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/groundtrack', methods=['GET'])
def get_groundtrack():
    """
    Get satellite ground track
    Query params: satellite, date (YYYY-MM-DD), duration (hours, default 3)
    """
    try:
        satellite_name = request.args.get('satellite', 'GKT1')
        date_str = request.args.get('date')
        duration = float(request.args.get('duration', 3))  # Default 3 hours
        
        if not date_str:
            return jsonify({'error': 'date parameter required (YYYY-MM-DD)'}), 400
        
        # Parse date
        try:
            start_date = datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            return jsonify({'error': 'Invalid date format, use YYYY-MM-DD'}), 400
        
        # Calculate ground track
        track = orbit_calc.calculate_ground_track(
            satellite_name,
            start_date,
            duration_hours=duration,
            step_minutes=1
        )
        
        # Build GeoJSON
        geojson = build_geojson_from_track(track)
        
        return jsonify({
            'satellite': satellite_name,
            'date': date_str,
            'duration_hours': duration,
            'current_time': datetime.utcnow().isoformat() + 'Z',
            'geojson': geojson,
            'points_count': len(track)
        })
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        logger.error(f"Error calculating ground track: {e}")
        return jsonify({'error': str(e)}), 500

# Get passes over ground station
@app.route('/api/passes', methods=['GET'])
def get_passes():
    """
    Get satellite passes over a ground station
    Query params: satellite, date, lat, lng, alt (optional), duration (hours)
    """
    try:
        satellite_name = request.args.get('satellite', 'GKT1')
        date_str = request.args.get('date')
        lat = request.args.get('lat', type=float)
        lng = request.args.get('lng', type=float)
        alt = request.args.get('alt', 0, type=float)  # meters
        duration = request.args.get('duration', 24, type=float)
        min_elevation = request.args.get('min_elevation', 10, type=float)
        
        # Validate required params
        if not date_str:
            return jsonify({'error': 'date parameter required (YYYY-MM-DD)'}), 400
        if lat is None or lng is None:
            return jsonify({'error': 'lat and lng parameters required'}), 400
        
        # Parse date
        try:
            start_date = datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            return jsonify({'error': 'Invalid date format, use YYYY-MM-DD'}), 400
        
        # Calculate passes
        passes = orbit_calc.calculate_passes(
            satellite_name,
            lat, lng, alt,
            start_date,
            duration_hours=duration,
            min_elevation=min_elevation
        )
        
        # Add status to each pass
        now = datetime.utcnow()
        for p in passes:
            start = datetime.fromisoformat(p['start'].replace('Z', ''))
            end = datetime.fromisoformat(p['end'].replace('Z', ''))
            
            if end < now:
                p['status'] = 'past'
            elif start <= now <= end:
                p['status'] = 'ongoing'
            else:
                p['status'] = 'future'
        
        return jsonify({
            'satellite': satellite_name,
            'observer': {
                'lat': lat,
                'lng': lng,
                'alt_m': alt
            },
            'date': date_str,
            'duration_hours': duration,
            'min_elevation': min_elevation,
            'passes': passes,
            'pass_count': len(passes)
        })
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        logger.error(f"Error calculating passes: {e}")
        return jsonify({'error': str(e)}), 500

# Manual TLE update
@app.route('/api/tle', methods=['POST'])
def update_tle():
    """
    Manually add/update TLE for a satellite
    Body: { satellite, line1, line2 }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body required'}), 400
        
        satellite_name = data.get('satellite')
        line1 = data.get('line1')
        line2 = data.get('line2')
        
        if not all([satellite_name, line1, line2]):
            return jsonify({'error': 'satellite, line1, and line2 required'}), 400
        
        # Get satellite
        satellite = db.get_satellite_by_name(satellite_name)
        if not satellite:
            return jsonify({'error': f"Satellite '{satellite_name}' not found"}), 404
        
        # Parse epoch from TLE
        try:
            epoch_str = line1[18:32].strip()
            year_2digit = int(epoch_str[:2])
            year = 2000 + year_2digit if year_2digit < 57 else 1900 + year_2digit
            day_of_year = float(epoch_str[2:])
            epoch = datetime(year, 1, 1) + timedelta(days=day_of_year - 1)
        except Exception as e:
            return jsonify({'error': f'Invalid TLE format: {e}'}), 400
        
        # Insert TLE
        tle_id = db.insert_tle(
            satellite['id'],
            line1,
            line2,
            epoch,
            source='manual'
        )
        
        if tle_id:
            return jsonify({
                'status': 'success',
                'message': f"TLE updated for '{satellite_name}'",
                'tle_id': tle_id,
                'epoch': epoch.isoformat() + 'Z'
            })
        else:
            return jsonify({
                'status': 'exists',
                'message': 'TLE already exists for this epoch'
            })
            
    except Exception as e:
        logger.error(f"Error updating TLE: {e}")
        return jsonify({'error': str(e)}), 500

# Get TLE history
@app.route('/api/tle/history/<satellite_name>', methods=['GET'])
def get_tle_history(satellite_name):
    """Get TLE history for a satellite"""
    try:
        limit = request.args.get('limit', 10, type=int)
        
        history = db.get_tle_history(satellite_name, limit)
        
        # Format for response
        formatted_history = []
        for tle in history:
            formatted_history.append({
                'epoch': tle['epoch'].isoformat() + 'Z',
                'source': tle['source'],
                'created_at': tle['created_at'].isoformat() + 'Z',
                'line1': tle['line1'],
                'line2': tle['line2']
            })
        
        return jsonify({
            'satellite': satellite_name,
            'history': formatted_history,
            'count': len(formatted_history)
        })
        
    except Exception as e:
        logger.error(f"Error getting TLE history: {e}")
        return jsonify({'error': str(e)}), 500

# Trigger TLE update for specific satellite
@app.route('/api/tle/update/<satellite_name>', methods=['POST'])
def trigger_tle_update(satellite_name):
    """Manually trigger TLE update for a satellite"""
    try:
        success = tle_fetcher.update_tle_for_satellite(satellite_name)
        
        if success:
            latest_tle = db.get_latest_tle(satellite_name)
            return jsonify({
                'status': 'success',
                'message': f"TLE updated for '{satellite_name}'",
                'epoch': latest_tle['epoch'].isoformat() + 'Z' if latest_tle else None,
                'source': latest_tle['source'] if latest_tle else None
            })
        else:
            return jsonify({
                'status': 'failed',
                'message': f"Failed to update TLE for '{satellite_name}'"
            }), 500
            
    except Exception as e:
        logger.error(f"Error triggering TLE update: {e}")
        return jsonify({'error': str(e)}), 500

# Trigger TLE update for all satellites
@app.route('/api/tle/update-all', methods=['POST'])
def trigger_all_tle_updates():
    """Manually trigger TLE update for all satellites"""
    try:
        success_count, fail_count = tle_fetcher.update_all_satellites()
        
        return jsonify({
            'status': 'completed',
            'success_count': success_count,
            'fail_count': fail_count,
            'message': f"Updated {success_count} satellites, {fail_count} failed"
        })
        
    except Exception as e:
        logger.error(f"Error triggering all TLE updates: {e}")
        return jsonify({'error': str(e)}), 500

# Helper function to build GeoJSON
def build_geojson_from_track(track):
    """
    Build GeoJSON from ground track data
    Segments track into past, current (visible), and future
    """
    if not track:
        return {'type': 'FeatureCollection', 'features': []}
    
    now = datetime.utcnow()
    
    # Find current position index
    current_idx = None
    for i, point in enumerate(track):
        point_time = datetime.fromisoformat(point['time'].replace('Z', ''))
        if point_time >= now:
            current_idx = i
            break
    
    if current_idx is None:
        current_idx = len(track)
    
    features = []
    
    # Past segment (before now) - gray dashed
    if current_idx > 0:
        past_coords = [[p['lng'], p['lat']] for p in track[:current_idx]]
        features.append({
            'type': 'Feature',
            'properties': {
                'segment': 'past',
                'color': '#666666',
                'style': 'dashed'
            },
            'geometry': {
                'type': 'LineString',
                'coordinates': past_coords
            }
        })
    
    # Current/visible segment (around now) - green solid
    # Take ±30 minutes around current time
    window_start = max(0, current_idx - 30)
    window_end = min(len(track), current_idx + 30)
    
    if window_end > window_start:
        current_coords = [[p['lng'], p['lat']] for p in track[window_start:window_end]]
        features.append({
            'type': 'Feature',
            'properties': {
                'segment': 'current_visible',
                'color': '#00ff00',
                'style': 'solid'
            },
            'geometry': {
                'type': 'LineString',
                'coordinates': current_coords
            }
        })
    
    # Future segment (after current window) - blue dashed
    if window_end < len(track):
        future_coords = [[p['lng'], p['lat']] for p in track[window_end:]]
        features.append({
            'type': 'Feature',
            'properties': {
                'segment': 'future',
                'color': '#0088ff',
                'style': 'dashed'
            },
            'geometry': {
                'type': 'LineString',
                'coordinates': future_coords
            }
        })
    
    return {
        'type': 'FeatureCollection',
        'features': features
    }

# Shutdown hook for scheduler
@app.teardown_appcontext
def shutdown_scheduler(exception=None):
    """Stop scheduler on app shutdown"""
    pass  # Scheduler will be stopped when process ends

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8085, debug=False)