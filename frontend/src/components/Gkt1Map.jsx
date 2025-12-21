import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// import '../lib/leaflet/terminator'

// Fix default marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const ANKARA_COORDS = [39.9334, 32.8597];
const ELEVATION_MASK = 10; // degrees

export default function Gkt1Map({ currentPosition, track, passes }) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const layersRef = useRef({
        coverage: null,
        satellite: null,
        trajectory: null,
        terminator: null,
        commCone: null,
    });
    
    const [showTrajectory, setShowTrajectory] = useState(true);

    // Initialize map
    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        const map = L.map(mapRef.current, {
            center: [20, 0],
            zoom: 2,
            minZoom: 2,
            maxZoom: 10,
        });
        mapInstanceRef.current = map;

        // Base map layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
        }).addTo(map);

        // Ground station marker
        const gsIcon = L.divIcon({
            className: 'ground-station-marker',
            html: '<div style="background: #667eea; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 2px #667eea;"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
        });

        L.marker(ANKARA_COORDS, { icon: gsIcon })
            .addTo(map)
            .bindPopup('<b>Ankara Yer İstasyonu</b><br/>39.9334°N, 32.8597°E');

        // Add legend
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = function () {
            const div = L.DomUtil.create('div', 'leaflet-legend');
            div.style.cssText = `
                background: white;
                padding: 12px;
                border-radius: 6px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                font-size: 12px;
                line-height: 1.8;
            `;
            
            div.innerHTML = `
                <div style="margin-bottom: 8px; font-weight: bold;">Açıklama</div>
                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                    <div style="width: 24px; height: 3px; background: #667eea; margin-right: 8px;"></div>
                    <span>Uydu Yörüngesi</span>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                    <div style="width: 14px; height: 14px; background: red; border-radius: 50%; border: 2px solid white; margin-right: 8px;"></div>
                    <span>Uydu Konumu</span>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                    <div style="width: 24px; height: 3px; background: #667eea; opacity: 0.3; margin-right: 8px;"></div>
                    <span>Kapsama Alanı</span>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                    <div style="width: 24px; height: 3px; background: #ff6b6b; opacity: 0.4; margin-right: 8px;"></div>
                    <span>İletişim Konisi</span>
                </div>
                <div style="display: flex; align-items: center;">
                    <div style="width: 24px; height: 3px; background: #000; opacity: 0.5; margin-right: 8px;"></div>
                    <span>Gece Bölgesi</span>
                </div>
            `;
            
            return div;
        };
        legend.addTo(map);

        // Update terminator every 30 seconds
        const updateTerminator = () => {
            if (layersRef.current.terminator) {
                map.removeLayer(layersRef.current.terminator);
            }
            
            const termCoords = calculateTerminator(new Date());
            layersRef.current.terminator = L.polygon(termCoords, {
                color: '#000',
                weight: 2,
                fillColor: '#000',
                fillOpacity: 0.25,
                interactive: false,
            }).addTo(map);
        };

        updateTerminator();
        const terminatorInterval = setInterval(updateTerminator, 30000);

        return () => {
            clearInterval(terminatorInterval);
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Update trajectory
    useEffect(() => {
        if (!mapInstanceRef.current || !track || track.length === 0) return;

        const map = mapInstanceRef.current;

        // Remove old trajectory
        if (layersRef.current.trajectory) {
            map.removeLayer(layersRef.current.trajectory);
            layersRef.current.trajectory = null;
        }

        if (showTrajectory) {
            // Split trajectory at dateline crossings
            const segments = [];
            let currentSegment = [];

            for (let i = 0; i < track.length; i++) {
                const point = [track[i].latitude, track[i].longitude];
                
                if (i > 0) {
                    const prevLon = track[i - 1].longitude;
                    const currLon = track[i].longitude;
                    
                    // Detect dateline crossing (large longitude jump)
                    if (Math.abs(currLon - prevLon) > 180) {
                        if (currentSegment.length > 0) {
                            segments.push(currentSegment);
                        }
                        currentSegment = [point];
                        continue;
                    }
                }
                
                currentSegment.push(point);
            }
            
            if (currentSegment.length > 0) {
                segments.push(currentSegment);
            }

            // Create multi-polyline
            layersRef.current.trajectory = L.layerGroup();
            
            segments.forEach(segment => {
                if (segment.length > 1) {
                    L.polyline(segment, {
                        color: '#667eea',
                        weight: 3,
                        opacity: 0.8,
                    }).addTo(layersRef.current.trajectory);
                }
            });

            layersRef.current.trajectory.addTo(map);
        }

    }, [track, showTrajectory]);

    // Update satellite position, coverage, and communication cone
    useEffect(() => {
        if (!mapInstanceRef.current || !currentPosition) return;

        const map = mapInstanceRef.current;

        // Remove old layers
        if (layersRef.current.satellite) {
            map.removeLayer(layersRef.current.satellite);
        }
        if (layersRef.current.coverage) {
            map.removeLayer(layersRef.current.coverage);
        }
        if (layersRef.current.commCone) {
            map.removeLayer(layersRef.current.commCone);
        }

        // Satellite marker
        const satIcon = L.divIcon({
            className: 'satellite-marker',
            html: '<div style="background: red; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(255,0,0,0.6);"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
        });

        layersRef.current.satellite = L.marker(
            [currentPosition.latitude, currentPosition.longitude],
            { icon: satIcon }
        )
            .addTo(map)
            .bindPopup(`
                <b>GKT1</b><br/>
                Enlem: ${currentPosition.latitude.toFixed(4)}°<br/>
                Boylam: ${currentPosition.longitude.toFixed(4)}°<br/>
                Yükseklik: ${currentPosition.altitude.toFixed(1)} km<br/>
                Hız: ${currentPosition.velocity?.toFixed(2) || 'N/A'} km/s
            `);

        // Coverage footprint (horizon circle)
        const altitude = currentPosition.altitude;
        const earthRadius = 6371;

        const horizonAngle = Math.acos(earthRadius / (earthRadius + altitude));
        const horizonRadius = earthRadius * horizonAngle * 1000; // meters

        layersRef.current.coverage = L.circle(
            [currentPosition.latitude, currentPosition.longitude],
            {
                radius: horizonRadius,
                color: '#667eea',
                fillColor: '#667eea',
                fillOpacity: 0.1,
                weight: 2,
                opacity: 0.5,
            }
        ).addTo(map);

        // Communication cone (visibility from Ankara with elevation mask)
        const elevationRad = (ELEVATION_MASK * Math.PI) / 180;
        const commAngle = Math.acos(earthRadius / (earthRadius + altitude)) - elevationRad;
        
        if (commAngle > 0) {
            const commRadius = earthRadius * commAngle * 1000; // meters
            
            layersRef.current.commCone = L.circle(
                [currentPosition.latitude, currentPosition.longitude],
                {
                    radius: commRadius,
                    color: '#ff6b6b',
                    fillColor: '#ff6b6b',
                    fillOpacity: 0.15,
                    weight: 2,
                    opacity: 0.6,
                    dashArray: '5, 5',
                }
            ).addTo(map);
        }

        // Check if Ankara is in communication range
        const isInRange = isGroundStationInRange(
            currentPosition.latitude,
            currentPosition.longitude,
            currentPosition.altitude,
            ANKARA_COORDS[0],
            ANKARA_COORDS[1],
            ELEVATION_MASK
        );

        if (isInRange) {
            // Draw line from satellite to Ankara
            const line = L.polyline([
                [currentPosition.latitude, currentPosition.longitude],
                ANKARA_COORDS
            ], {
                color: '#4CAF50',
                weight: 2,
                opacity: 0.7,
                dashArray: '5, 10',
            }).addTo(layersRef.current.commCone || map);
        }

    }, [currentPosition]);

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setShowTrajectory(!showTrajectory)}
                style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    zIndex: 1000,
                    padding: '10px 18px',
                    background: showTrajectory ? '#667eea' : 'white',
                    color: showTrajectory ? 'white' : '#667eea',
                    border: '2px solid #667eea',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                    transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
                }}
                onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
                }}
            >
                {showTrajectory ? '✓ Yörünge Gösteriliyor' : 'Yörüngeyi Göster'}
            </button>

            <div
                ref={mapRef}
                style={{
                    width: '100%',
                    height: '500px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                }}
            />
        </div>
    );
}

