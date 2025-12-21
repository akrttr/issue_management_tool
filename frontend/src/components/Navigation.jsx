
import { useState, useEffect } from 'react';

import { LayoutDashboard, List, LogOut, User, Bell, Clock, PauseOctagonIcon, CogIcon, BadgeInfo, Calendar, Satellite } from "lucide-react";
import NotificationsPanel from './NotificationsPanel';
import { notificationsAPI } from '../../services/api';
import signalRService from '../../services/signalrService';





export default function Navigation({ currentPage, onNavigate }) {

    const userName = localStorage.getItem("displayName") || "DisplayName";
    const userRole = localStorage.getItem("role") || "UserRole";
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);

    useEffect(() => {
        loadUnreadCount();

        // Connect to SignalR
        const token = localStorage.getItem('token');
        if (token) {
            signalRService.connect(token);
        }

        // Request browser notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Listen for new notifications
        const handleNewNotification = () => {
            loadUnreadCount();
        };

        signalRService.on('NewNotification', handleNewNotification);

        return () => {
            signalRService.off('NewNotification');
        };
    }, []);

    const loadUnreadCount = async () => {
        try {
            const response = await notificationsAPI.getUnreadCount();
            setUnreadCount(response.data);
        } catch (error) {
            console.error('Error loading unread count:', error);
        }
    };

    const handleNotificationClick = (notification) => {
        // Navigate to the ticket
        if (notification.ticketId) {
            onNavigate('tickets', { ticketId: notification.ticketId });
        }
    };


    return (
        <>
            <nav style={styles.nav}>
                <div style={styles.brand}>
                    <span style={styles.brandIcon}>🛰️</span>
                    <span style={styles.brandText}>Satellite Ticket Tracker  </span>
                </div>
                <div style={styles.menu}>

                    <button onClick={() => onNavigate('dashboard')} style={{ ...styles.menuItem, ...(currentPage === 'dashboard' ? styles.activeMenuItem : {}) }} >
                        <LayoutDashboard size={18} /> Gösterge Paneli
                    </button>

                    <button
                        onClick={() => onNavigate('gkt1-tracker')}
                        style={{
                            ...styles.menuItem,
                            ...(currentPage === 'gkt1-tracker' ? styles.activeMenuItem : {})
                        }}
                    >
                        <Satellite size={18} /> GKT1 Takip
                    </button>

                    <button onClick={() => onNavigate('tickets')} style={{ ...styles.menuItem, ...(currentPage === 'tickets' ? styles.activeMenuItem : {}) }} >
                        <List size={18} />  Sorunlar
                    </button>

                    <button onClick={() => onNavigate('pause-management')} style={{ ...styles.menuItem, ...(currentPage === 'pause-management' ? styles.activeMenuItem : {}) }} >
                        <PauseOctagonIcon size={18} /> Durdurmalar
                    </button>

                    <button onClick={() => onNavigate('progress-management')} style={{ ...styles.menuItem, ...(currentPage === 'progress-management' ? styles.activeMenuItem : {}) }} >
                        <BadgeInfo size={18} /> Bilgi Talebi
                    </button>
                    <button onClick={() => onNavigate('calendar')} style={{ ...styles.menuItem, ...(currentPage === 'calendar' ? styles.activeMenuItem : {}) }} >
                        <Calendar size={18} /> Takvim
                    </button>


                    {userRole === 'Admin' && (
                        <button onClick={() => onNavigate('users')} style={{ ...styles.menuItem, ...(currentPage === 'users' ? styles.activeMenuItem : {}) }}  >
                            <CogIcon size={18} /> Kontrol Paneli
                        </button>
                    )}
                    <button
                        onClick={() => onNavigate('progress-requests')}
                        style={{
                            ...styles.menuItem,
                            ...(currentPage === 'progress-requests' ? styles.activeMenuItem : {})
                        }}
                    >
                        <Clock size={18} />
                        Bilgi Talepleri
                    </button>
                </div>


                <div style={styles.userSection}>
                    <button
                        onClick={() => setShowNotifications(true)}
                        style={styles.notificationBtn}
                        title="Bildirimler"
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span style={styles.notificationBadge}>
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </button>
                    <div style={styles.userInfo}>
                        <div style={styles.userName}>{userName}</div>
                        <div style={styles.userRole}>{userRole}</div>
                    </div>

                    <button
                        onClick={() => onNavigate('profile')}
                        style={{
                            ...styles.menuItem,
                            ...(currentPage === 'profile' ? styles.activeMenuItem : {}),
                        }}
                    >
                        <User size={18} />
                        Profilim
                    </button>
                    <button
                        onClick={async () => {
                            try {
                                await authAPI.logout();
                            } catch (error) {
                                console.error('Logout error:', error);
                            } finally {
                                localStorage.clear();
                                window.location.reload();
                            }
                        }}
                        style={styles.logoutBtn}
                        title="Logout"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </nav>

            <NotificationsPanel
                isOpen={showNotifications}
                onClose={() => {
                    setShowNotifications(false);
                    loadUnreadCount();
                }}
                onNotificationClick={handleNotificationClick}
            />
        </>
    );
}


const styles = {
    nav: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 2rem',
        background: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
    },
    brand: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
    },
    logo: {
        fontSize: '1.8rem',
    },
    brandText: {
        fontSize: '1.2rem',
        fontWeight: 'bold',
        color: '#333',
    },
    menu: {
        display: 'flex',
        gap: '0.5rem',
    },
    menuItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.6rem 1.2rem',
        background: 'transparent',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        color: '#666',
        fontWeight: '500',
        transition: 'all 0.2s',
    },
    activeMenuItem: {
        background: '#667eea',
        color: 'white',
    },
    userSection: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
    },
    userInfo: {
        textAlign: 'right',
    },
    userName: {
        fontWeight: '600',
        color: '#333',
        fontSize: '0.95rem',
    },
    userRole: {
        fontSize: '0.8rem',
        color: '#666',
    },
    logoutBtn: {
        padding: '0.6rem',
        background: '#f5f5f5',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        color: '#666',
        display: 'flex',
        alignItems: 'center',
    },
};
