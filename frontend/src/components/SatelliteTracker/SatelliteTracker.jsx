import { useState } from 'react';
import { Globe, Map, RefreshCw, AlertCircle } from 'lucide-react';
import { useSatelliteData } from '../../hooks/useSatelliteData';
import CesiumGlobe from '../SatelliteTracker/CesiumGlobe';
import LeafletMap from '../SatelliteTracker/LeafletMap';
import PassList from '../SatelliteTracker/PassList';

export default function SatelliteTracker() {
  const [activeView, setActiveView] = useState('3d'); // '3d' or '2d'
  const { passes, currentTrack, coverage, tle, loading, error, retry, refresh } = useSatelliteData(60000);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>GKT1 Uydu Takip Sistemi</h1>
          {tle && (
            <div style={styles.tleInfo}>
              <span style={styles.tleLabel}>TLE Epoch:</span>
              <span style={styles.tleValue}>{new Date(tle.epoch).toISOString().substring(0, 19)} UTC</span>
            </div>
          )}
        </div>
        <div style={styles.headerRight}>
          <div style={styles.viewToggle}>
            <button
              onClick={() => setActiveView('3d')}
              style={{
                ...styles.viewBtn,
                ...(activeView === '3d' ? styles.viewBtnActive : {})
              }}
              title="3D Görünüm"
            >
              <Globe size={18} />
              3D
            </button>
            <button
              onClick={() => setActiveView('2d')}
              style={{
                ...styles.viewBtn,
                ...(activeView === '2d' ? styles.viewBtnActive : {})
              }}
              title="2D Harita"
            >
              <Map size={18} />
              2D
            </button>
          </div>
          <button
            onClick={refresh}
            style={styles.refreshBtn}
            disabled={loading}
            title="Yenile"
          >
            <RefreshCw size={18} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div style={styles.errorContainer}>
          <div style={styles.errorContent}>
            <AlertCircle size={24} />
            <div>
              <div style={styles.errorTitle}>Veri Yüklenemedi</div>
              <div style={styles.errorMessage}>{error}</div>
            </div>
            <button onClick={retry} style={styles.retryBtn}>
              Tekrar Dene
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!error && (
        <div style={styles.content}>
          {/* Visualization Panel */}
          <div style={styles.visualizationPanel}>
            {activeView === '3d' ? (
              <CesiumGlobe
                currentTrack={currentTrack}
                passes={passes}
                loading={loading}
              />
            ) : (
              <LeafletMap
                currentTrack={currentTrack}
                coverage={coverage}
                loading={loading}
              />
            )}
          </div>

          {/* Pass List Panel */}
          <div style={styles.passListPanel}>
            <PassList passes={passes} loading={loading} />
          </div>
        </div>
      )}

      {/* CSS for spinning animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spinning {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    height: 'calc(100vh - 80px)',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f5f5f5'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem 2rem',
    backgroundColor: 'white',
    borderBottom: '1px solid #e0e0e0',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#333'
  },
  tleInfo: {
    display: 'flex',
    gap: '0.5rem',
    fontSize: '0.85rem',
    color: '#666'
  },
  tleLabel: {
    fontWeight: '500'
  },
  tleValue: {
    fontFamily: 'monospace',
    color: '#2196F3'
  },
  headerRight: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center'
  },
  viewToggle: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.25rem',
    backgroundColor: '#f5f5f5',
    borderRadius: '6px'
  },
  viewBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '500',
    color: '#666',
    transition: 'all 0.2s'
  },
  viewBtnActive: {
    backgroundColor: '#667eea',
    color: 'white'
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.5rem 0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  content: {
    flex: 1,
    display: 'flex',
    gap: '1rem',
    padding: '1rem',
    overflow: 'hidden'
  },
  visualizationPanel: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'white',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  passListPanel: {
    width: '350px',
    minWidth: '350px'
  },
  errorContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem'
  },
  errorContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    padding: '2rem',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    maxWidth: '400px',
    textAlign: 'center'
  },
  errorTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#d32f2f',
    marginBottom: '0.5rem'
  },
  errorMessage: {
    fontSize: '0.9rem',
    color: '#666'
  },
  retryBtn: {
    padding: '0.6rem 1.5rem',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'all 0.2s'
  }
};