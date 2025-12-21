import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom satellite icon
const satelliteIcon = L.divIcon({
  className: 'satellite-icon',
  html: `
    <div style="position: relative; width: 32px; height: 32px;">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="11" fill="#FFC107" stroke="#fff" stroke-width="2"/>
        <path d="M8 8L16 16M8 16L16 8" stroke="#000" stroke-width="2" stroke-linecap="round"/>
        <circle cx="12" cy="12" r="3" fill="#000"/>
      </svg>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

export default function LeafletMap({ currentTrack, coverage, loading }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({});
  const hasZoomedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Small delay to ensure container is properly rendered
    const initTimer = setTimeout(() => {
      try {
        // Initialize map centered on Earth with whole-world view
        const map = L.map(mapRef.current, {
          center: [20, 0], // Slightly north of equator
          zoom: 2, // Show whole Earth
          minZoom: 1,
          maxZoom: 19,
          zoomControl: true,
          worldCopyJump: true,
          preferCanvas: true // Better performance
        });

        // Add tile layer with error handling
        const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
          noWrap: false,
          keepBuffer: 2
        });

        tileLayer.on('tileerror', (error) => {
          console.warn('Tile loading error:', error);
        });

        tileLayer.addTo(map);

        // Force map to recognize its container size
        setTimeout(() => {
          map.invalidateSize();
          setMapReady(true);
          console.log('Leaflet map initialized and sized');
        }, 100);

        mapInstanceRef.current = map;

      } catch (error) {
        console.error('Error initializing Leaflet map:', error);
      }
    }, 50);

    return () => {
      clearTimeout(initTimer);
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn('Error removing map:', e);
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handle window resize
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update map layers when data changes
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady || loading) return;

    const map = mapInstanceRef.current;

    // Ensure map size is correct before adding layers
    map.invalidateSize();

    // Clear previous layers - only remove actual Leaflet layers
    Object.entries(layersRef.current).forEach(([key, layer]) => {
      if (layer && typeof layer === 'object' && layer._leaflet_id) {
        try {
          map.removeLayer(layer);
        } catch (e) {
          console.warn('Error removing layer:', key, e);
        }
      }
    });
    layersRef.current = {};

    try {
      // Add Ankara ground station marker
      const ankaraMarker = L.marker([39.9334, 32.8597], {
        icon: L.divIcon({
          className: 'ground-station-marker',
          html: `
            <div style="position: relative; width: 24px; height: 24px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="#f44336" stroke="#fff" stroke-width="2"/>
                <path d="M12 6V12L16 14" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          popupAnchor: [0, -12]
        })
      }).addTo(map);

      ankaraMarker.bindPopup('<b>Ankara Yer İstasyonu</b><br>39.9334°N, 32.8597°E');
      layersRef.current.ankaraMarker = ankaraMarker;

      // Draw coverage footprint
      if (coverage && coverage.footprint && coverage.footprint.length > 0) {
        const footprintCoords = coverage.footprint.map(point => [point.latitude, point.longitude]);
        
        const footprintCircle = L.polygon(footprintCoords, {
          color: '#2196F3',
          fillColor: '#2196F3',
          fillOpacity: 0.15,
          weight: 2,
          dashArray: '5, 10'
        }).addTo(map);

        footprintCircle.bindPopup(`<b>Kapsama Alanı</b><br>Min Yükseklik: ${coverage.min_elevation}°`);
        layersRef.current.footprint = footprintCircle;
      }

      // Draw current satellite position with custom icon
      if (currentTrack && currentTrack.current_position) {
        const { latitude, longitude } = currentTrack.current_position;

        const satelliteMarker = L.marker([latitude, longitude], {
          icon: satelliteIcon,
          zIndexOffset: 1000
        }).addTo(map);

        satelliteMarker.bindPopup(`<b>GKT1 Satellite</b><br>Lat: ${latitude.toFixed(4)}°<br>Lon: ${longitude.toFixed(4)}°`);
        layersRef.current.satellite = satelliteMarker;

        // Zoom to satellite on first load
        if (!hasZoomedRef.current) {
          map.setView([latitude, longitude], 4, { animate: true, duration: 1.5 });
          hasZoomedRef.current = true;
        }
      }

      // Draw past ground track (solid green)
      if (currentTrack && currentTrack.past_track && currentTrack.past_track.length > 0) {
        const trackCoords = currentTrack.past_track.map(point => [point.latitude, point.longitude]);

        const groundTrack = L.polyline(trackCoords, {
          color: '#4CAF50',
          weight: 3,
          opacity: 0.8
        }).addTo(map);

        layersRef.current.groundTrack = groundTrack;
      }

      // Draw future track (dashed yellow)
      if (currentTrack && currentTrack.future_track && currentTrack.future_track.length > 0) {
        const futureCoords = currentTrack.future_track.map(point => [point.latitude, point.longitude]);

        const futureTrack = L.polyline(futureCoords, {
          color: '#FFC107',
          weight: 3,
          opacity: 0.7,
          dashArray: '10, 10'
        }).addTo(map);

        layersRef.current.futureTrack = futureTrack;
      }

      // Draw complete orbit track (blue)
      if (currentTrack && currentTrack.orbit_track && currentTrack.orbit_track.length > 0) {
        const orbitCoords = currentTrack.orbit_track.map(point => [point.latitude, point.longitude]);

        const orbitTrack = L.polyline(orbitCoords, {
          color: '#2196F3',
          weight: 2,
          opacity: 0.5,
          dashArray: '5, 5'
        }).addTo(map);

        layersRef.current.orbitTrack = orbitTrack;
      }

    } catch (error) {
      console.error('Error rendering Leaflet visualization:', error);
    }
  }, [currentTrack, coverage, loading, mapReady]);

  return (
    <div style={styles.container}>
      {!mapReady && (
        <div style={styles.loading}>2D Harita Başlatılıyor...</div>
      )}
      <div ref={mapRef} style={styles.mapContainer} />
      {loading && mapReady && (
        <div style={styles.loadingOverlay}>
          <div style={styles.loadingSpinner}>Güncelleniyor...</div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    minHeight: '400px' // Ensure minimum height
  },
  mapContainer: {
    width: '100%',
    height: '100%',
    minHeight: '400px', // Ensure minimum height
    backgroundColor: '#e0e0e0' // Light grey background while loading
  },
  loading: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: '1rem 2rem',
    borderRadius: '8px',
    color: '#666',
    fontSize: '1rem',
    zIndex: 1000,
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
  },
  loadingOverlay: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    zIndex: 1000
  },
  loadingSpinner: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: '#fff',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    fontSize: '0.9rem'
  }
};