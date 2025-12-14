import { useState, useEffect } from "react";
import { dashboardAPI, ticketsAPI } from "../../services/api";
import {
    LineChart, Line, XAxis,
    YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer, BarChart, Bar, Pie, PieChart, Cell,
} from "recharts";



import { Clock, CheckCircle, AlertCircle, Box, Users, Network, Activity, TrendingUp } from "lucide-react";

import RecentActivitiesTimeline from './RecentctivitiesTimeline.jsx';

export default function Dashboard({ onCreateTicket, onNavigate }) {
    const [stats, setStats] = useState({});
    const [ongoingTickets, setOngoingTickets] = useState([]);
    const [recentTickets, setRecentTickets] = useState([]);
    const [loading, setLoading] = useState([]);

    const [systemStats, setSystemStats] = useState([]);
    const [subsystemStats, setSubsystemStats] = useState([]);
    const [ciStats, setCiStats] = useState([]);
    const [activities, setActivities] = useState([]);


    const STATUS_LABELS = {
        'OPEN': 'Açık',
        'PAUSED': 'Duduruldu',
        'CONFIRMED': 'Doğrulandı',
        'CLOSED': 'Kapandı',
        'REOPENED': 'Tekrar Açıldı',
        'CANCELLED': 'İptal'
    };


    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            setLoading(true);
            const [dashResponse, allTicketRespons] = await Promise.all([
                dashboardAPI.getStats(),
                ticketsAPI.getAll(),

            ]);
            const response = await ticketsAPI.getRecentActivities(500);
            setActivities(response.data || []);
            setStats(dashResponse.data.statusCounts);
            setOngoingTickets(dashResponse.data.ongoingTickets);
            if (dashResponse.data.systemStats) setSystemStats(dashResponse.data.systemStats);
            if (dashResponse.data.subsystemStats) setSubsystemStats(dashResponse.data.subsystemStats);
            if (dashResponse.data.ciStats) setCiStats(dashResponse.data.ciStats);


            // Get recent tickets (sorted by Date Created )
            const allTickets = allTicketRespons.data.items || allTicketRespons.data;
            const recent = allTickets
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5);
            setRecentTickets(recent);

        } catch (error) {
            console.error("Failed to load dashboard data", error);
        } finally {
            setLoading(false);
        }
    };
    const getStatusColor = (status) => {
        const colors = {
            OPEN: '#2196f3',
            CONFIRMED: '#ff9800',
            PAUSED: '#9c27b0',
            CLOSED: '#4caf50',
            CANCELLED: '#f44336',
            REOPENED: '#e91e63',
        };
        return colors[status] || '#757575';
    };

    const getStatusBadgeStyle = (status) => ({
        ...styles.statusBadge,
        backgroundColor: getStatusColor(status) + '20',
        color: getStatusColor(status),
    });

    const getActivitySummary = () => {
        return {
            total: activities.length,
            creates: activities.filter(a => a.actionType === 'Create').length,
            statusChanges: activities.filter(a => a.actionType === 'StatusChange').length,
            comments: activities.filter(a => a.actionType === 'Comment').length,
            edits: activities.filter(a => a.actionType === 'Edit').length,
        };
    };

    const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
        const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);

        return (
            <text
                x={x}
                y={y}
                fill="white"
                textAnchor={x > cx ? 'start' : 'end'}
                dominantBaseline="central"
                style={{ fontSize: '14px', fontWeight: 'bold' }}
            >
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    const activitySummary = getActivitySummary();

    // Prepare chart data from stats 

    // const chartData = Object.entries(stats).map(([status, count]) => ({
    //     name: status,
    //     count: count,
    // }));

    const chartData = Object.entries(stats).map(([status, count]) => ({
        name: STATUS_LABELS[status] || status,
        count: count,
        originalStatus: status
    }));

    const userName = localStorage.getItem("displayName");
    const userRole = localStorage.getItem("role");

    const getFullSummary = () => {


        return {
            total: activities.length,
            creates: activities.filter(a => a.actionType === 'Create').length,
            statusChanges: activities.filter(a => a.actionType === 'StatusChange').length,
            comments: activities.filter(a => a.actionType === 'Comment').length,
            edits: activities.filter(a => a.actionType === 'Edit').length,
        };
    };

    const summary = getFullSummary();


    const activityChartData = [
        { name: 'Yeni Arıza', value: activitySummary.creates, color: '#4caf50' },
        { name: 'Durum Değişikliği', value: activitySummary.statusChanges, color: '#667eea' },
        { name: 'İşlem', value: activitySummary.comments, color: '#2196f3' },
        { name: 'Güncelleme', value: activitySummary.edits, color: '#ff9800' },
    ];


    if (loading) {
        return <div style={styles.loading} >Loading dashboard...</div>;
    }

    return (
        <div style={styles.container}>


            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Gösterge Paneli</h1>
                    <p style={styles.subtitle}>{userName}</p>
                </div>
            </div>
            {/* Quick Actions */}
            <div style={styles.statsGrid}>
                {(userRole === 'Editor' || userRole === 'Admin') && (
                    <div style={styles.quickActions}>  <button
                        onClick={onCreateTicket}
                        style={{ ...styles.button, ...styles.createButton }}
                    >
                        + Yeni Sorun
                    </button>

                        <button
                            onClick={() => onNavigate('tickets')}
                            style={styles.viewAllBtn}
                        >
                            Hepsini Gör
                        </button>
                    </div>
                )}
            </div>


            {/* Stats Cards */}
            <div style={styles.statsGrid}>
                <div style={{ ...styles.statCard, borderLeft: '4px solid #2196f3' }}>
                    <div style={{ ...styles.statIcon, backgroundColor: '#e3f2fd' }}>
                        <Clock size={24} color="#2196f3" />
                    </div>
                    <div>
                        <div style={styles.statValue}>{stats.OPEN || 0}</div>
                        <div style={styles.statLabel}>Açık Sorunlar</div>
                    </div>
                </div>

                <div style={{ ...styles.statCard, borderLeft: '4px solid #ff9800' }}>
                    <div style={{ ...styles.statIcon, backgroundColor: '#fff3e0' }}>
                        <AlertCircle size={24} color="#ff9800" />
                    </div>
                    <div>
                        <div style={styles.statValue}>{stats.CONFIRMED || 0}</div>
                        <div style={styles.statLabel}>Onaylanmış</div>
                    </div>
                </div>

                <div style={{ ...styles.statCard, borderLeft: '4px solid #4caf50' }}>
                    <div style={{ ...styles.statIcon, backgroundColor: '#e8f5e9' }}>
                        <CheckCircle size={24} color="#4caf50" />
                    </div>
                    <div>
                        <div style={styles.statValue}>{stats.CLOSED || 0}</div>
                        <div style={styles.statLabel}>Kapalı</div>
                    </div>
                </div>

                <div style={{ ...styles.statCard, borderLeft: '4px solid #9c27b0' }}>
                    <div style={{ ...styles.statIcon, backgroundColor: '#f3e5f5' }}>
                        <Users size={24} color="#9c27b0" />
                    </div>
                    <div>
                        <div style={styles.statValue}>
                            {Object.values(stats).reduce((a, b) => a + b, 0)}
                        </div>
                        <div style={styles.statLabel}>Toplam Sorun</div>
                    </div>
                </div>
            </div>

            <div style={styles.activitySummarySection}>
                <h3 style={styles.sectionTitle}>
                    <Activity size={20} />
                    Tüm Aktivitelerin Özeti
                </h3>
                <br />
                <div style={styles.activitySummaryGrid}>
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
                                <div style={styles.summaryLabel}>İşlem</div>
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
                </div>

                 {/* Activity Charts - Bar and Pie */}
            <div style={styles.chartsRow}>
                {/* Activity Bar Chart */}
                <div style={styles.chartCard}>
                    <h3 style={styles.cardTitle}>
                        <TrendingUp size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                        Aktivite Türlerine Göre Dağılım
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={activityChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                {activityChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Activity Pie Chart */}
                <div style={styles.chartCard}>
                    <h3 style={styles.cardTitle}>
                        <Activity size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                        Aktivite Yoğunluk Dağılımı                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={activityChartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={renderCustomLabel}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {activityChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            </div>



            {(systemStats.length > 0 || subsystemStats.length > 0 || ciStats.length > 0) && (
                <div style={styles.hierarchyStatsRow}>
                    {/* Systems Stats */}
                    {systemStats.length > 0 && (
                        <div style={styles.chartCard}>
                            <h3 style={styles.cardTitle}>
                                <Network size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                                Sistemlere Göre Sorunlar
                            </h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={systemStats}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="openCount" fill="#2196f3" name="Açık" stackId="a" />
                                    <Bar dataKey="closedCount" fill="#4caf50" name="Kapalı" stackId="a" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Subsystems Stats */}
                    {subsystemStats.length > 0 && (
                        <div style={styles.chartCard}>
                            <h3 style={styles.cardTitle}>
                                <Layers size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                                Alt Sistemlere Göre Sorunlar
                            </h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={subsystemStats.slice(0, 10)}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="openCount" fill="#ff9800" name="Açık" stackId="a" />
                                    <Bar dataKey="closedCount" fill="#388e3c" name="Kapalı" stackId="a" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
              

                    {/* CI Stats */}
                    {ciStats.length > 0 && (
                        <div style={styles.chartCard}>
                            <h3 style={styles.cardTitle}>
                                <Box size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                                CI'lere Göre Sorunlar
                            </h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={ciStats.slice(0, 10)}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="openCount" fill="#9c27b0" name="Açık" stackId="a" />
                                    <Bar dataKey="closedCount" fill="#689f38" name="Kapalı" stackId="a" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}

            {/* Two Column Layout */}
            <div style={styles.contentGrid}>
                {/* Ongoing Tickets */}
                <div style={styles.card}>
                    <div style={styles.cardHeader}>
                        <h3 style={styles.cardTitle}>Devam Eden Sorunlar</h3>
                        <span style={styles.badge}>{ongoingTickets.length} Aktif sorun var </span>
                    </div>
                    <div style={styles.taskList}>
                        {ongoingTickets.length === 0 ? (
                            <div style={styles.emptyState}>Devem eden bir sorun yok</div>
                        ) : (
                            ongoingTickets.map((ticket) => (
                                <div key={ticket.id} style={styles.taskItem}>
                                    <div style={styles.taskLeft}>

                                        <div>
                                            <div style={styles.taskTitle}>{ticket.externalCode}</div>
                                            <div style={styles.taskMeta}>
                                                {ticket.title}  <br />    {new Date(ticket.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={styles.taskRight}>
                                        <span style={getStatusBadgeStyle(ticket.status)}>
                                            {ticket.status}
                                        </span>
                                        {ticket.isBlocking && (
                                            <span style={styles.blockingBadge}>BLOCKING</span>
                                        )}
                                        {ticket.hasCICompleted && (
                                            <span style={styles.ciBadge}>✓ CI</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Recent Tickets */}
                <RecentActivitiesTimeline
                    onTicketClick={(ticketId) => {
                        if (ticketId !== ticket?.id) {
                            // Optionally close current and open new ticket
                            console.log('Navigate to ticket:', ticketId);
                        }
                    }}
                />
                {/* Charts Row */}
                <div style={styles.chartsRow}>
                    <div style={styles.chartCard}>
                        <h3 style={styles.cardTitle}>Durumuna göre sorunlar</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="count" fill="#667eea" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div style={styles.chartCard}>
                        <h3 style={styles.cardTitle}>Sorun Eğilimleri</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Line type="monotone" dataKey="count" stroke="#4caf50" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div style={styles.card}>
                    <div style={styles.cardHeader}>
                        <h3 style={styles.cardTitle}>Son Açılan Sorunlar</h3>
                        <button
                            onClick={() => onNavigate('tickets')}
                            style={styles.viewAllBtn}
                        >
                            Hepsini Gör
                        </button>
                    </div>
                    <div style={styles.taskList}>
                        {recentTickets.map((ticket) => (
                            <div key={ticket.id} style={styles.taskItem}>
                                <div style={styles.taskLeft}>
                                    <div style={{
                                        ...styles.avatar,
                                        backgroundColor: getStatusColor(ticket.status)
                                    }}>
                                        {ticket.title.charAt(0)}
                                    </div>
                                    <div>
                                        <div style={styles.taskTitle}>{ticket.externalCode}</div>
                                        <div style={styles.taskMeta}>
                                            {ticket.title} <br />
                                            {new Date(ticket.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                                <span style={getStatusBadgeStyle(ticket.status)}>
                                    {ticket.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>




        </div>
    );
}

const styles = {
    container: {
        padding: '2rem',
        maxWidth: '1600px',
        margin: '0 auto',
        backgroundColor: '#f5f5f5',
        minHeight: '100vh',
    },
    createButton: {
        backgroundColor: '#4caf50',
        color: 'white',
    },
    button: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.6rem 1.2rem',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: '500',
        transition: 'all 0.2s',
    },
    loading: {
        textAlign: 'center',
        padding: '3rem',
        fontSize: '1.2rem',
        color: '#666',
    },
    header: {
        marginBottom: '2rem',
    },
    title: {
        fontSize: '2rem',
        fontWeight: 'bold',
        margin: 0,
        color: '#333',
    },
    subtitle: {
        color: '#666',
        marginTop: '0.5rem',
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem',
    },
    statCard: {
        background: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    statIcon: {
        width: '50px',
        height: '50px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statValue: {
        fontSize: '2rem',
        fontWeight: 'bold',
        color: '#333',
    },
    statLabel: {
        fontSize: '0.9rem',
        color: '#666',
        marginTop: '0.25rem',
    },
    chartsRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem',
    },
    chartCard: {
        background: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    contentGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem',
    },
    card: {
        background: 'white',
        borderRadius: '8px',
        padding: '1.5rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid #eee',
    },
    cardTitle: {
        fontSize: '1.2rem',
        fontWeight: '600',
        margin: 0,
        color: '#333',
    },
    badge: {
        padding: '0.25rem 0.75rem',
        background: '#e3f2fd',
        color: '#1976d2',
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: '500',
    },
    viewAllBtn: {
        padding: '0.4rem 1rem',
        background: 'transparent',
        color: '#667eea',
        border: '1px solid #667eea',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: '500',
    },
    taskList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    },
    emptyState: {
        textAlign: 'center',
        padding: '2rem',
        color: '#999',
    },
    taskItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem',
        background: '#fafafa',
        borderRadius: '6px',
        transition: 'background 0.2s',
    },
    taskLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flex: 1,
    },
    checkbox: {
        width: '18px',
        height: '18px',
        cursor: 'pointer',
    },
    taskTitle: {
        fontWeight: '500',
        color: '#333',
        marginBottom: '0.25rem',
    },
    taskMeta: {
        fontSize: '0.85rem',
        color: '#666',
    },
    taskRight: {
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
    },
    avatar: {
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 'bold',
        fontSize: '1.1rem',
    },
    statusBadge: {
        padding: '0.3rem 0.8rem',
        borderRadius: '12px',
        fontSize: '0.8rem',
        fontWeight: '500',
    },
    blockingBadge: {
        padding: '0.2rem 0.6rem',
        background: '#ffebee',
        color: '#c62828',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: '600',
    },
    ciBadge: {
        padding: '0.2rem 0.6rem',
        background: '#e8f5e9',
        color: '#388e3c',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: '500',
    },
    quickActions: {
        display: 'flex',
        gap: '1rem',
        justifyContent: 'right',
    },
    actionButton: {
        padding: '0.8rem 2rem',
        background: '#667eea',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: '500',
        fontSize: '1rem',
    },
    secondaryButton: {
        background: 'white',
        color: '#667eea',
        border: '2px solid #667eea',
    },
    activitySummarySection: {
        marginBottom: '2rem',
    },
    activitySummaryGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
    },
    activitySummaryCard: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem',
        backgroundColor: '#fff',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
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
};