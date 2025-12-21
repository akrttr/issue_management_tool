import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';

export default function CesiumGlobe({ currentTrack, passes, loading }) {
  const viewerRef = useRef(null);
  const containerRef = useRef(null);
  const entitiesRef = useRef({});
  const [viewerReady, setViewerReady] = useState(false);
  const [isTracking, setIsTracking] = useState(true);
  const animationFrameRef = useRef(null);

  // Initialize Cesium Viewer once on mount
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    try {
      // Set Cesium Ion token
      const cesiumToken = import.meta.env.VITE_CESIUM_TOKEN;
      if (cesiumToken) {
        Cesium.Ion.defaultAccessToken = cesiumToken;
        console.log('Cesium token set successfully');
      } else {
        console.warn('No Cesium token found - using default (may have limitations)');
      }

      // Initialize Cesium Viewer with simple, working configuration
      const viewer = new Cesium.Viewer(containerRef.current, {
        baseLayerPicker: false,
        geocoder: false,
        homeButton: true,
        sceneModePicker: true,
        navigationHelpButton: true,
        animation: false,
        timeline: true,
        fullscreenButton: true,
        vrButton: false,
        infoBox: false,
        selectionIndicator: false,
        shadows: true,
        shouldAnimate: true // Enable animation for tracking
      });

      // Enable lighting for better visual
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.showGroundAtmosphere = true;
      
      // Set initial camera position
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(32.8597, 39.9334, 10000000),
        orientation: {
          heading: 0.0,
          pitch: -Cesium.Math.PI_OVER_TWO,
          roll: 0.0
        }
      });

      // Disable default home button action
      viewer.homeButton.viewModel.command.beforeExecute.addEventListener((e) => {
        e.cancel = true;
        // Reset to tracking mode
        if (entitiesRef.current.satellite) {
          viewer.trackedEntity = entitiesRef.current.satellite;
          setIsTracking(true);
        }
      });

      viewerRef.current = viewer;
      setViewerReady(true);
      
      console.log('Cesium viewer initialized successfully');
    } catch (error) {
      console.error('Error initializing Cesium viewer:', error);
      console.error('Error details:', error.message, error.stack);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying viewer:', e);
        }
        viewerRef.current = null;
      }
    };
  }, []);

  // Update visualization when data changes
  useEffect(() => {
    if (!viewerRef.current || !viewerReady || !currentTrack || loading) return;

    const viewer = viewerRef.current;

    // Clear previous entities
    Object.values(entitiesRef.current).forEach(entity => {
      try {
        if (entity && entity._id) {
          viewer.entities.remove(entity);
        }
      } catch (e) {
        console.warn('Error removing entity:', e);
      }
    });
    entitiesRef.current = {};

    try {
      const { latitude, longitude, altitude } = currentTrack.current_position;
      const satellitePosition = Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude * 1000);

      // Create satellite entity with real-time position
      const satelliteEntity = viewer.entities.add({
        id: 'gkt1-satellite',
        position: satellitePosition,
        point: {
          pixelSize: 14,
          color: Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 3,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        billboard: {
          image: createSatelliteCanvas(),
          scale: 0.5,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        label: {
          text: 'GKT1',
          font: '16px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          pixelOffset: new Cesium.Cartesian2(0, -30),
          showBackground: true,
          backgroundColor: new Cesium.Color(0, 0, 0, 0.7),
          backgroundPadding: new Cesium.Cartesian2(8, 5),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        description: `
          <div style="padding: 10px;">
            <h3>GKT1 Satellite</h3>
            <p><strong>Latitude:</strong> ${latitude.toFixed(4)}°</p>
            <p><strong>Longitude:</strong> ${longitude.toFixed(4)}°</p>
            <p><strong>Altitude:</strong> ${altitude.toFixed(2)} km</p>
          </div>
        `
      });

      entitiesRef.current.satellite = satelliteEntity;

      // Draw past ground track (solid green line)
      if (currentTrack.past_track && currentTrack.past_track.length > 1) {
        const pastPositions = currentTrack.past_track.map(point =>
          Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, 100000)
        );

        const pastTrackEntity = viewer.entities.add({
          id: 'past-track',
          polyline: {
            positions: pastPositions,
            width: 3,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.15,
              color: Cesium.Color.fromCssColorString('#4CAF50')
            }),
            clampToGround: false
          }
        });
        entitiesRef.current.pastTrack = pastTrackEntity;
      }

      // Draw future ground track (dashed yellow line)
      if (currentTrack.future_track && currentTrack.future_track.length > 1) {
        const futurePositions = currentTrack.future_track.map(point =>
          Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, 100000)
        );

        const futureTrackEntity = viewer.entities.add({
          id: 'future-track',
          polyline: {
            positions: futurePositions,
            width: 3,
            material: new Cesium.PolylineDashMaterialProperty({
              color: Cesium.Color.fromCssColorString('#FFC107'),
              dashLength: 16.0,
              dashPattern: 255.0
            }),
            clampToGround: false
          }
        });
        entitiesRef.current.futureTrack = futureTrackEntity;
      }

      // Draw complete orbit (blue line at actual altitude)
      if (currentTrack.orbit_track && currentTrack.orbit_track.length > 1) {
        const orbitPositions = currentTrack.orbit_track.map(point =>
          Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, point.altitude * 1000)
        );

        const orbitEntity = viewer.entities.add({
          id: 'orbit-track',
          polyline: {
            positions: orbitPositions,
            width: 2,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.1,
              color: Cesium.Color.fromCssColorString('#2196F3').withAlpha(0.6)
            })
          }
        });
        entitiesRef.current.orbit = orbitEntity;
      }

      // Add Ankara ground station marker
      const ankaraEntity = viewer.entities.add({
        id: 'ankara-gs',
        position: Cesium.Cartesian3.fromDegrees(32.8597, 39.9334, 0),
        point: {
          pixelSize: 12,
          color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 3,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        label: {
          text: 'Ankara GS',
          font: '14px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          showBackground: true,
          backgroundColor: new Cesium.Color(0.8, 0, 0, 0.8),
          backgroundPadding: new Cesium.Cartesian2(7, 4),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        description: `
          <div style="padding: 10px;">
            <h3>Ankara Ground Station</h3>
            <p><strong>Latitude:</strong> 39.9334°N</p>
            <p><strong>Longitude:</strong> 32.8597°E</p>
            <p><strong>Elevation:</strong> 850m</p>
          </div>
        `
      });
      entitiesRef.current.ankara = ankaraEntity;

      // Track the satellite with camera
      if (isTracking) {
        viewer.trackedEntity = satelliteEntity;
        
        // Set camera offset for better viewing angle
        viewer.scene.postRender.addEventListener(function() {
          if (viewer.trackedEntity === satelliteEntity) {
            const center = satelliteEntity.position.getValue(viewer.clock.currentTime);
            if (center) {
              const transform = Cesium.Transforms.eastNorthUpToFixedFrame(center);
              viewer.scene.camera.lookAtTransform(
                transform,
                new Cesium.HeadingPitchRange(
                  Cesium.Math.toRadians(0),    // heading
                  Cesium.Math.toRadians(-45),  // pitch (looking down at 45 degrees)
                  2000000                       // range (2000 km from satellite)
                )
              );
            }
          }
        });
      }

    } catch (error) {
      console.error('Error rendering Cesium visualization:', error);
    }
  }, [currentTrack, passes, loading, viewerReady, isTracking]);

  // Toggle tracking mode
  const toggleTracking = () => {
    if (!viewerRef.current) return;

    if (isTracking) {
      viewerRef.current.trackedEntity = undefined;
      setIsTracking(false);
    } else {
      if (entitiesRef.current.satellite) {
        viewerRef.current.trackedEntity = entitiesRef.current.satellite;
        setIsTracking(true);
      }
    }
  };

  // Create satellite icon canvas
  function createSatelliteCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Draw satellite icon
    ctx.fillStyle = '#FFC107';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;

    // Main body
    ctx.beginPath();
    ctx.arc(32, 32, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Solar panels
    ctx.fillStyle = '#2196F3';
    ctx.fillRect(5, 27, 15, 10);
    ctx.fillRect(44, 27, 15, 10);
    ctx.strokeRect(5, 27, 15, 10);
    ctx.strokeRect(44, 27, 15, 10);

    // Antenna
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(32, 12);
    ctx.lineTo(32, 32);
    ctx.stroke();

    return canvas;
  }

  return (
    <div style={styles.container}>
      {!viewerReady && (
        <div style={styles.loading}>3D Görünüm Başlatılıyor...</div>
      )}
      <div ref={containerRef} style={styles.cesiumContainer} />
      
      {/* Control buttons */}
      {viewerReady && (
        <div style={styles.controls}>
          <button
            onClick={toggleTracking}
            style={{
              ...styles.controlButton,
              backgroundColor: isTracking ? '#4CAF50' : '#666'
            }}
            title={isTracking ? 'Takibi Durdur' : 'Uyduyu Takip Et'}
          >
            {isTracking ? '📡 Takip Aktif' : '📡 Serbest Kamera'}
          </button>
        </div>
      )}
      
      {loading && viewerReady && (
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
    backgroundColor: '#000'
  },
  cesiumContainer: {
    width: '100%',
    height: '100%'
  },
  loading: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#fff',
    fontSize: '1.2rem',
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: '1rem 2rem',
    borderRadius: '8px'
  },
  controls: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    zIndex: 1000,
    display: 'flex',
    gap: '10px'
  },
  controlButton: {
    padding: '0.6rem 1rem',
    border: 'none',
    borderRadius: '4px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '500',
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
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