// Helper: Calculate day/night terminator
function calculateTerminator(date) {
    const julianDay = date.getTime() / 86400000 + 2440587.5;
    const n = julianDay - 2451545.0;
    
    // Solar position
    const L = (280.460 + 0.9856474 * n) % 360;
    const g = (357.528 + 0.9856003 * n) * Math.PI / 180;
    const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180;
    const epsilon = (23.439 - 0.0000004 * n) * Math.PI / 180;
    
    const RA = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
    const delta = Math.asin(Math.sin(epsilon) * Math.sin(lambda));
    
    const coords = [];
    const resolution = 2;
    
    for (let i = 0; i <= 360 * resolution; i++) {
        const lng = -180 + i / resolution;
        const HA = hourAngle(lng, date, RA);
        const lat = Math.atan(-Math.cos(HA) / Math.tan(delta)) * 180 / Math.PI;
        
        if (!isNaN(lat) && Math.abs(lat) <= 90) {
            coords.push([lat, lng]);
        }
    }
    
    // Close the polygon on the dark side
    if (delta < 0) {
        coords.push([90, 180]);
        coords.push([90, -180]);
    } else {
        coords.push([-90, 180]);
        coords.push([-90, -180]);
    }
    
    return coords;
}

function hourAngle(lng, date, RA) {
    const julianDay = date.getTime() / 86400000 + 2440587.5;
    const d = julianDay - 2451545.0;
    const T = d / 36525.0;
    let GMST = (18.697374558 + 24.06570982441908 * d + 0.000026 * T * T) % 24;
    
    if (GMST < 0) GMST += 24;
    
    const LST = GMST + lng / 15;
    return (LST * Math.PI / 12) - RA;
}

