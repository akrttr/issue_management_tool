import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, Activity } from 'lucide-react';
import { ticketsAPI } from '../../services/api';

export default function ActivityCalendar({ onNavigate }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadActivitiesForMonth();
    }, [currentDate]);

    const loadActivitiesForMonth = async () => {
        setLoading(true);
        try {
            // Load all recent activities (you can increase limit if needed)
            const response = await ticketsAPI.getRecentActivities(500);
            setActivities(response.data || []);
        } catch (error) {
            console.error('Error loading activities:', error);
        } finally {
            setLoading(false);
        }
    };

    // Calendar navigation
    const goToPreviousMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    // Get month information
    const getMonthInfo = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        return { year, month, daysInMonth, startingDayOfWeek };
    };

    const getDayOfYear = (date) => {
        const start = new Date(date.getFullYear(), 0, 1); // Jan 1, same year
        const diff = date - start; // ms difference
        return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1; // 1..366
    };

    const getLocalDateString = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };


    // Get activities for a specific date
   const getActivitiesForDate = (date) => {
    const dateStr = getLocalDateString(date);
    // Calendar date: Dec 14, 2025
    // dateStr: "2025-12-14"  ✅ Correct!
    
    return activities.filter(activity => {
        const activityDate = new Date(activity.performedAt);
        const activityDateStr = getLocalDateString(activityDate);
        // Activity: "2025-12-14T09:46:12.74277Z" (UTC)
        // Converted to local: Dec 14, 2025 12:46 PM (Ankara)
        // activityDateStr: "2025-12-14"  ✅ Correct!
        
        return activityDateStr === dateStr;  // "2025-12-14" === "2025-12-14"  ✅
    });
};

    // Get action type label
    const getActionLabel = (actionType) => {
        const labels = {
            'Create': 'Oluşturuldu',
            'Edit': 'Güncellendi',
            'StatusChange': 'Durum Değişti',
            'Comment': 'İşlem Eklendi'
        };
        return labels[actionType] || actionType;
    };

    // Get action color
    const getActionColor = (actionType, toStatus) => {
        if (actionType === 'StatusChange') {
            switch (toStatus) {
                case 'CLOSED': return '#4caf50';
                case 'PAUSED': return '#ff9800';
                case 'CANCELLED': return '#f44336';
                case 'CONFIRMED': return '#2196f3';
                case 'REOPENED': return '#9c27b0';
                default: return '#667eea';
            }
        }
        if (actionType === 'Create') return '#4caf50';
        if (actionType === 'Comment') return '#2196f3';
        if (actionType === 'Edit') return '#ff9800';
        return '#667eea';
    };

    // Render calendar grid
    const renderCalendar = () => {
        const { year, month, daysInMonth, startingDayOfWeek } = getMonthInfo();
        const weeks = [];
        let currentWeek = [];

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            currentWeek.push(
                <div key={`empty-${i}`} style={styles.emptyDay} />
            );
        }

        // Add cells for each day of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dayActivities = getActivitiesForDate(date);
            const isToday = isSameDay(date, new Date());
            const dayOfYear = getDayOfYear(date);


            currentWeek.push(
                <div
                    key={day}
                    style={{
                        ...styles.dayCell,
                        ...(isToday ? styles.todayCell : {})
                    }}
                >
                    <div style={styles.dayNumber}>{day}
                        <span style={styles.dayOfYear}> ({dayOfYear})</span>
                    </div>
                    <div style={styles.activitiesContainer}>
                        {dayActivities.slice(0, 4).map(activity => {
                            const color = getActionColor(activity.actionType, activity.toStatus);
                            return (
                                <div
                                    key={activity.actionId}
                                    style={{
                                        ...styles.activityItem,
                                        borderLeftColor: color,
                                    }}
                                    onClick={() => onNavigate('ticket-detail', { ticketId: activity.ticketId })}
                                    title={`${activity.ticketExternalCode} - ${getActionLabel(activity.actionType)}`}
                                >
                                    <span style={styles.ticketCode}>
                                        {activity.ticketExternalCode}
                                    </span>
                                    <span
                                        style={{
                                            ...styles.actionBadge,
                                            backgroundColor: color
                                        }}
                                    >
                                        {getActionLabel(activity.actionType)}
                                    </span>
                                </div>
                            );
                        })}
                        {dayActivities.length > 4 && (
                            <div style={styles.moreActivities}>
                                +{dayActivities.length - 4} daha fazla
                            </div>
                        )}
                    </div>
                </div>
            );

            // Start a new week after Saturday
            if (currentWeek.length === 7) {
                weeks.push(
                    <div key={`week-${weeks.length}`} style={styles.weekRow}>
                        {currentWeek}
                    </div>
                );
                currentWeek = [];
            }
        }

        // Add empty cells for remaining days in the last week
        while (currentWeek.length > 0 && currentWeek.length < 7) {
            currentWeek.push(
                <div key={`empty-end-${currentWeek.length}`} style={styles.emptyDay} />
            );
        }

        // Add the last week if it has any days
        if (currentWeek.length > 0) {
            weeks.push(
                <div key={`week-${weeks.length}`} style={styles.weekRow}>
                    {currentWeek}
                </div>
            );
        }

        return weeks;
    };

    const isSameDay = (date1, date2) => {
        return date1.getDate() === date2.getDate() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getFullYear() === date2.getFullYear();
    };

    const monthNames = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];

    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

    // Get activity summary for current month
    const getMonthSummary = () => {
        const { year, month } = getMonthInfo();
        const monthActivities = activities.filter(activity => {
            const activityDate = new Date(activity.performedAt);
            return activityDate.getMonth() === month && activityDate.getFullYear() === year;
        });

        return {
            total: monthActivities.length,
            creates: monthActivities.filter(a => a.actionType === 'Create').length,
            statusChanges: monthActivities.filter(a => a.actionType === 'StatusChange').length,
            comments: monthActivities.filter(a => a.actionType === 'Comment').length,
            edits: monthActivities.filter(a => a.actionType === 'Edit').length,
        };
    };

    const summary = getMonthSummary();

    return (
        <div style={styles.pageContainer}>
            <div style={styles.container}>
                {/* Calendar Header */}
                <div style={styles.header}>
                    <div style={styles.headerLeft}>
                        <CalendarIcon size={28} style={{ color: '#667eea' }} />
                        <div>
                            <h2 style={styles.title}>
                                Aktivite Takvimi
                            </h2>
                            <p style={styles.subtitle}>
                                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                            </p>
                        </div>
                    </div>

                    <div style={styles.headerRight}>
                        <button onClick={goToToday} style={styles.todayButton}>
                            Bugün
                        </button>
                        <button onClick={goToPreviousMonth} style={styles.navButton}>
                            <ChevronLeft size={20} />
                        </button>
                        <button onClick={goToNextMonth} style={styles.navButton}>
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                {/* Summary Stats */}
                <div style={styles.summaryContainer}>
                    <div style={styles.summaryCard}>
                        <Activity size={20} style={{ color: '#667eea' }} />
                        <div>
                            <div style={styles.summaryValue}>{summary.total}</div>
                            <div style={styles.summaryLabel}>Toplam Aktivite</div>
                        </div>
                    </div>
                    <div style={styles.summaryCard}>
                        <div style={{ ...styles.summaryDot, backgroundColor: '#4caf50' }} />
                        <div>
                            <div style={styles.summaryValue}>{summary.creates}</div>
                            <div style={styles.summaryLabel}>Yeni Arıza</div>
                        </div>
                    </div>
                    <div style={styles.summaryCard}>
                        <div style={{ ...styles.summaryDot, backgroundColor: '#667eea' }} />
                        <div>
                            <div style={styles.summaryValue}>{summary.statusChanges}</div>
                            <div style={styles.summaryLabel}>Durum Değişikliği</div>
                        </div>
                    </div>
                    <div style={styles.summaryCard}>
                        <div style={{ ...styles.summaryDot, backgroundColor: '#2196f3' }} />
                        <div>
                            <div style={styles.summaryValue}>{summary.comments}</div>
                            <div style={styles.summaryLabel}>Yorum</div>
                        </div>
                    </div>
                    <div style={styles.summaryCard}>
                        <div style={{ ...styles.summaryDot, backgroundColor: '#ff9800' }} />
                        <div>
                            <div style={styles.summaryValue}>{summary.edits}</div>
                            <div style={styles.summaryLabel}>Güncelleme</div>
                        </div>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div style={styles.calendarContainer}>
                    {/* Day names header */}
                    <div style={styles.weekRow}>
                        {dayNames.map(day => (
                            <div key={day} style={styles.dayName}>
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar days */}
                    {loading ? (
                        <div style={styles.loading}>Yükleniyor...</div>
                    ) : (
                        renderCalendar()
                    )}
                </div>
            </div>
        </div>
    );
}

const styles = {
    pageContainer: {
        padding: '2rem',
        backgroundColor: '#f5f5f5',
        minHeight: 'calc(100vh - 80px)',
    },
    container: {
        maxWidth: '1400px',
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        paddingBottom: '1.5rem',
        borderBottom: '2px solid #f0f0f0',
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
    },
    title: {
        fontSize: '1.5rem',
        fontWeight: '600',
        color: '#333',
        margin: 0,
    },
    subtitle: {
        fontSize: '1rem',
        color: '#666',
        margin: '0.25rem 0 0 0',
    },
    headerRight: {
        display: 'flex',
        gap: '0.5rem',
    },
    todayButton: {
        padding: '0.6rem 1.2rem',
        backgroundColor: '#667eea',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: '500',
        transition: 'all 0.2s',
    },
    navButton: {
        padding: '0.6rem',
        backgroundColor: '#f5f5f5',
        color: '#666',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
    },
    summaryContainer: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
    },
    summaryCard: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem',
        backgroundColor: '#f9f9f9',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
    },
    summaryDot: {
        width: '20px',
        height: '20px',
        borderRadius: '50%',
    },
    summaryValue: {
        fontSize: '1.5rem',
        fontWeight: '700',
        color: '#333',
    },
    summaryLabel: {
        fontSize: '0.85rem',
        color: '#666',
    },
    calendarContainer: {
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        overflow: 'hidden',
    },
    weekRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        borderBottom: '1px solid #e0e0e0',
    },
    dayName: {
        padding: '1rem',
        textAlign: 'center',
        fontWeight: '600',
        fontSize: '0.9rem',
        color: '#666',
        backgroundColor: '#f9f9f9',
        borderRight: '1px solid #e0e0e0',
    },
    dayCell: {
        minHeight: '120px',
        padding: '0.75rem',
        borderRight: '1px solid #e0e0e0',
        backgroundColor: 'white',
        position: 'relative',
        transition: 'background-color 0.2s',
    },
    todayCell: {
        backgroundColor: '#f0f7ff',
        border: '2px solid #667eea',
    },
    emptyDay: {
        minHeight: '140px',
        backgroundColor: '#fafafa',
        borderRight: '1px solid #e0e0e0',
    },
    dayNumber: {
        fontSize: '1rem',
        fontWeight: '600',
        color: '#333',
        marginBottom: '0.5rem',
    },
    activitiesContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.20rem',
    },
    activityItem: {
        padding: '0.4rem 0.6rem',
        backgroundColor: '#f9f9f9',
        borderRadius: '4px',
        fontSize: '0.60rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.4rem',
        borderLeft: '3px solid #667eea',
        transition: 'all 0.2s',
        '&:hover': {
            backgroundColor: '#f0f0f0',
            transform: 'translateX(2px)',
        }
    },
    ticketCode: {
        fontWeight: '600',
        color: '#333',
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    actionBadge: {
        padding: '0.15rem 0.4rem',
        borderRadius: '3px',
        fontSize: '0.65rem',
        fontWeight: '500',
        color: 'white',
        whiteSpace: 'nowrap',
    },
    moreActivities: {
        fontSize: '0.7rem',
        color: '#999',
        padding: '0.25rem 0.5rem',
        fontStyle: 'italic',
        textAlign: 'center',
    },
    loading: {
        padding: '3rem',
        textAlign: 'center',
        color: '#999',
        fontSize: '1rem',
        gridColumn: '1 / -1',
    },

    dayOfYear: {
        fontSize: '0.75rem',
        color: '#888',
        marginLeft: '4px',
        fontWeight: '400',
    },

};