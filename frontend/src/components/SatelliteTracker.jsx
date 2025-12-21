import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Satellite, Globe, Radio, Loader, AlertCircle } from 'lucide-react';
import SatelliteTracketGlobe3D from './SatelliteTracketGlobe3D';

const SatelliteTracker = () => {
    const [selectedSatellite, setSelectedSatellite] = useState('GKT1');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [satelliteData, setSatelliteData] = useState(null);
    const [satellites, setSatellites] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Refs for map and globes
    const mapRef = useRef(null);
    const map2DRef = useRef(null);
    const northGlobeRef = useRef(null);
    const southGlobeRef = useRef(null);

    // Fetch available satellites on mount
    useEffect(() => {
        fetchSatellites();
    }, []);

    // Initialize 2D map
    useEffect(() => {
        if (!mapRef.current || map2DRef.current) return;

        // Create map
        map2DRef.current = L.map(mapRef.current, {
            center: [39.9334, 32.8597], // Ankara
            zoom: 3,
            zoomControl: true,
        });

        // Dark theme tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors © CARTO',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map2DRef.current);

        return () => {
            if (map2DRef.current) {
                map2DRef.current.remove();
                map2DRef.current = null;
            }
        };
    }, []);

    // Fetch available satellites
    const fetchSatellites = async () => {
        try {
            const response = await fetch('http://localhost:8085/api/satellites');
            const data = await response.json();
            setSatellites(data.satellites || []);
        } catch (err) {
            console.error('Error fetching satellites:', err);
        }
    };

    // Load satellite data
    const loadSatelliteData = async () => {
        setLoading(true);
        setError(null);

        try {
            // Fetch ground track with 3-hour duration
            const response = await fetch(
                `http://localhost:8085/api/groundtrack?satellite=${selectedSatellite}&date=${selectedDate}&duration=3`
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            console.log('Satellite data loaded:', data);
            setSatelliteData(data);
            renderTrajectoryOn2DMap(data);

        } catch (err) {
            console.error('Error loading satellite data:', err);
            setError(err.message || 'Veri yüklenirken hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    // Render trajectory on 2D Leaflet map
    const renderTrajectoryOn2DMap = (data) => {
        if (!map2DRef.current || !data?.geojson?.features) return;

        // Clear existing layers (except base tile layer)
        map2DRef.current.eachLayer((layer) => {
            if (layer instanceof L.Polyline || 
                layer instanceof L.Circle || 
                layer instanceof L.Marker || 
                layer instanceof L.CircleMarker) {
                map2DRef.current.removeLayer(layer);
            }
        });

        const features = data.geojson.features;
        let currentPosition = null;

        features.forEach((feature) => {
            if (feature.geometry.type !== 'LineString') return;

            const coords = feature.geometry.coordinates;
            // Convert [lng, lat] to [lat, lng] for Leaflet
            const latLngs = coords.map(coord => [coord[1], coord[0]]);

            const segment = feature.properties?.segment;
            let color, weight, dashArray, opacity;

            switch(segment) {
                case 'past':
                    color = '#666666';
                    weight = 2;
                    dashArray = '5, 5';
                    opacity = 0.6;
                    break;
                case 'current_visible':
                    color = '#00ff00';
                    weight = 3;
                    dashArray = null;
                    opacity = 1;
                    // Save first point as current position
                    if (coords.length > 0) {
                        currentPosition = [coords[0][1], coords[0][0]];
                    }
                    break;
                case 'future':
                    color = '#0088ff';
                    weight = 2;
                    dashArray = '10, 5';
                    opacity = 0.7;
                    break;
                default:
                    color = '#ffffff';
                    weight = 2;
                    dashArray = null;
                    opacity = 0.5;
            }

            // Draw polyline
            L.polyline(latLngs, {
                color: color,
                weight: weight,
                dashArray: dashArray,
                opacity: opacity
            }).addTo(map2DRef.current);
        });

        // Add current position marker and footprint
        if (currentPosition) {
            // Satellite marker
            L.circleMarker(currentPosition, {
                radius: 8,
                fillColor: '#00ff00',
                color: '#ffffff',
                weight: 2,
                opacity: 1,
                fillOpacity: 1
            }).addTo(map2DRef.current);

            // Communication footprint (3000km radius)
            L.circle(currentPosition, {
                radius: 3000000, // meters
                color: '#00ff00',
                fillColor: '#00ff00',
                fillOpacity: 0.1,
                weight: 2,
                opacity: 0.6,
                dashArray: '10, 5'
            }).addTo(map2DRef.current);

            // Center map on current position
            map2DRef.current.setView(currentPosition, 4);
        }
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerLeft}>
                    <Satellite size={24} style={{ color: '#667eea' }} />
                    <h2 style={styles.title}>Uydu İzleme Sistemi</h2>
                </div>

                <div style={styles.controls}>
                    <div style={styles.controlGroup}>
                        <label style={styles.label}>Uydu:</label>
                        <select
                            value={selectedSatellite}
                            onChange={(e) => setSelectedSatellite(e.target.value)}
                            style={styles.select}
                            disabled={loading}
                        >
                            {satellites.length > 0 ? (
                                satellites.map(sat => (
                                    <option key={sat.name} value={sat.name}>
                                        {sat.name}
                                    </option>
                                ))
                            ) : (
                                <>
                                    <option value="GKT1">GKT1</option>
                                    <option value="GKT2">GKT2</option>
                                    <option value="TURKSAT5A">TURKSAT5A</option>
                                    <option value="TURKSAT5B">TURKSAT5B</option>
                                    <option value="IMECE">IMECE</option>
                                </>
                            )}
                        </select>
                    </div>

                    <div style={styles.controlGroup}>
                        <label style={styles.label}>Tarih:</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            style={styles.dateInput}
                            disabled={loading}
                        />
                    </div>

                    <button
                        onClick={loadSatelliteData}
                        disabled={loading}
                        style={{
                            ...styles.button,
                            opacity: loading ? 0.6 : 1,
                            cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {loading ? (
                            <>
                                <Loader size={18} className="spin" />
                                Yükleniyor...
                            </>
                        ) : (
                            <>
                                <Radio size={18} />
                                Yükle
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div style={styles.error}>
                    <AlertCircle size={20} />
                    <span>Hata: {error}</span>
                </div>
            )}

            {/* Info Message */}
            {!satelliteData && !error && !loading && (
                <div style={styles.info}>
                    <Satellite size={20} />
                    <span>Uydu verilerini görmek için tarih seçip "Yükle" butonuna basın</span>
                </div>
            )}

            {/* 2D Map */}
            <div style={styles.mapSection}>
                <div style={styles.sectionHeader}>
                    <Globe size={20} />
                    <span>2D Dünya Haritası - Yer İzi</span>
                    {satelliteData && (
                        <span style={styles.pointCount}>
                            {satelliteData.points_count} nokta
                        </span>
                    )}
                </div>
                <div ref={mapRef} style={styles.map} />
            </div>

            {/* 3D Globes */}
            <div style={styles.globeSection}>
                {/* North Globe */}
                <div style={styles.globeContainer}>
                    <div style={styles.globeHeader}>
                        <Globe size={16} />
                        <span>Kuzey Görünümü</span>
                    </div>
                    <div ref={northGlobeRef} style={styles.globeCanvas}>
                        {/* Globe3D renders into this div via ref */}
                    </div>
                </div>

                {/* South Globe */}
                <div style={styles.globeContainer}>
                    <div style={styles.globeHeader}>
                        <Globe size={16} />
                        <span>Güney Görünümü</span>
                    </div>
                    <div ref={southGlobeRef} style={styles.globeCanvas}>
                        {/* Globe3D renders into this div via ref */}
                    </div>
                </div>
            </div>

            {/* Render Globe3D components (they will render into the refs above) */}
            {northGlobeRef.current && (
                <SatelliteTracketGlobe3D
                    satelliteData={satelliteData}
                    viewType="north"
                    containerRef={northGlobeRef}
                />
            )}
            
            {southGlobeRef.current && (
                <SatelliteTracketGlobe3D
                    satelliteData={satelliteData}
                    viewType="south"
                    containerRef={southGlobeRef}
                />
            )}

            {/* CSS for spin animation */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </div>
    );
};

// Styles
const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: '#0a0e27',
        color: '#fff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 1.5rem',
        backgroundColor: '#1a1f3a',
        borderBottom: '1px solid #2a3f5f',
        flexShrink: 0,
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
    },
    title: {
        margin: 0,
        fontSize: '1.5rem',
        fontWeight: '600',
    },
    controls: {
        display: 'flex',
        gap: '1rem',
        alignItems: 'center',
    },
    controlGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    label: {
        fontSize: '0.9rem',
        color: '#8892b0',
    },
    select: {
        padding: '0.5rem 1rem',
        backgroundColor: '#2a3f5f',
        color: '#fff',
        border: '1px solid #3a4f6f',
        borderRadius: '6px',
        fontSize: '0.9rem',
        cursor: 'pointer',
        outline: 'none',
    },
    dateInput: {
        padding: '0.5rem 1rem',
        backgroundColor: '#2a3f5f',
        color: '#fff',
        border: '1px solid #3a4f6f',
        borderRadius: '6px',
        fontSize: '0.9rem',
        outline: 'none',
    },
    button: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1.5rem',
        backgroundColor: '#667eea',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '0.9rem',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    error: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        margin: '1rem 1.5rem 0 1.5rem',
        padding: '1rem',
        backgroundColor: '#ff6b6b',
        color: '#fff',
        borderRadius: '6px',
        fontSize: '0.9rem',
    },
    info: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        margin: '1rem 1.5rem 0 1.5rem',
        padding: '1rem',
        backgroundColor: '#2a3f5f',
        color: '#8892b0',
        borderRadius: '6px',
        fontSize: '0.9rem',
    },
    mapSection: {
        flex: 2,
        display: 'flex',
        flexDirection: 'column',
        margin: '1rem',
        backgroundColor: '#1a1f3a',
        borderRadius: '8px',
        border: '1px solid #2a3f5f',
        overflow: 'hidden',
        minHeight: 0,
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1rem',
        backgroundColor: '#2a3f5f',
        borderBottom: '1px solid #3a4f6f',
        fontSize: '0.9rem',
        fontWeight: '500',
        flexShrink: 0,
    },
    pointCount: {
        marginLeft: 'auto',
        fontSize: '0.85rem',
        color: '#8892b0',
    },
    map: {
        flex: 1,
        width: '100%',
        minHeight: 0,
    },
    globeSection: {
        flex: 1,
        display: 'flex',
        gap: '1rem',
        margin: '0 1rem 1rem 1rem',
        minHeight: 0,
    },
    globeContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1a1f3a',
        borderRadius: '8px',
        border: '1px solid #2a3f5f',
        overflow: 'hidden',
        minHeight: 0,
    },
    globeHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1rem',
        backgroundColor: '#2a3f5f',
        borderBottom: '1px solid #3a4f6f',
        fontSize: '0.9rem',
        fontWeight: '500',
        flexShrink: 0,
    },
    globeCanvas: {
        flex: 1,
        width: '100%',
        minHeight: 0,
        position: 'relative',
    },
};

export default SatelliteTracker;