// Helper: Check if ground station can see satellite
function isGroundStationInRange(satLat, satLon, satAlt, gsLat, gsLon, minElevation) {
    const earthRadius = 6371; // km
    
    // Convert to radians
    const satLatRad = satLat * Math.PI / 180;
    const satLonRad = satLon * Math.PI / 180;
    const gsLatRad = gsLat * Math.PI / 180;
    const gsLonRad = gsLon * Math.PI / 180;
    
    // Ground station position (ECEF)
    const gsX = earthRadius * Math.cos(gsLatRad) * Math.cos(gsLonRad);
    const gsY = earthRadius * Math.cos(gsLatRad) * Math.sin(gsLonRad);
    const gsZ = earthRadius * Math.sin(gsLatRad);
    
    // Satellite position (ECEF)
    const satR = earthRadius + satAlt;
    const satX = satR * Math.cos(satLatRad) * Math.cos(satLonRad);
    const satY = satR * Math.cos(satLatRad) * Math.sin(satLonRad);
    const satZ = satR * Math.sin(satLatRad);
    
    // Vector from ground station to satellite
    const dx = satX - gsX;
    const dy = satY - gsY;
    const dz = satZ - gsZ;
    
    // Distance
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Local zenith vector at ground station
    const zenithX = Math.cos(gsLatRad) * Math.cos(gsLonRad);
    const zenithY = Math.cos(gsLatRad) * Math.sin(gsLonRad);
    const zenithZ = Math.sin(gsLatRad);
    
    // Dot product to find elevation angle
    const dotProduct = (dx * zenithX + dy * zenithY + dz * zenithZ) / distance;
    const elevationRad = Math.asin(dotProduct);
    const elevationDeg = elevationRad * 180 / Math.PI;
    
    return elevationDeg >= minElevation;
}