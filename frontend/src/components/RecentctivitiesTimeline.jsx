import { useState, useEffect } from 'react';
import { Clock, Activity, AlertCircle, CheckCircle, XCircle, Pause, PlayCircle, MessageSquare } from 'lucide-react';
import { ticketsAPI } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';
import { de, tr } from 'date-fns/locale';

export default function RecentActivitiesTimeline({ onTicketClick }) {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadRecentActivities();
        // Refresh every 30 seconds
        const interval = setInterval(loadRecentActivities, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadRecentActivities = async () => {
        try {
            const response = await ticketsAPI.getRecentActivities(20);
            
            setActivities(response.data);
        } catch (error) {
            console.error('Error loading recent activities:', error);
        } finally {
            setLoading(false);
        }
    };

    const getActivityIcon = (actionType) => {
        const iconProps = { size: 16 };
        switch (actionType) {
            case 'Create':
                return <Activity {...iconProps} />;
            case 'StatusChange':
                return <AlertCircle {...iconProps} />;
            case 'Edit':
                return <Clock {...iconProps} />;
            case 'Comment':
                return <MessageSquare {...iconProps} />;
            default:
                return <Activity {...iconProps} />;
        }
    };

    const getActivityColor = (actionType, toStatus) => {
        if (actionType === 'StatusChange') {
            switch (toStatus) {
                case 'CLOSED':
                    return '#4caf50';
                case 'PAUSED':
                    return '#ff9800';
                case 'CANCELLED':
                    return '#f44336';
                case 'CONFIRMED':
                    return '#2196f3';
                case 'REOPENED':
                    return '#9c27b0';
                default:
                    return '#667eea';
            }
        }
        if (actionType === 'Create') return '#4caf50';
        if (actionType === 'Comment') return '#2196f3';
        return '#667eea';
    };

    const getActivityTitle = (activity) => {
        const statusLabels = {
            'OPEN': 'AÇIK',
            'CLOSED': 'KAPANDI',
            'CONFIRMED': 'ONAYLANDI',
            'PAUSED': 'DURDURULDU',
            'REOPENED': 'TEKRAR AÇILDI',
            'CANCELLED': 'İPTAL'
        };

        const actionLabels = {
            'Create': 'Arıza oluşturuldu',
            'Edit': 'Arıza güncellendi',
            'Comment': 'İşlem Eklendi',
            'StatusChange': 'Durum değişti'
        };

        if (activity.actionType === 'StatusChange' && activity.toStatus) {
            return `${statusLabels[activity.toStatus] || activity.toStatus} olarak guncellendi`;
        }

        return actionLabels[activity.actionType] || activity.actionType;
    };

    const formatTime = (date) => {
        try {
            return formatDistanceToNow(new Date(date), { 
                addSuffix: true, 
                locale: tr 
            });
        } catch {
            return new Date(date).toLocaleString('tr-TR');
        }
    };

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.header}>
                    <Activity size={20} style={{ color: '#667eea' }} />
                    <h3 style={styles.title}>Son Hareketler</h3>
                </div>
                <div style={styles.loading}>Yükleniyor...</div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <Activity size={20} style={{ color: '#667eea' }} />
                <h3 style={styles.title}>Son Hareketler</h3>
                <span style={styles.subtitle}>son 2 hafta</span>
            </div>

            <div style={styles.timelineContainer}>
                {activities.length === 0 ? (
                    <div style={styles.empty}>Henüz aktivite yok</div>
                ) : (
                    activities.map((activity) => (
                        <div 
                            key={activity.actionId} 
                            style={styles.timelineItem}
                            onClick={() => onTicketClick?.(activity.ticketId)}
                        >
                            <div style={styles.timeInfo}>
                                {formatTime(activity.performedAt)}
                            </div>
                            
                            <div style={styles.activityContent}>
                                <div 
                                    style={{
                                        ...styles.iconCircle,
                                        backgroundColor: getActivityColor(activity.actionType, activity.toStatus)
                                    }}
                                >
                                    {getActivityIcon(activity.actionType)}
                                </div>

                                <div style={styles.activityDetails}>
                                    <div style={styles.activityTitle}>
                                        {getActivityTitle(activity)}
                                    </div>
                                    <div style={styles.ticketInfo}>
                                        <span style={styles.ticketCode}>{activity.ticketExternalCode}</span>
                                        <span style={styles.ticketTitle}>
                                            {activity.ticketTitle.length > 40 
                                                ? activity.ticketTitle.substring(0, 40) + '...' 
                                                : activity.ticketTitle}
                                        </span>
                                    </div>
                                    {activity.performedByRank && (
                                        <div style={styles.performer}>
                                            {activity.performedByRank} {activity.performedByName}
                                        </div>
                                    )}
                                    {activity.notes && activity.notes.trim() && (
                                        <div style={styles.notes}>{activity.notes}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

const styles = {
    container: {
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '2px solid #f0f0f0',
    },
    title: {
        fontSize: '1.1rem',
        fontWeight: '600',
        color: '#333',
        margin: 0,
    },
    subtitle: {
        fontSize: '0.75rem',
        color: '#999',
        marginLeft: 'auto',
    },
    timelineContainer: {
        flex: 1,
        overflowY: 'auto',
        paddingRight: '0.5rem',
    },
    timelineItem: {
        position: 'relative',
        paddingBottom: '1.25rem',
        marginBottom: '1.25rem',
        borderBottom: '1px solid #f0f0f0',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    timeInfo: {
        fontSize: '0.75rem',
        color: '#999',
        marginBottom: '0.5rem',
        fontWeight: '500',
    },
    activityContent: {
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
    },
    iconCircle: {
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        flexShrink: 0,
    },
    activityDetails: {
        flex: 1,
        minWidth: 0,
    },
    activityTitle: {
        fontSize: '0.9rem',
        fontWeight: '600',
        color: '#333',
        marginBottom: '0.25rem',
    },
    ticketInfo: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        marginBottom: '0.25rem',
    },
    ticketCode: {
        fontSize: '0.75rem',
        fontWeight: '600',
        color: '#667eea',
    },
    ticketTitle: {
        fontSize: '0.8rem',
        color: '#666',
        lineHeight: '1.3',
    },
    performer: {
        fontSize: '0.75rem',
        color: '#999',
        marginTop: '0.25rem',
    },
    notes: {
        fontSize: '0.75rem',
        color: '#666',
        fontStyle: 'italic',
        marginTop: '0.25rem',
        padding: '0.5rem',
        backgroundColor: '#f9f9f9',
        borderRadius: '4px',
        borderLeft: '2px solid #667eea',
    },
    loading: {
        textAlign: 'center',
        padding: '2rem',
        color: '#999',
    },
    empty: {
        textAlign: 'center',
        padding: '2rem',
        color: '#999',
        fontSize: '0.9rem',
    },
};