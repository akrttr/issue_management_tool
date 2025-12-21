import { useState } from 'react';
import { useGkt1Data } from '../hooks/useGkt1Data';
import Gkt1Globe from './Gkt1Globe';
import Gkt1Map from './Gkt1Map';
import { RefreshCw, AlertCircle, Satellite } from 'lucide-react';

export default function Gkt1PassTracker() {
    const { data, loading, error, retry } = useGkt1Data(true, 30000);
    const [activeTab, setActiveTab] = useState('3d'); // '3d' or '2d'

    if (loading && !data.currentPosition) {
        return (
            <div style={styles.container}>
                <div style={styles.loadingState}>
                    <RefreshCw size={48} style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ marginTop: '1rem', fontSize: '1.1rem' }}>
                        GKT1 uydu verileri yükleniyor...
                    </p>
                </div>
            </div>
        );
    }

    if (error && !data.currentPosition) {
        return (
            <div style={styles.container}>
                <div style={styles.errorState}>
                    <AlertCircle size={48} color="#dc3545" />
                    <p style={{ marginTop: '1rem', fontSize: '1.1rem', color: '#dc3545' }}>
                        {error}
                    </p>
                    <button onClick={retry} style={styles.retryBtn}>
                        Tekrar Dene
                    </button>
                </div>
            </div>
        );
    }

    const now = new Date();
    const nextPass = data.passes.find((pass) => new Date(pass.aos) > now);
    const todayPasses = data.passes.filter(
        (pass) => new Date(pass.aos).toDateString() === now.toDateString()
    );

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.titleSection}>
                    <Satellite size={32} color="#667eea" />
                    <h1 style={styles.title}>GKT1 Uydu Takip</h1>
                </div>
                <button onClick={retry} style={styles.refreshBtn} disabled={loading}>
                    <RefreshCw size={18} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
                    Yenile
                </button>
            </div>

            {/* Current Status Card */}
            {data.currentPosition && (
                <div style={styles.statusCard}>
                    <h3 style={styles.statusTitle}>Mevcut Durum (UTC)</h3>
                    <div style={styles.statusGrid}>
                        <div style={styles.statusItem}>
                            <span style={styles.statusLabel}>Enlem:</span>
                            <span style={styles.statusValue}>
                                {data.currentPosition.latitude.toFixed(4)}°
                            </span>
                        </div>
                        <div style={styles.statusItem}>
                            <span style={styles.statusLabel}>Boylam:</span>
                            <span style={styles.statusValue}>
                                {data.currentPosition.longitude.toFixed(4)}°
                            </span>
                        </div>
                        <div style={styles.statusItem}>
                            <span style={styles.statusLabel}>Yükseklik:</span>
                            <span style={styles.statusValue}>
                                {data.currentPosition.altitude.toFixed(1)} km
                            </span>
                        </div>
                        <div style={styles.statusItem}>
                            <span style={styles.statusLabel}>Hız:</span>
                            <span style={styles.statusValue}>
                                {data.currentPosition.velocity?.toFixed(2) || 'N/A'} km/s
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div style={styles.tabs}>
                <button
                    onClick={() => setActiveTab('3d')}
                    style={{
                        ...styles.tab,
                        ...(activeTab === '3d' ? styles.activeTab : {}),
                    }}
                >
                    3D Görünüm
                </button>
                <button
                    onClick={() => setActiveTab('2d')}
                    style={{
                        ...styles.tab,
                        ...(activeTab === '2d' ? styles.activeTab : {}),
                    }}
                >
                    2D Harita
                </button>
            </div>

            {/* Visualization */}
            <div style={styles.visualizationContainer}>
                {activeTab === '3d' ? (
                    <Gkt1Globe
                        track={data.track}
                        currentPosition={data.currentPosition}
                        passes={data.passes}
                    />
                ) : (
                    <Gkt1Map
                        currentPosition={data.currentPosition}
                        nextPass={nextPass}
                    />
                )}
            </div>

            {/* Pass List */}
            <div style={styles.passesSection}>
                <h3 style={styles.sectionTitle}>
                    Bugünkü Geçişler ({todayPasses.length})
                </h3>
                {todayPasses.length === 0 ? (
                    <div style={styles.emptyState}>
                        Bugün için geçiş verisi bulunamadı.
                    </div>
                ) : (
                    <div style={styles.passesList}>
                        {todayPasses.map((pass, index) => (
                            <div
                                key={index}
                                style={{
                                    ...styles.passCard,
                                    ...(nextPass && pass.aos === nextPass.aos
                                        ? styles.nextPassCard
                                        : {}),
                                }}
                            >
                                <div style={styles.passHeader}>
                                    <span style={styles.passNumber}>Geçiş #{index + 1}</span>
                                    {nextPass && pass.aos === nextPass.aos && (
                                        <span style={styles.nextPassBadge}>Sonraki Geçiş</span>
                                    )}
                                </div>
                                <div style={styles.passDetails}>
                                    <div style={styles.passRow}>
                                        <span>AOS:</span>
                                        <span>{new Date(pass.aos).toUTCString()}</span>
                                    </div>
                                    <div style={styles.passRow}>
                                        <span>LOS:</span>
                                        <span>{new Date(pass.los).toUTCString()}</span>
                                    </div>
                                    <div style={styles.passRow}>
                                        <span>Maksimum Yükseklik:</span>
                                        <span>{pass.maxElevation.toFixed(1)}°</span>
                                    </div>
                                    <div style={styles.passRow}>
                                        <span>Süre:</span>
                                        <span>{pass.duration.toFixed(0)} saniye</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    container: {
        padding: '2rem',
        maxWidth: '1400px',
        margin: '0 auto',
    },
    loadingState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        color: '#666',
    },
    errorState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
    },
    retryBtn: {
        marginTop: '1rem',
        padding: '0.75rem 1.5rem',
        background: '#667eea',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: '500',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
    },
    titleSection: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
    },
    title: {
        fontSize: '2rem',
        fontWeight: 'bold',
        color: '#333',
        margin: 0,
    },
    refreshBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1.25rem',
        background: '#f5f5f5',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.95rem',
        fontWeight: '500',
        color: '#333',
    },
    statusCard: {
        background: 'white',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    },
    statusTitle: {
        fontSize: '1.2rem',
        fontWeight: '600',
        color: '#333',
        marginBottom: '1rem',
        marginTop: 0,
    },
    statusGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
    },
    statusItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statusLabel: {
        color: '#666',
        fontSize: '0.95rem',
    },
    statusValue: {
        fontWeight: '600',
        color: '#333',
        fontSize: '1rem',
    },
    tabs: {
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1rem',
    },
    tab: {
        padding: '0.75rem 1.5rem',
        background: '#f5f5f5',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.95rem',
        fontWeight: '500',
        color: '#666',
        transition: 'all 0.2s',
    },
    activeTab: {
        background: '#667eea',
        color: 'white',
    },
    visualizationContainer: {
        background: 'white',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    },
    passesSection: {
        background: 'white',
        borderRadius: '8px',
        padding: '1.5rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    },
    sectionTitle: {
        fontSize: '1.3rem',
        fontWeight: '600',
        color: '#333',
        marginTop: 0,
        marginBottom: '1.5rem',
    },
    passesList: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
        gap: '1rem',
    },
    passCard: {
        border: '1px solid #e0e0e0',
        borderRadius: '6px',
        padding: '1rem',
        transition: 'all 0.2s',
    },
    nextPassCard: {
        border: '2px solid #667eea',
        background: '#f8f9ff',
    },
    passHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.75rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid #e0e0e0',
    },
    passNumber: {
        fontWeight: '600',
        color: '#333',
        fontSize: '1rem',
    },
    nextPassBadge: {
        background: '#667eea',
        color: 'white',
        padding: '0.25rem 0.75rem',
        borderRadius: '12px',
        fontSize: '0.8rem',
        fontWeight: '500',
    },
    passDetails: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
    },
    passRow: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.9rem',
        color: '#666',
    },
    emptyState: {
        textAlign: 'center',
        padding: '3rem',
        color: '#999',
        fontSize: '1rem',
    },
};

// Add this to your global CSS or inline style tag for spin animation
const styleSheet = document.styleSheets[0];
if (styleSheet) {
    try {
        styleSheet.insertRule(`
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `, styleSheet.cssRules.length);
    } catch (e) {
        // Animation might already exist
    }
}