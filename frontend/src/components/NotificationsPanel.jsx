import { useState, useEffect } from 'react';
import { Bell, X, Check, Clock, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { notificationsAPI } from '../../services/api';
import signalRService from '../../services/signalrService';

export default function NotificationsPanel({ isOpen, onClose, onNotificationClick }) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, unread, progressRequest
    const [stats, setStats] = useState({
        totalUnread: 0,
        newTickets: 0,
        progressRequests: 0,
        requiresAction: 0,
        highPriority: 0
    });

    useEffect(() => {
        if (isOpen) {
            loadNotifications();
            loadStats();
        }
    }, [isOpen, filter]);

    useEffect(() => {
        // Listen for real-time notifications
        const handleNewNotification = (notification) => {
            console.log('New notification received:', notification);
            
            // Add to notifications list
            setNotifications(prev => [notification, ...prev]);
            
            // Update stats
            setStats(prev => ({
                ...prev,
                totalUnread: prev.totalUnread + 1,
                newTickets: notification.type === 'NewTicket' ? prev.newTickets + 1 : prev.newTickets,
                progressRequests: notification.type === 'ProgressRequest' ? prev.progressRequests + 1 : prev.progressRequests
            }));

            // Show browser notification if permitted
            if (Notification.permission === 'granted') {
                new Notification(notification.title, {
                    body: notification.message,
                    icon: '/favicon.ico',
                    badge: '/favicon.ico'
                });
            }
        };

        signalRService.on('NewNotification', handleNewNotification);

        return () => {
            signalRService.off('NewNotification');
        };
    }, []);

    const loadNotifications = async () => {
        setLoading(true);
        try {
            const params = {
                page: 1,
                pageSize: 50
            };

            if (filter === 'unread') {
                params.unreadOnly = true;
            } else if (filter === 'progressRequest') {
                params.type = 'ProgressRequest';
            }

            const response = await notificationsAPI.getAll(params);
            setNotifications(response.data);
        } catch (error) {
            console.error('Error loading notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const response = await notificationsAPI.getStats();
            setStats(response.data);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const handleMarkAsRead = async (notificationId) => {
        try {
            await notificationsAPI.markAsRead(notificationId);
            
            // Update UI
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
            );
            
            setStats(prev => ({
                ...prev,
                totalUnread: Math.max(0, prev.totalUnread - 1)
            }));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
            if (unreadIds.length === 0) return;

            await notificationsAPI.markMultipleAsRead({ notificationIds: unreadIds });
            
            setNotifications(prev =>
                prev.map(n => ({ ...n, isRead: true }))
            );
            
            setStats(prev => ({
                ...prev,
                totalUnread: 0,
                newTickets: 0,
                progressRequests: 0
            }));
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const handleNotificationClick = (notification) => {
        // Mark as read
        if (!notification.isRead) {
            handleMarkAsRead(notification.id);
        }

        // Navigate to ticket
        if (onNotificationClick) {
            onNotificationClick(notification);
        }

        onClose();
    };

    const getNotificationIcon = (type, priority) => {
        if (priority === 'High' || priority === 'Urgent') {
            return <AlertCircle size={20} color="#d32f2f" />;
        }

        switch (type) {
            case 'NewTicket':
                return <Bell size={20} color="#1976d2" />;
            case 'ProgressRequest':
                return <Clock size={20} color="#f57c00" />;
            case 'TicketClosed':
                return <CheckCircle size={20} color="#388e3c" />;
            default:
                return <Bell size={20} color="#666" />;
        }
    };

    const getTypeLabel = (type) => {
        const labels = {
            'NewTicket': 'Yeni Sorun',
            'ProgressRequest': 'Bilgi Talebi',
            'StatusChanged': 'Durum Değişikliği',
            'TicketClosed': 'Sorun Kapatıldı',
            'CommentAdded': 'Yeni Bilgi',
            'TicketAssigned': 'Atama',
        };
        return labels[type] || type;
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Şimdi';
        if (diffMins < 60) return `${diffMins} dakika önce`;
        if (diffHours < 24) return `${diffHours} saat önce`;
        if (diffDays < 7) return `${diffDays} gün önce`;
        
        return date.toLocaleDateString('tr-TR', { 
            day: 'numeric', 
            month: 'short',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div style={styles.backdrop} onClick={onClose} />

            {/* Panel */}
            <div style={styles.panel}>
                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.headerLeft}>
                        <Bell size={20} />
                        <h3 style={styles.title}>Bildirimler</h3>
                        {stats.totalUnread > 0 && (
                            <span style={styles.badge}>{stats.totalUnread}</span>
                        )}
                    </div>
                    <button onClick={onClose} style={styles.closeBtn}>
                        <X size={20} />
                    </button>
                </div>

                {/* Stats */}
                <div style={styles.stats}>
                    <div style={styles.statItem}>
                        <span style={styles.statLabel}>Yeni Sorunlar</span>
                        <span style={styles.statValue}>{stats.newTickets}</span>
                    </div>
                    <div style={styles.statItem}>
                        <span style={styles.statLabel}>Bilgi Talepleri</span>
                        <span style={styles.statValue}>{stats.progressRequests}</span>
                    </div>
                    <div style={styles.statItem}>
                        <span style={styles.statLabel}>Yüksek Öncelik</span>
                        <span style={styles.statValue}>{stats.highPriority}</span>
                    </div>
                </div>

                {/* Filters */}
                <div style={styles.filters}>
                    <button
                        onClick={() => setFilter('all')}
                        style={{
                            ...styles.filterBtn,
                            ...(filter === 'all' ? styles.filterBtnActive : {})
                        }}
                    >
                        Tümü
                    </button>
                    <button
                        onClick={() => setFilter('unread')}
                        style={{
                            ...styles.filterBtn,
                            ...(filter === 'unread' ? styles.filterBtnActive : {})
                        }}
                    >
                        Okunmamış
                    </button>
                    <button
                        onClick={() => setFilter('progressRequest')}
                        style={{
                            ...styles.filterBtn,
                            ...(filter === 'progressRequest' ? styles.filterBtnActive : {})
                        }}
                    >
                        Bilgi Talepleri
                    </button>
                </div>

                {/* Actions */}
                {stats.totalUnread > 0 && (
                    <div style={styles.actions}>
                        <button onClick={handleMarkAllAsRead} style={styles.markAllBtn}>
                            <CheckCircle size={16} />
                            Tümünü Okundu İşaretle
                        </button>
                    </div>
                )}

                {/* Notifications List */}
                <div style={styles.notificationsList}>
                    {loading ? (
                        <div style={styles.loading}>Yükleniyor...</div>
                    ) : notifications.length === 0 ? (
                        <div style={styles.empty}>
                            <Bell size={48} color="#ccc" />
                            <p>Bildirim yok</p>
                        </div>
                    ) : (
                        notifications.map((notification) => (
                            <div
                                key={notification.id}
                                style={{
                                    ...styles.notificationItem,
                                    ...(notification.isRead ? {} : styles.notificationItemUnread)
                                }}
                                onClick={() => handleNotificationClick(notification)}
                            >
                                <div style={styles.notificationIcon}>
                                    {getNotificationIcon(notification.type, notification.priority)}
                                </div>
                                <div style={styles.notificationContent}>
                                    <div style={styles.notificationHeader}>
                                        <span style={styles.notificationType}>
                                            {getTypeLabel(notification.type)}
                                        </span>
                                        <span style={styles.notificationTime}>
                                            {formatDate(notification.createdAt)}
                                        </span>
                                    </div>
                                    <div style={styles.notificationTitle}>
                                        {notification.title}
                                    </div>
                                    <div style={styles.notificationMessage}>
                                        {notification.message}
                                    </div>
                                    <div style={styles.notificationTicket}>
                                        Sorun: #{notification.ticketCode}
                                    </div>
                                </div>
                                {!notification.isRead && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleMarkAsRead(notification.id);
                                        }}
                                        style={styles.markReadBtn}
                                        title="Okundu işaretle"
                                    >
                                        <Check size={16} />
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}

const styles = {
    backdrop: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 999,
    },
    panel: {
        position: 'fixed',
        top: 0,
        right: 0,
        width: '450px',
        height: '100vh',
        backgroundColor: 'white',
        boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.5rem',
        borderBottom: '1px solid #eee',
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
    },
    title: {
        fontSize: '1.25rem',
        fontWeight: '600',
        margin: 0,
    },
    badge: {
        backgroundColor: '#d32f2f',
        color: 'white',
        padding: '0.25rem 0.5rem',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: '600',
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        color: '#666',
    },
    stats: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
        padding: '1rem 1.5rem',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #eee',
    },
    statItem: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.25rem',
    },
    statLabel: {
        fontSize: '0.75rem',
        color: '#666',
        textAlign: 'center',
    },
    statValue: {
        fontSize: '1.5rem',
        fontWeight: 'bold',
        color: '#667eea',
    },
    filters: {
        display: 'flex',
        gap: '0.5rem',
        padding: '1rem 1.5rem',
        borderBottom: '1px solid #eee',
    },
    filterBtn: {
        flex: 1,
        padding: '0.5rem 1rem',
        border: '1px solid #ddd',
        borderRadius: '6px',
        background: 'white',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: '500',
        color: '#666',
        transition: 'all 0.2s',
    },
    filterBtnActive: {
        backgroundColor: '#667eea',
        color: 'white',
        borderColor: '#667eea',
    },
    actions: {
        padding: '0.75rem 1.5rem',
        borderBottom: '1px solid #eee',
    },
    markAllBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
        background: '#f0f0f0',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: '500',
        color: '#333',
        width: '100%',
        justifyContent: 'center',
    },
    notificationsList: {
        flex: 1,
        overflowY: 'auto',
        padding: '0.5rem',
    },
    notificationItem: {
        display: 'flex',
        gap: '1rem',
        padding: '1rem',
        borderRadius: '8px',
        marginBottom: '0.5rem',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        position: 'relative',
    },
    notificationItemUnread: {
        backgroundColor: '#e3f2fd',
    },
    notificationIcon: {
        flexShrink: 0,
    },
    notificationContent: {
        flex: 1,
        minWidth: 0,
    },
    notificationHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.25rem',
    },
    notificationType: {
        fontSize: '0.75rem',
        fontWeight: '600',
        color: '#667eea',
        textTransform: 'uppercase',
    },
    notificationTime: {
        fontSize: '0.75rem',
        color: '#999',
    },
    notificationTitle: {
        fontSize: '0.95rem',
        fontWeight: '600',
        color: '#333',
        marginBottom: '0.25rem',
    },
    notificationMessage: {
        fontSize: '0.875rem',
        color: '#666',
        marginBottom: '0.5rem',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
    },
    notificationTicket: {
        fontSize: '0.75rem',
        color: '#999',
        fontStyle: 'italic',
    },
    markReadBtn: {
        position: 'absolute',
        top: '1rem',
        right: '1rem',
        background: '#4caf50',
        color: 'white',
        border: 'none',
        borderRadius: '50%',
        width: '28px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    loading: {
        padding: '3rem',
        textAlign: 'center',
        color: '#999',
    },
    empty: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem',
        color: '#999',
    },
};