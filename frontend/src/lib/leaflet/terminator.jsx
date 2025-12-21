import L from 'leaflet';

// Day/Night Terminator for Leaflet
// Based on https://github.com/marmat/leaflet-terminator

L.Terminator = L.Polygon.extend({
    options: {
        color: '#000',
        fillColor: '#000',
        fillOpacity: 0.3,
        weight: 2,
        opacity: 0.5,
        resolution: 2,
    },

    initialize: function (options) {
        this.options = L.setOptions(this, options);
        const latLngs = this._compute(this.options.time || new Date());
        L.Polygon.prototype.initialize.call(this, latLngs, this.options);
    },

    _sunEclipticPosition: function (julianDay) {
        const n = julianDay - 2451545.0;
        const L_sun = 280.460 + 0.9856474 * n;
        const g = (357.528 + 0.9856003 * n) * Math.PI / 180;
        const lambda = (L_sun + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180;

        const epsilon = (23.439 - 0.0000004 * n) * Math.PI / 180;

        const RA = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
        const delta = Math.asin(Math.sin(epsilon) * Math.sin(lambda));

        return { RA: RA, delta: delta };
    },

    _compute: function (time) {
        const julianDay = this._julianDay(time);
        const sunPos = this._sunEclipticPosition(julianDay);
        const latLngs = [];

        const R2D = 180 / Math.PI;
        const D2R = Math.PI / 180;

        const resolution = this.options.resolution;

        for (let i = 0; i <= 360 * resolution; i++) {
            const lng = -180 + i / resolution;
            const HA = this._hourAngle(lng, time, sunPos.RA) * R2D;

            const lat = Math.atan(-Math.cos(HA * D2R) / Math.tan(sunPos.delta)) * R2D;

            latLngs.push([lat, lng]);
        }

        // Close the polygon
        if (sunPos.delta < 0) {
            latLngs.push([90, -180]);
            latLngs.push([90, 180]);
        } else {
            latLngs.push([-90, -180]);
            latLngs.push([-90, 180]);
        }

        return latLngs;
    },

    _hourAngle: function (lng, time, RA) {
        const GMST = this._GMST(time);
        return GMST + lng / 15 * Math.PI / 12 - RA;
    },

    _GMST: function (date) {
        const julianDay = this._julianDay(date);
        const d = julianDay - 2451545.0;
        const T = d / 36525.0;
        let GMST = (18.697374558 + 24.06570982441908 * d + 0.000026 * T * T) % 24;
        
        if (GMST < 0) GMST += 24;
        
        return GMST * Math.PI / 12;
    },

    _julianDay: function (date) {
        const time = date.getTime() / 86400000 + 2440587.5;
        return time;
    },
});

L.terminator = function (options) {
    return new L.Terminator(options);
};

export default L.Terminator;