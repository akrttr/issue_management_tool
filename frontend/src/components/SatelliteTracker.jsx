import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Satellite, Globe, Radio, Loader } from 'lucide-react';

const SatelliteTracker = () => {
    const [selectedSatellite, setSelectedSatellite] = useState('GKT1');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [satelliteData, setSatelliteData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Refs for map and globes
    const mapRef = useRef(null);
    const map2DRef = useRef(null);
    const northGlobeRef = useRef(null);
    const southGlobeRef = useRef(null);

    // Cleanup map on unmount
    useEffect(() => {
        return () => {
            if (map2DRef.current) {
                map2DRef.current.remove();
                map2DRef.current = null;
            }
        };
    }, []);

    // Initialize 2D map
    useEffect(() => {
        if (!mapRef.current) return;

        // Remove existing map if any
        if (map2DRef.current) {
            map2DRef.current.remove();
        }

        // Create new map
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

    }, []);

    // Load satellite data
    const loadSatelliteData = async () => {
        setLoading(true);
        setError(null);

        try {
            const formattedDate = selectedDate.toISOString().split('T')[0];
            const response = await fetch(
                `http://localhost:8085/api/groundtrack?date=${formattedDate}&satellite=${selectedSatellite}`
            );

            if (!response.ok) throw new Error('Veri alınamadı');

            const data = await response.json();
            
            // Filter to show only relevant time window (±3 hours)
            const filteredData = filterDataByTimeWindow(data, 3);
            setSatelliteData(filteredData);
            
        } catch (err) {
            setError(err.message);
            console.error('Satellite data error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Filter data to time window around current time
    const filterDataByTimeWindow = (data, windowHours) => {
        if (!data.geojson || !data.geojson.features) return data;

        const now = new Date();
        const windowMs = windowHours * 60 * 60 * 1000;
        
        // For each feature, take only a portion of coordinates
        const filteredFeatures = data.geojson.features.map(feature => {
            if (feature.geometry.type === 'LineString') {
                const coords = feature.geometry.coordinates;
                const totalPoints = coords.length;
                
                // Take middle section of trajectory (simulating time window)
                const windowSize = Math.floor(totalPoints / 6); // Show ~1/6 of trajectory
                const midPoint = Math.floor(totalPoints / 2);
                const startIdx = Math.max(0, midPoint - windowSize);
                const endIdx = Math.min(totalPoints, midPoint + windowSize);
                
                return {
                    ...feature,
                    geometry: {
                        ...feature.geometry,
                        coordinates: coords.slice(startIdx, endIdx)
                    }
                };
            }
            return feature;
        }).filter(f => f.geometry.coordinates && f.geometry.coordinates.length > 0);

        return {
            ...data,
            geojson: {
                ...data.geojson,
                features: filteredFeatures
            }
        };
    };

    // Render trajectory on 2D map
    useEffect(() => {
        if (!satelliteData || !map2DRef.current) return;

        // Clear existing layers (except base tile layer)
        map2DRef.current.eachLayer((layer) => {
            if (layer instanceof L.Polyline || layer instanceof L.CircleMarker || layer instanceof L.Circle) {
                map2DRef.current.removeLayer(layer);
            }
        });

        const geojson = satelliteData.geojson;
        if (!geojson || !geojson.features) return;

        let currentPosition = null;

        // Render each trajectory segment
        geojson.features.forEach((feature) => {
            if (feature.geometry.type === 'LineString') {
                const coords = feature.geometry.coordinates;
                
                // Convert [lng, lat] to [lat, lng] for Leaflet
                const latLngs = coords.map(coord => [coord[1], coord[0]]);

                // Style based on segment type
                const segmentType = feature.properties?.segment || 'unknown';
                let style = {
                    color: '#00ff00',
                    weight: 3,
                    opacity: 0.8,
                };

                if (segmentType === 'past') {
                    style = {
                        color: '#666666',
                        weight: 2,
                        opacity: 0.6,
                        dashArray: '5, 5',
                    };
                } else if (segmentType === 'current_visible') {
                    style = {
                        color: '#00ff00',
                        weight: 3,
                        opacity: 1,
                    };
                    // Save first point as current position
                    if (coords.length > 0) {
                        currentPosition = [coords[0][1], coords[0][0]];
                    }
                } else if (segmentType === 'future') {
                    style = {
                        color: '#0088ff',
                        weight: 2,
                        opacity: 0.7,
                        dashArray: '10, 5',
                    };
                }

                // Draw polyline
                L.polyline(latLngs, style).addTo(map2DRef.current);
            }
        });

        // Add current position marker
        if (currentPosition) {
            // Satellite marker
            L.circleMarker(currentPosition, {
                radius: 8,
                fillColor: '#00ff00',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 1,
            }).addTo(map2DRef.current);

            // Communication footprint (3000km radius)
            L.circle(currentPosition, {
                radius: 3000000, // 3000 km in meters
                color: '#00ff00',
                weight: 2,
                opacity: 0.6,
                fillOpacity: 0.1,
                dashArray: '10, 5',
            }).addTo(map2DRef.current);

            // Center map on current position
            map2DRef.current.setView(currentPosition, 4);
        }

    }, [satelliteData]);

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
                        >
                            <option value="GKT1">GKT1</option>
                            <option value="GKT2">GKT2</option>
                        </select>
                    </div>

                    <div style={styles.controlGroup}>
                        <label style={styles.label}>Tarih:</label>
                        <input
                            type="date"
                            value={selectedDate.toISOString().split('T')[0]}
                            onChange={(e) => setSelectedDate(new Date(e.target.value))}
                            style={styles.dateInput}
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
                                <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
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
                    ⚠️ Hata: {error}
                </div>
            )}

            {/* 2D Map */}
            <div style={styles.mapSection}>
                <div style={styles.sectionHeader}>
                    <Globe size={20} />
                    <span>2D Dünya Haritası - Yer İzi</span>
                </div>
                <div ref={mapRef} style={styles.map} />
            </div>

            {/* 3D Globes */}
            <div style={styles.globeSection}>
                <Globe3D
                    satelliteData={satelliteData}
                    viewType="north"
                    containerRef={northGlobeRef}
                    title="Kuzey Görünümü"
                />
                <Globe3D
                    satelliteData={satelliteData}
                    viewType="south"
                    containerRef={southGlobeRef}
                    title="Güney Görünümü"
                />
            </div>
        </div>
    );
};

// Globe 3D Component
const Globe3D = ({ satelliteData, viewType, containerRef, title }) => {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const animationIdRef = useRef(null);

    useEffect(() => {
        if (!mountRef.current) return;

        // Scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0e27);
        sceneRef.current = scene;

        // Camera
        const aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
        const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        camera.position.z = viewType === 'north' ? 3 : -3;
        camera.position.y = viewType === 'north' ? 2 : -2;
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 1.5;
        controls.maxDistance = 10;
        controlsRef.current = controls;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xffffff, 1, 0);
        pointLight.position.set(5, 3, 5);
        scene.add(pointLight);

        // Earth globe
        const geometry = new THREE.SphereGeometry(1, 64, 64);
        const textureLoader = new THREE.TextureLoader();
        
        textureLoader.load(
            'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
            (texture) => {
                const material = new THREE.MeshPhongMaterial({
                    map: texture,
                    bumpScale: 0.05,
                    specular: new THREE.Color(0x333333),
                    shininess: 15,
                });
                const globe = new THREE.Mesh(geometry, material);
                globe.name = 'earth';
                scene.add(globe);
            }
        );

        // Animation loop
        const animate = () => {
            animationIdRef.current = requestAnimationFrame(animate);
            
            // Rotate globe slowly
            const earth = scene.getObjectByName('earth');
            if (earth) {
                earth.rotation.y += 0.001;
            }

            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // Handle window resize
        const handleResize = () => {
            if (!mountRef.current) return;
            
            const width = mountRef.current.clientWidth;
            const height = mountRef.current.clientHeight;
            
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
            }
            if (controlsRef.current) {
                controlsRef.current.dispose();
            }
            if (rendererRef.current) {
                rendererRef.current.dispose();
            }
            if (mountRef.current && rendererRef.current) {
                mountRef.current.removeChild(rendererRef.current.domElement);
            }
        };
    }, [viewType]);

    // Render trajectory on globe
    useEffect(() => {
        if (!satelliteData || !sceneRef.current) return;

        const scene = sceneRef.current;

        // Remove old trajectory and markers
        const objectsToRemove = [];
        scene.traverse((object) => {
            if (object.name === 'trajectory' || object.name === 'satellite-marker' || object.name === 'comm-cone') {
                objectsToRemove.push(object);
            }
        });
        objectsToRemove.forEach(obj => {
            scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });

        const geojson = satelliteData.geojson;
        if (!geojson || !geojson.features) return;

        let currentPosition = null;

        // Render trajectory
        geojson.features.forEach((feature) => {
            if (feature.geometry.type === 'LineString') {
                const coords = feature.geometry.coordinates;
                const points = [];

                coords.forEach(coord => {
                    const [lng, lat] = coord;
                    const point = latLngToVector3(lat, lng, 1.01);
                    points.push(point);
                });

                if (points.length < 2) return;

                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                
                const segmentType = feature.properties?.segment || 'unknown';
                let color = 0x00ff00;
                
                if (segmentType === 'past') color = 0x666666;
                else if (segmentType === 'current_visible') {
                    color = 0x00ff00;
                    currentPosition = points[0];
                }
                else if (segmentType === 'future') color = 0x0088ff;

                const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });
                const line = new THREE.Line(geometry, material);
                line.name = 'trajectory';
                scene.add(line);
            }
        });

        // Add satellite marker and communication cone
        if (currentPosition) {
            // Satellite marker (small sphere)
            const markerGeometry = new THREE.SphereGeometry(0.03, 16, 16);
            const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.position.copy(currentPosition);
            marker.name = 'satellite-marker';
            scene.add(marker);

            // Communication cone
            const coneGeometry = new THREE.ConeGeometry(0.5, 0.8, 32);
            const coneMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: 0.2,
                side: THREE.DoubleSide,
            });
            const cone = new THREE.Mesh(coneGeometry, coneMaterial);
            cone.position.copy(currentPosition);
            
            // Orient cone toward Earth center
            cone.lookAt(0, 0, 0);
            cone.rotateX(Math.PI / 2);
            cone.name = 'comm-cone';
            scene.add(cone);

            // Wireframe cone for better visibility
            const wireframeGeometry = new THREE.ConeGeometry(0.5, 0.8, 32);
            const wireframeMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                wireframe: true,
                transparent: true,
                opacity: 0.6,
            });
            const wireframeCone = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
            wireframeCone.position.copy(currentPosition);
            wireframeCone.lookAt(0, 0, 0);
            wireframeCone.rotateX(Math.PI / 2);
            wireframeCone.name = 'comm-cone';
            scene.add(wireframeCone);
        }

    }, [satelliteData]);

    // Convert lat/lng to 3D coordinates
    const latLngToVector3 = (lat, lng, radius) => {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lng + 180) * (Math.PI / 180);

        const x = -(radius * Math.sin(phi) * Math.cos(theta));
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);

        return new THREE.Vector3(x, y, z);
    };

    return (
        <div style={styles.globeContainer}>
            <div style={styles.globeHeader}>
                <Globe size={16} />
                <span>{title}</span>
            </div>
            <div ref={mountRef} style={styles.globeCanvas} />
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
        margin: '1rem 1.5rem',
        padding: '1rem',
        backgroundColor: '#ff6b6b',
        color: '#fff',
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
    },
    map: {
        flex: 1,
        width: '100%',
    },
    globeSection: {
        flex: 1,
        display: 'flex',
        gap: '1rem',
        margin: '0 1rem 1rem 1rem',
    },
    globeContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1a1f3a',
        borderRadius: '8px',
        border: '1px solid #2a3f5f',
        overflow: 'hidden',
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
    },
    globeCanvas: {
        flex: 1,
        width: '100%',
    },
};

export default SatelliteTracker;