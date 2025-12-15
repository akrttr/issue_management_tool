from datetime import datetime, timedelta, date as date_cls, timezone
from typing import List, Dict, Any

import numpy as np
from skyfield.api import EarthSatellite, load, wgs84
from .config import Config


ts = load.timescale()

def _satellite_from_tle(line1: str, line2: str) -> EarthSatellite:
    return EarthSatellite(line1, line2, "sat", ts)

def _time_range_for_day(day: date_cls, step_seconds: int = 30):
    """Generate Skyfield Time objects for a given UTC day."""
    start_dt = datetime(day.year, day.month, day.day, 0, 0, 0, tzinfo=timezone.utc)

    dt_list = []
    for i in range(0, 24 * 3600, step_seconds):
        dt_list.append(start_dt + timedelta(seconds=i))

    # Skyfield can take a list of timezone-aware datetimes
    skyfield_times = ts.from_datetimes(dt_list)

    return dt_list, skyfield_times


def compute_passes_and_track(line1: str, line2: str, day: date_cls) -> Dict[str, Any]:
    """
    Returns:
      {
        "samples": [
          {
            "time": iso,
            "lat": float,
            "lon": float,
            "elev_deg": float,
            "visible_from_ankara": bool
          },
          ...
        ],
        "passes": [
          { "start": iso, "end": iso, "max_elev_deg": float },
          ...
        ]
      }
    """
    sat = _satellite_from_tle(line1, line2)
    ankara = wgs84.latlon(Config.ANKARA_LAT, Config.ANKARA_LON)

    python_times, skyfield_times = _time_range_for_day(day, step_seconds=30)

    # satellite position in time
    geocentric = sat.at(skyfield_times)

    # subpoint
    subpoint = wgs84.subpoint(geocentric)
    lats = subpoint.latitude.degrees
    lons = subpoint.longitude.degrees

    # elevation from Ankara
    difference = sat - ankara
    topocentric = difference.at(skyfield_times)
    alt, az, distance = topocentric.altaz()
    elev_deg = alt.degrees

    samples = []
    for dt, lat, lon, elev in zip(python_times, lats, lons, elev_deg):
        samples.append({
            "time": dt.replace(tzinfo=None).isoformat() + "Z",
            "lat": float(lat),
            "lon": float(lon),
            "elev_deg": float(elev),
            "visible_from_ankara": elev >= Config.MIN_ELEV_DEG,
        })

    # detect passes where elevation > threshold
    passes = []
    in_pass = False
    pass_start = None
    max_elev = -90.0
    max_elev_time = None

    for s in samples:
        visible = s["visible_from_ankara"]
        if visible and not in_pass:
            in_pass = True
            pass_start = s["time"]
            max_elev = s["elev_deg"]
            max_elev_time = s["time"]
        elif visible and in_pass:
            if s["elev_deg"] > max_elev:
                max_elev = s["elev_deg"]
                max_elev_time = s["time"]
        elif not visible and in_pass:
            # pass ended at previous sample
            in_pass = False
            passes.append({
                "start": pass_start,
                "end": s["time"],
                "max_elev_deg": max_elev,
                "max_elev_time": max_elev_time,
            })

    return {"samples": samples, "passes": passes}

def build_geojson_segments(data: Dict[str, Any], now: datetime) -> Dict[str, Any]:
    """
    Convert samples + passes into GeoJSON segments: past, current_visible, future.
    """
    samples = data["samples"]

    # classify per-sample in time
    coords_past = []
    coords_current = []
    coords_future = []

    for s in samples:
        t = datetime.fromisoformat(s["time"].replace("Z", ""))
        coord = [s["lon"], s["lat"]]  # lon, lat
        if t < now:
            coords_past.append(coord)
        else:
            coords_future.append(coord)

        if s["visible_from_ankara"]:
            # treat visible samples separately for highlighting
            coords_current.append(coord)

    def make_feature(coords, segment_name):
        if not coords:
            return None
        return {
            "type": "Feature",
            "properties": {"segment": segment_name},
            "geometry": {
                "type": "LineString",
                "coordinates": coords,
            },
        }

    features = []
    for name, coords in [
        ("past", coords_past),
        ("current_visible", coords_current),
        ("future", coords_future),
    ]:
        f = make_feature(coords, name)
        if f:
            features.append(f)

    return {
        "type": "FeatureCollection",
        "features": features,
    }
