import { Clock, Activity, AlertCircle, MessageSquare, Edit, Plus, Trash2 } from 'lucide-react';

export default function TicketActionTimeline({ actions }) {
    const getActionIcon = (actionType) => {
        const iconProps = { size: 14 };
        switch (actionType) {
            case 'Create':
                return <Plus {...iconProps} />;
            case 'StatusChange':
                return <AlertCircle {...iconProps} />;
            case 'Edit':
                return <Edit {...iconProps} />;
            case 'Comment':
                return <MessageSquare {...iconProps} />;
            default:
                return <Activity {...iconProps} />;
        }
    };

    const getActionColor = (actionType, toStatus) => {
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
        if (actionType === 'Edit') return '#ff9800';
        return '#667eea';
    };

    const getActionTitle = (action) => {
        const statusLabels = {
            'OPEN': 'AÇIK',
            'CLOSED': 'KAPANDI',
            'CONFIRMED': 'ONAYLANDI',
            'PAUSED': 'DURDURULDU',
            'REOPENED': 'TEKRAR AÇILDI',
            'CANCELLED': 'İPTAL'
        };

        const actionLabels = {
            'Create': 'Arıza Oluşturuldu',
            'Edit': 'Güncelleme Yapıldı',
            'Comment': 'İşlem Eklendi',
            'StatusChange': 'Durum Değişikliği'
        };

        if (action.actionType === 'StatusChange') {
            const from = statusLabels[action.fromStatus] || action.fromStatus;
            const to = statusLabels[action.toStatus] || action.toStatus;
            return `${from} → ${to}`;
        }

        return actionLabels[action.actionType] || action.actionType;
    };

    const formatDateTime = (dateString) => {
        const date = new Date(dateString);
        const time = date.toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        const dateStr = date.toLocaleDateString('tr-TR', { 
            day: '2-digit', 
            month: 'short',
            year: 'numeric'
        });
        return { time, date: dateStr };
    };

    if (!actions || actions.length === 0) {
        return (
            <div style={styles.emptyState}>
                <Clock size={24} style={{ color: '#ccc' }} />
                <p style={styles.emptyText}>Henüz işlem yapılmamış</p>
            </div>
        );
    }

    // Sort actions by date descending (newest first)
    const sortedActions = [...actions].sort((a, b) => 
        new Date(b.performedAt) - new Date(a.performedAt)
    );

    return (
        <div style={styles.container}>
            <div style={styles.timelineWrapper}>
                {sortedActions.map((action, index) => {
                    const { time, date } = formatDateTime(action.performedAt);
                    const isLast = index === sortedActions.length - 1;
                    const color = getActionColor(action.actionType, action.toStatus);

                    return (
                        <div key={action.id} style={styles.timelineItem}>
                            {/* Left side - Date/Time */}
                            <div style={styles.leftColumn}>
                                <div style={styles.timeText}>{time}</div>
                                <div style={styles.dateText}>{date}</div>
                            </div>

                            {/* Center - Timeline dot and line */}
                            <div style={styles.centerColumn}>
                                <div 
                                    style={{
                                        ...styles.dot,
                                        backgroundColor: color,
                                        boxShadow: `0 0 0 4px ${color}20`
                                    }}
                                >
                                    <div style={styles.dotIcon}>
                                        {getActionIcon(action.actionType)}
                                    </div>
                                </div>
                                {!isLast && <div style={styles.line} />}
                            </div>

                            {/* Right side - Action details */}
                            <div style={styles.rightColumn}>
                                <div style={styles.actionCard}>
                                    <div style={styles.actionHeader}>
                                        <span style={{
                                            ...styles.actionTitle,
                                            color: color
                                        }}>
                                            {getActionTitle(action)}
                                        </span>
                                    </div>
                                    
                                    <div style={styles.actionMeta}>
                                        <span style={styles.performer}>
                                            {action.performedByName}
                                        </span>
                                    </div>

                                    {action.notes && action.notes.trim() && (
                                        <div style={styles.actionNotes}>
                                            {action.notes}
                                        </div>
                                    )}
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
        padding: '1rem 0',
    },
    timelineWrapper: {
        position: 'relative',
    },
    timelineItem: {
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
        minHeight: '60px',
    },
    leftColumn: {
        width: '90px',
        textAlign: 'right',
        paddingTop: '2px',
        flexShrink: 0,
    },
    timeText: {
        fontSize: '0.9rem',
        fontWeight: '600',
        color: '#333',
        lineHeight: '1.2',
    },
    dateText: {
        fontSize: '0.75rem',
        color: '#999',
        marginTop: '2px',
    },
    centerColumn: {
        position: 'relative',
        width: '32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flexShrink: 0,
    },
    dot: {
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#667eea',
        position: 'relative',
        zIndex: 2,
    },
    dotIcon: {
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    line: {
        width: '2px',
        flex: 1,
        backgroundColor: '#e0e0e0',
        position: 'absolute',
        top: '32px',
        bottom: '-24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1,
    },
    rightColumn: {
        flex: 1,
        paddingTop: '2px',
    },
    actionCard: {
        backgroundColor: '#f9f9f9',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        transition: 'all 0.2s',
    },
    actionHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.25rem',
    },
    actionTitle: {
        fontSize: '0.9rem',
        fontWeight: '600',
    },
    actionMeta: {
        fontSize: '0.75rem',
        color: '#666',
    },
    performer: {
        fontWeight: '500',
    },
    actionNotes: {
        marginTop: '0.5rem',
        padding: '0.5rem',
        backgroundColor: 'white',
        borderRadius: '4px',
        fontSize: '0.8rem',
        color: '#666',
        borderLeft: '3px solid #667eea',
        fontStyle: 'italic',
        lineHeight: '1.4',
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1rem',
        gap: '0.75rem',
    },
    emptyText: {
        color: '#999',
        fontSize: '0.9rem',
        margin: 0,
    },
};