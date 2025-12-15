from datetime import datetime, date as date_cls
from flask import Flask, request, jsonify

from .db import get_latest_tle
from .db import upsert_satellite_and_insert_tle

from .orbit import compute_passes_and_track, build_geojson_segments

app = Flask(__name__)

def parse_date(date_str: str) -> date_cls:
    return datetime.strptime(date_str, "%Y-%m-%d").date()

@app.route("/api/passes", methods=["GET"])
def get_passes():
    satellite = request.args.get("satellite", "GKT1")
    date_str = request.args.get("date")
    if not date_str:
        return jsonify({"error": "date=YYYY-MM-DD is required"}), 400

    d = parse_date(date_str)
    line1, line2 = get_latest_tle(satellite)
    if not line1:
        return jsonify({"error": f"No TLE for satellite {satellite}"}), 404

    result = compute_passes_and_track(line1, line2, d)
    now = datetime.utcnow()

    passes_out = []
    for p in result["passes"]:
        start = datetime.fromisoformat(p["start"].replace("Z", ""))
        end = datetime.fromisoformat(p["end"].replace("Z", ""))
        if end < now:
            status = "past"
        elif start <= now <= end:
            status = "ongoing"
        else:
            status = "future"

        passes_out.append({**p, "status": status})

    return jsonify({
        "satellite": satellite,
        "date": date_str,
        "passes": passes_out,
    })

@app.route("/api/tle", methods=["POST"])
def set_tle():
    body = request.get_json(force=True) or {}
    satellite = body.get("satellite", "GKT1")
    line1 = body.get("line1")
    line2 = body.get("line2")

    if not line1 or not line2:
        return jsonify({"error": "line1 and line2 are required"}), 400

    upsert_satellite_and_insert_tle(satellite, line1, line2)
    return jsonify({"status": "ok", "satellite": satellite})


@app.route("/api/groundtrack", methods=["GET"])
def get_groundtrack():
    satellite = request.args.get("satellite", "GKT1")
    date_str = request.args.get("date")
    if not date_str:
        return jsonify({"error": "date=YYYY-MM-DD is required"}), 400

    d = parse_date(date_str)
    line1, line2 = get_latest_tle(satellite)
    if not line1:
        return jsonify({"error": f"No TLE for satellite {satellite}"}), 404

    result = compute_passes_and_track(line1, line2, d)
    now = datetime.utcnow()
    geojson = build_geojson_segments(result, now)

    return jsonify({
        "satellite": satellite,
        "date": date_str,
        "geojson": geojson,
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
