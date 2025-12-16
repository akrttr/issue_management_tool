// Add these imports at the top
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Inside SatelliteTracker component
useEffect(() => {
    if (!mapRef.current) return;
    
    // Initialize map
    map2DRef.current = L.map(mapRef.current, {
        center: [39.9334, 32.8597], // Ankara coordinates
        zoom: 3,
        zoomControl: true,
    });

    // Dark theme tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map2DRef.current);

    return () => {
        if (map2DRef.current) {
            map2DRef.current.remove();
        }
    };
}, []);

// Function to load satellite data
const loadSatelliteData = async () => {
    try {
        setLoading(true);
        const response = await fetch(
            `http://localhost:8085/api/groundtrack?date=${selectedDate}&satellite=${selectedSatellite}`
        );
        const data = await response.json();
        setSatelliteData(data);
        renderTrajectory(data);
    } catch (error) {
        console.error('Error loading satellite data:', error);
        alert('Uydu verileri yüklenirken hata oluştu');
    } finally {
        setLoading(false);
    }
};

// Function to render trajectory on map
const renderTrajectory = (data) => {
    if (!map2DRef.current || !data) return;

    // Clear existing layers
    map2DRef.current.eachLayer((layer) => {
        if (layer instanceof L.Polyline || layer instanceof L.Circle || layer instanceof L.Marker) {
            map2DRef.current.removeLayer(layer);
        }
    });

    const features = data.geojson.features;

    features.forEach((feature) => {
        const coords = feature.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        const segment = feature.properties.segment;

        let color, weight, dashArray;
        
        switch(segment) {
            case 'past':
                color = '#666';
                weight = 2;
                dashArray = '5, 5';
                break;
            case 'current_visible':
                color = '#00ff00';
                weight = 3;
                dashArray = null;
                break;
            case 'future':
                color = '#0088ff';
                weight = 2;
                dashArray = '10, 5';
                break;
        }

        const polyline = L.polyline(coords, {
            color: color,
            weight: weight,
            dashArray: dashArray,
            opacity: 0.8
        }).addTo(map2DRef.current);

        // Add current position marker (first point of current_visible segment)
        if (segment === 'current_visible' && coords.length > 0) {
            const currentPos = coords[0];
            
            // Satellite marker
            L.marker(currentPos, {
                icon: L.divIcon({
                    className: 'satellite-marker',
                    html: '<div style="background: #00ff00; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #fff;"></div>',
                    iconSize: [12, 12],
                })
            }).addTo(map2DRef.current);

            // Communication footprint (cone)
            L.circle(currentPos, {
                radius: 3000000, // 3000 km radius (adjust based on satellite altitude)
                color: '#00ff00',
                fillColor: '#00ff00',
                fillOpacity: 0.1,
                weight: 2,
                dashArray: '5, 10'
            }).addTo(map2DRef.current);

            // Zoom to current position
            map2DRef.current.setView(currentPos, 4);
        }
    });
};