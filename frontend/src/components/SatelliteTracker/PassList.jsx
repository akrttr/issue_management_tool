import { useState } from 'react';
import { Clock, TrendingUp, Eye } from 'lucide-react';
import { formatUTCTime, getTimeUntil, getPassStatus, getPassColor } from '../../utils/satelliteHelpers';

export default function PassList({ passes, loading }) {
  const [filter, setFilter] = useState('all'); // all, upcoming, past

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Yükleniyor...</div>
      </div>
    );
  }

  if (!passes || passes.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>Bugün için geçiş bulunamadı</div>
      </div>
    );
  }

  const filteredPasses = passes.filter(pass => {
    if (filter === 'all') return true;
    return getPassStatus(pass) === filter;
  });

  const upcomingCount = passes.filter(p => getPassStatus(p) === 'upcoming').length;
  const pastCount = passes.filter(p => getPassStatus(p) === 'past').length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Bugünkü Geçişler</h3>
        <div style={styles.filters}>
          <button
            onClick={() => setFilter('all')}
            style={{
              ...styles.filterBtn,
              ...(filter === 'all' ? styles.filterBtnActive : {})
            }}
          >
            Tümü ({passes.length})
          </button>
          <button
            onClick={() => setFilter('upcoming')}
            style={{
              ...styles.filterBtn,
              ...(filter === 'upcoming' ? styles.filterBtnActive : {})
            }}
          >
            Gelecek ({upcomingCount})
          </button>
          <button
            onClick={() => setFilter('past')}
            style={{
              ...styles.filterBtn,
              ...(filter === 'past' ? styles.filterBtnActive : {})
            }}
          >
            Geçmiş ({pastCount})
          </button>
        </div>
      </div>

      <div style={styles.passList}>
        {filteredPasses.map((pass, index) => {
          const status = getPassStatus(pass);
          const color = getPassColor(pass.max_elevation);
          
          return (
            <div key={index} style={{
              ...styles.passCard,
              borderLeft: `4px solid ${color}`
            }}>
              <div style={styles.passHeader}>
                <div style={styles.passTime}>
                  <Clock size={16} />
                  <span>{formatUTCTime(pass.aos_time)}</span>
                </div>
                <div style={{
                  ...styles.statusBadge,
                  backgroundColor: status === 'upcoming' ? '#4CAF50' :
                                   status === 'current' ? '#FF9800' : '#999'
                }}>
                  {status === 'upcoming' ? 'Gelecek' :
                   status === 'current' ? 'Aktif' : 'Geçmiş'}
                </div>
              </div>

              <div style={styles.passDetails}>
                <div style={styles.detailRow}>
                  <TrendingUp size={14} />
                  <span>Maks Yükseklik: {pass.max_elevation.toFixed(1)}°</span>
                </div>
                <div style={styles.detailRow}>
                  <Eye size={14} />
                  <span>Süre: {pass.duration.toFixed(0)} saniye</span>
                </div>
                {status === 'upcoming' && (
                  <div style={styles.countdown}>
                    {getTimeUntil(pass.aos_time)} sonra başlıyor
                  </div>
                )}
              </div>

              <div style={styles.passTimeline}>
                <div style={styles.timelineItem}>
                  <div style={styles.timelineLabel}>AOS</div>
                  <div style={styles.timelineValue}>
                    {new Date(pass.aos_time).toISOString().substring(11, 19)}
                  </div>
                </div>
                <div style={styles.timelineItem}>
                  <div style={styles.timelineLabel}>TCA</div>
                  <div style={styles.timelineValue}>
                    {new Date(pass.tca_time).toISOString().substring(11, 19)}
                  </div>
                </div>
                <div style={styles.timelineItem}>
                  <div style={styles.timelineLabel}>LOS</div>
                  <div style={styles.timelineValue}>
                    {new Date(pass.los_time).toISOString().substring(11, 19)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666'
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#999'
  },
  header: {
    padding: '1rem',
    backgroundColor: 'white',
    borderBottom: '1px solid #e0e0e0'
  },
  title: {
    margin: '0 0 1rem 0',
    fontSize: '1.1rem',
    fontWeight: '600'
  },
  filters: {
    display: 'flex',
    gap: '0.5rem'
  },
  filterBtn: {
    padding: '0.4rem 0.8rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    fontSize: '0.85rem',
    transition: 'all 0.2s'
  },
  filterBtnActive: {
    backgroundColor: '#667eea',
    color: 'white',
    borderColor: '#667eea'
  },
  passList: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem'
  },
  passCard: {
    backgroundColor: 'white',
    borderRadius: '6px',
    padding: '1rem',
    marginBottom: '0.75rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  passHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem'
  },
  passTime: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.9rem',
    fontWeight: '500'
  },
  statusBadge: {
    padding: '0.2rem 0.6rem',
    borderRadius: '12px',
    fontSize: '0.75rem',
    color: 'white',
    fontWeight: '500'
  },
  passDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginBottom: '0.75rem'
  },
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.85rem',
    color: '#555'
  },
  countdown: {
    fontSize: '0.85rem',
    color: '#4CAF50',
    fontWeight: '500',
    marginTop: '0.25rem'
  },
  passTimeline: {
    display: 'flex',
    justifyContent: 'space-around',
    paddingTop: '0.75rem',
    borderTop: '1px solid #f0f0f0'
  },
  timelineItem: {
    textAlign: 'center'
  },
  timelineLabel: {
    fontSize: '0.7rem',
    color: '#999',
    marginBottom: '0.25rem'
  },
  timelineValue: {
    fontSize: '0.85rem',
    fontWeight: '500',
    fontFamily: 'monospace'
  }
};