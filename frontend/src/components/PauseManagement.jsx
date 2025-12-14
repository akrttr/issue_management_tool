import { useState, useEffect, useMemo } from 'react';
import { Clock, ChevronDown, ChevronRight, Search, ArrowUpDown, ExternalLink, Play, Trash2, Filter, Pause } from 'lucide-react';
import { ticketPausesAPI, ticketsAPI } from '../../services/api';
import { showConfirmToast } from './ConfirmToast';
import { toast } from 'react-toastify';

export default function PauseManagement({ onViewTicket, onNavigate }) {
    const [pauses, setPauses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'totalDuration', direction: 'desc' });
    const [expandedTickets, setExpandedTickets] = useState(new Set());
    const [filter, setFilter] = useState('all'); // 'all', 'active', 'completed'
    const [showResumeModal, setShowResumeModal] = useState(false);
    const [selectedPause, setSelectedPause] = useState(null);
    const [resumeNotes, setResumeNotes] = useState('');

    useEffect(() => {
        loadPauses();
    }, []);

    const loadPauses = async () => {
        try {
            setLoading(true);
            const response = await ticketPausesAPI.getAll();
            setPauses(response.data);
        } catch (error) {
            console.error('Error loading pauses:', error);
            toast.error('Duraklamalar yüklenirken hata oluştu');
        } finally {
            setLoading(false);
        }
    };


    const calculateDurationHours = (start, end) => {
        const startDate = new Date(start);
        const endDate = end ? new Date(end) : new Date();
        return Math.floor((endDate - startDate) / (1000 * 60 * 60)); // hours
    };



    // Group pauses by ticket ID
    // const groupedPauses = useMemo(() => {
    //     const groups = {};

    //     pauses.forEach(pause => {
    //         if (!groups[pause.ticketId]) {
    //             groups[pause.ticketId] = {
    //                 ticketId: pause.ticketId,
    //                 ticketCode: pause.ticketExternalCode,
    //                 pauses: [],
    //                 totalDuration: 0,
    //                 activePauseCount: 0,
    //                 completedPauseCount: 0,
    //                 hasActivePause: false
    //             };
    //         }

    //         groups[pause.ticketId].pauses.push(pause);
    //         groups[pause.ticketId].totalDuration += pause.durationDays;

    //         if (pause.isActive) {
    //             groups[pause.ticketId].activePauseCount++;
    //             groups[pause.ticketId].hasActivePause = true;
    //         } else {
    //             groups[pause.ticketId].completedPauseCount++;
    //         }
    //     });

    //     return Object.values(groups);
    // }, [pauses]);
    const groupedPauses = useMemo(() => {
        const groups = {};

        pauses.forEach(pause => {
            if (!groups[pause.ticketId]) {
                groups[pause.ticketId] = {
                    ticketId: pause.ticketId,
                    ticketCode: pause.ticketExternalCode,
                    pauses: [],
                    totalHours: 0,
                    activePauseCount: 0,
                    completedPauseCount: 0,
                    hasActivePause: false
                };
            }

            // Use backend hours if available, otherwise calculate
            const hours = pause.durationHours ?? calculateDurationHours(pause.pausedAt, pause.resumedAt);

            groups[pause.ticketId].pauses.push({
                ...pause,
                durationHours: hours
            });
            groups[pause.ticketId].totalHours += hours;

            if (pause.isActive) {
                groups[pause.ticketId].activePauseCount++;
                groups[pause.ticketId].hasActivePause = true;
            } else {
                groups[pause.ticketId].completedPauseCount++;
            }
        });

        return Object.values(groups);
    }, [pauses]);


    // Filter groups
    const filteredGroups = useMemo(() => {
        let filtered = groupedPauses;

        // Apply status filter
        if (filter === 'active') {
            filtered = filtered.filter(g => g.hasActivePause);
        } else if (filter === 'completed') {
            filtered = filtered.filter(g => !g.hasActivePause);
        }

        // Apply search
        if (searchTerm) {
            filtered = filtered.filter(group =>
                group.ticketCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                group.pauses.some(p =>
                    p.pauseReason.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    p.pausedByUserName.toLowerCase().includes(searchTerm.toLowerCase())
                )
            );
        }

        return filtered;
    }, [groupedPauses, searchTerm, filter]);

    // Sort groups
    const sortedGroups = useMemo(() => {
        const sorted = [...filteredGroups];

        sorted.sort((a, b) => {
            let aValue, bValue;

            switch (sortConfig.key) {
                case 'ticketCode':
                    aValue = a.ticketCode;
                    bValue = b.ticketCode;
                    break;
                case 'totalDuration':
                    aValue = a.totalDuration;
                    bValue = b.totalDuration;
                    break;
                case 'pauseCount':
                    aValue = a.pauses.length;
                    bValue = b.pauses.length;
                    break;
                case 'status':
                    aValue = a.hasActivePause ? 1 : 0;
                    bValue = b.hasActivePause ? 1 : 0;
                    break;
                default:
                    return 0;
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return sorted;
    }, [filteredGroups, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleDelete = async (id) => {
        const confirm = await showConfirmToast(`Bu duraklama kaydını silmek istediğinize emin misiniz?`);
        if (!confirm) { toast.info("İşlem iptal edildi."); return; }




        try {
            await ticketPausesAPI.delete(id);
            toast.success('Duraklama kaydı silindi');
            loadPauses();
        } catch (error) {
            console.error('Error deleting pause:', error);
            toast.error('Silme işlemi başarısız');
        }
    };


    const toggleExpand = (ticketId) => {
        setExpandedTickets(prev => {
            const newSet = new Set(prev);
            if (newSet.has(ticketId)) {
                newSet.delete(ticketId);
            } else {
                newSet.add(ticketId);
            }
            return newSet;
        });
    };

    const handleTicketClick = (ticketId) => {
        if (onViewTicket) {
            onViewTicket(ticketId);
        }
    };

    const handleResume = async () => {
        if (!selectedPause) return;

        try {
            await ticketPausesAPI.resume(selectedPause.id, { resumeNotes });
            toast.success('Duraklama sonlandırıldı');
            setShowResumeModal(false);
            setResumeNotes('');
            setSelectedPause(null);
            loadPauses();
        } catch (error) {
            console.error('Error resuming pause:', error);
            toast.error('Duraklama sonlandırılırken hata oluştu');
        }
    };

    //Format duration in hours with day approximation
    const formatDuration = (hours) => {
        if (hours === 0) return '0 saat';
        if (hours === 1) return '1 saat';
        if (hours < 24) return `${hours} saat`;

        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;

        if (remainingHours === 0) {
            return `${hours} saat (${days} gün)`;
        }
        return `${hours} saat (${days} gün ${remainingHours} saat)`;
    };

    //  Format total duration for subtotals
    const formatTotalDuration = (hours) => {
        const days = (hours / 24).toFixed(1);
        return `${hours} saat (~${days} gün)`;
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };


    if (loading) {
        return <div style={styles.loading}>Yükleniyor...</div>;
    }

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <h1 style={styles.title}>
                    <Clock size={28} />
                    Duraklama Yönetimi
                </h1>

                <div style={styles.stats}>
                    <div style={styles.statCard}>
                        <div style={styles.statValue}>{groupedPauses.length}</div>
                        <div style={styles.statLabel}>Toplam Sorun</div>
                    </div>
                    <div style={styles.statCard}>
                        <div style={styles.statValue}>{pauses.filter(p => p.isActive).length}</div>
                        <div style={styles.statLabel}>Aktif Duraklama</div>
                    </div>
                    <div style={styles.statCard}>
                        <div style={styles.statValue}>
                            {formatTotalDuration(groupedPauses.reduce((sum, g) => sum + g.totalHours, 0))}
                        </div>
                        <div style={styles.statLabel}>Toplam Süre</div>
                    </div>
                </div>
            </div>

            {/* Filters and Search */}
            <div style={styles.controls}>
                <div style={styles.searchContainer}>
                    <Search size={20} style={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Sorun numarası, sebep veya kullanıcı ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={styles.searchInput}
                    />
                </div>

                <div style={styles.filterButtons}>
                    <button
                        onClick={() => setFilter('all')}
                        style={{
                            ...styles.filterButton,
                            ...(filter === 'all' ? styles.filterButtonActive : {})
                        }}
                    >
                        <Filter size={16} />
                        Tümü ({groupedPauses.length})
                    </button>
                    <button
                        onClick={() => setFilter('active')}
                        style={{
                            ...styles.filterButton,
                            ...(filter === 'active' ? styles.filterButtonActive : {})
                        }}
                    >
                        Aktif ({groupedPauses.filter(g => g.hasActivePause).length})
                    </button>
                    <button
                        onClick={() => setFilter('completed')}
                        style={{
                            ...styles.filterButton,
                            ...(filter === 'completed' ? styles.filterButtonActive : {})
                        }}
                    >
                        Tamamlanan ({groupedPauses.filter(g => !g.hasActivePause).length})
                    </button>
                </div>
            </div>

            {/* Table */}
            <div style={styles.tableContainer}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={{ ...styles.th, width: '50px' }}></th>
                            <th
                                style={{ ...styles.th, ...styles.sortable, width: '150px' }}
                                onClick={() => handleSort('ticketCode')}
                            >
                                <div style={styles.thContent}>
                                    Ticket No
                                    <ArrowUpDown size={14} />
                                </div>
                            </th>
                            <th
                                style={{ ...styles.th, ...styles.sortable, width: '120px' }}
                                onClick={() => handleSort('pauseCount')}
                            >
                                <div style={styles.thContent}>
                                    Duraklama Sayısı
                                    <ArrowUpDown size={14} />
                                </div>
                            </th>
                            <th
                                style={{ ...styles.th, ...styles.sortable, width: '180px' }}
                                onClick={() => handleSort('totalDuration')}
                            >
                                <div style={styles.thContent}>
                                    Toplam Süre
                                    <ArrowUpDown size={14} />
                                </div>
                            </th>
                            <th
                                style={{ ...styles.th, ...styles.sortable, width: '120px' }}
                                onClick={() => handleSort('status')}
                            >
                                <div style={styles.thContent}>
                                    Durum
                                    <ArrowUpDown size={14} />
                                </div>
                            </th>
                            <th style={{ ...styles.th, width: '120px' }}>İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedGroups.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={styles.emptyCell}>
                                    {searchTerm
                                        ? 'Arama kriterlerine uygun kayıt bulunamadı'
                                        : 'Duraklama kaydı bulunamadı'}
                                </td>
                            </tr>
                        ) : (
                            sortedGroups.map((group) => (
                                <>
                                    {/* Group Row */}
                                    <tr
                                        key={`group-${group.ticketId}`}
                                        style={styles.groupRow}
                                    >
                                        <td style={styles.td}>
                                            <button
                                                onClick={() => toggleExpand(group.ticketId)}
                                                style={styles.expandButton}
                                            >
                                                {expandedTickets.has(group.ticketId)
                                                    ? <ChevronDown size={20} />
                                                    : <ChevronRight size={20} />
                                                }
                                            </button>
                                        </td>
                                        <td style={styles.td}>
                                            <div style={styles.ticketCodeCell}>
                                                <span style={styles.ticketCode}>
                                                    {group.ticketCode}
                                                </span>
                                                <button
                                                    onClick={() => handleTicketClick(group.ticketId)}
                                                    style={styles.linkButton}
                                                    title="Ticket detayına git"
                                                >
                                                    <ExternalLink size={16} />
                                                </button>
                                            </div>
                                        </td>
                                        <td style={styles.td}>
                                            <div style={styles.countBadge}>
                                                {group.pauses.length} duraklama
                                            </div>
                                        </td>
                                        <td style={styles.td}>
                                            <strong style={styles.totalDuration}>
                                                {formatTotalDuration(group.totalHours)}
                                            </strong>
                                        </td>
                                        <td style={styles.td}>
                                            <div style={styles.statusGroup}>
                                                {group.activePauseCount > 0 && (
                                                    <span style={styles.statusBadgeActive}>
                                                        {group.activePauseCount} Aktif
                                                    </span>
                                                )}
                                                {group.completedPauseCount > 0 && (
                                                    <span style={styles.statusBadgeCompleted}>
                                                        {group.completedPauseCount} Tamamlandı
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={styles.td}>
                                            <button
                                                onClick={() => toggleExpand(group.ticketId)}
                                                style={styles.viewButton}
                                            >
                                                {expandedTickets.has(group.ticketId) ? 'Gizle' : 'Detaylar'}
                                            </button>
                                        </td>
                                    </tr>

                                    {/* Expanded Detail Rows */}
                                    {expandedTickets.has(group.ticketId) && (
                                        <tr key={`expanded-${group.ticketId}`}>
                                            <td colSpan="6" style={styles.expandedCell}>
                                                <div style={styles.expandedContent}>
                                                    <table style={styles.detailTable}>
                                                        <thead>
                                                            <tr>
                                                                <th style={styles.detailTh}>#</th>
                                                                <th style={styles.detailTh}>Başlangıç</th>
                                                                <th style={styles.detailTh}>Bitiş</th>
                                                                <th style={styles.detailTh}>Süre</th>
                                                                <th style={styles.detailTh}>Sebep</th>
                                                                <th style={styles.detailTh}>Devam Notu</th>
                                                                <th style={styles.detailTh}>Durduran</th>
                                                                <th style={styles.detailTh}>Devam Ettiren</th>
                                                                <th style={styles.detailTh}>Durum</th>
                                                                <th style={styles.detailTh}>İşlem</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {group.pauses.map((pause, idx) => (
                                                                <tr key={pause.id} style={styles.detailTr}>
                                                                    <td style={styles.detailTd}>
                                                                        <span style={styles.pauseNumber}>
                                                                            #{idx + 1}
                                                                        </span>
                                                                    </td>
                                                                    <td style={styles.detailTd}>
                                                                        {formatDate(pause.pausedAt)}
                                                                    </td>
                                                                    <td style={styles.detailTd}>
                                                                        {pause.resumedAt
                                                                            ? formatDate(pause.resumedAt)
                                                                            : <em style={styles.ongoing}>Devam Ediyor</em>
                                                                        }
                                                                    </td>
                                                                    <td style={styles.detailTd}>
                                                                        {formatDuration(pause.durationHours)}
                                                                    </td>
                                                                    <td style={styles.detailTd}>
                                                                        <div style={styles.reasonCell}>
                                                                            {pause.pauseReason}
                                                                        </div>
                                                                    </td>
                                                                    <td style={styles.detailTd}>
                                                                        <div style={styles.reasonCell}>
                                                                            {pause.resumeNotes || '-'}
                                                                        </div>
                                                                    </td>
                                                                    <td style={styles.detailTd}>
                                                                        {pause.pausedByUserName}
                                                                    </td>
                                                                    <td style={styles.detailTd}>
                                                                        {pause.resumedByUserName || '-'}
                                                                    </td>
                                                                    <td style={styles.detailTd}>
                                                                        {pause.isActive ? (
                                                                            <span style={styles.statusActive}>
                                                                                <Pause size={14} />
                                                                                Aktif
                                                                            </span>
                                                                        ) : (
                                                                            <span style={styles.statusCompleted}>
                                                                                <Play size={14} />
                                                                                Tamamlandı
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td style={styles.detailTd}>
                                                                        <div style={styles.actions}>
                                                                            {pause.isActive && (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setSelectedPause(pause);
                                                                                        setShowResumeModal(true);
                                                                                    }}
                                                                                    style={styles.resumeButton}
                                                                                    title="Devam Ettir"
                                                                                >
                                                                                    <Play size={16} />
                                                                                </button>
                                                                            )}
                                                                            <button
                                                                                onClick={() => handleDelete(pause.id)}
                                                                                style={styles.deleteButton}
                                                                                title="Sil"
                                                                            >
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot>
                                                            <tr style={styles.subtotalRow}>
                                                                <td colSpan="3" style={styles.subtotalLabel}>
                                                                    <strong>Ara Toplam:</strong>
                                                                </td>
                                                                <td style={styles.subtotalValue}>
                                                                    <strong>{formatTotalDuration(group.totalHours)}</strong>
                                                                </td>
                                                                <td colSpan="6"></td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Resume Modal */}
            {showResumeModal && (
                <>
                    <div style={styles.modalBackdrop} onClick={() => setShowResumeModal(false)} />
                    <div style={styles.modal}>
                        <h2 style={styles.modalTitle}>Duraklamayı Sonlandır</h2>
                        <p style={styles.modalSubtitle}>
                            Ticket: <strong>{selectedPause?.ticketExternalCode}</strong>
                        </p>

                        <div style={styles.modalField}>
                            <label style={styles.label}>Devam Notu (Opsiyonel)</label>
                            <textarea
                                value={resumeNotes}
                                onChange={(e) => setResumeNotes(e.target.value)}
                                style={styles.textarea}
                                rows={4}
                                placeholder="Duraklamanın neden sonlandırıldığını açıklayın..."
                            />
                        </div>

                        <div style={styles.modalActions}>
                            <button
                                onClick={() => {
                                    setShowResumeModal(false);
                                    setResumeNotes('');
                                    setSelectedPause(null);
                                }}
                                style={styles.cancelButton}
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleResume}
                                style={styles.confirmButton}
                            >
                                <Play size={16} />
                                Devam Ettir
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// Styles remain the same as before
const styles = {
    container: {
        padding: '2rem',
        maxWidth: '1600px',
        margin: '0 auto',
    },
    header: {
        marginBottom: '2rem',
    },
    title: {
        fontSize: '1.8rem',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        color: '#333',
        marginBottom: '1.5rem',
    },
    stats: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
    },
    statCard: {
        padding: '1.5rem',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        textAlign: 'center',
    },
    statValue: {
        fontSize: '1.5rem',
        fontWeight: 'bold',
        color: '#667eea',
        marginBottom: '0.5rem',
    },
    statLabel: {
        fontSize: '0.9rem',
        color: '#666',
    },
    controls: {
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    searchContainer: {
        position: 'relative',
        flex: '1 1 300px',
    },
    searchIcon: {
        position: 'absolute',
        left: '1rem',
        top: '50%',
        transform: 'translateY(-50%)',
        color: '#999',
    },
    searchInput: {
        width: '100%',
        padding: '0.75rem 1rem 0.75rem 3rem',
        border: '2px solid #e0e0e0',
        borderRadius: '8px',
        fontSize: '0.95rem',
        transition: 'border-color 0.2s',
    },
    filterButtons: {
        display: 'flex',
        gap: '0.5rem',
    },
    filterButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1rem',
        border: '2px solid #667eea',
        borderRadius: '8px',
        background: 'white',
        color: '#667eea',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: '500',
        transition: 'all 0.2s',
    },
    filterButtonActive: {
        background: '#667eea',
        color: 'white',
    },
    loading: {
        textAlign: 'center',
        padding: '3rem',
        fontSize: '1.2rem',
        color: '#666',
    },
    tableContainer: {
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        overflow: 'hidden',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
    },
    th: {
        padding: '1rem',
        textAlign: 'left',
        backgroundColor: '#f8f9fa',
        borderBottom: '2px solid #dee2e6',
        fontWeight: '600',
        fontSize: '0.9rem',
        color: '#495057',
    },
    sortable: {
        cursor: 'pointer',
        userSelect: 'none',
    },
    thContent: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    groupRow: {
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
    },
    td: {
        padding: '1rem',
        fontSize: '0.9rem',
        color: '#333',
    },
    emptyCell: {
        padding: '3rem',
        textAlign: 'center',
        color: '#999',
        fontStyle: 'italic',
    },
    expandButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '0.25rem',
        display: 'flex',
        alignItems: 'center',
        color: '#667eea',
    },
    ticketCodeCell: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    ticketCode: {
        fontFamily: 'monospace',
        fontSize: '1rem',
        fontWeight: 'bold',
        color: '#667eea',
    },
    linkButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '0.25rem',
        color: '#667eea',
        display: 'flex',
        alignItems: 'center',
    },
    countBadge: {
        display: 'inline-block',
        padding: '0.25rem 0.75rem',
        borderRadius: '12px',
        backgroundColor: '#e3f2fd',
        color: '#1976d2',
        fontSize: '0.85rem',
        fontWeight: '600',
    },
    totalDuration: {
        color: '#667eea',
        fontSize: '1rem',
    },
    statusGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
    },
    statusBadgeActive: {
        display: 'inline-block',
        padding: '0.25rem 0.75rem',
        borderRadius: '12px',
        backgroundColor: '#fff3cd',
        color: '#856404',
        fontSize: '0.8rem',
        fontWeight: '600',
    },
    statusBadgeCompleted: {
        display: 'inline-block',
        padding: '0.25rem 0.75rem',
        borderRadius: '12px',
        backgroundColor: '#d4edda',
        color: '#155724',
        fontSize: '0.8rem',
        fontWeight: '600',
    },
    viewButton: {
        padding: '0.5rem 1rem',
        border: '1px solid #667eea',
        borderRadius: '6px',
        background: 'white',
        color: '#667eea',
        cursor: 'pointer',
        fontSize: '0.85rem',
        fontWeight: '500',
        transition: 'all 0.2s',
    },
    expandedCell: {
        padding: '0',
        backgroundColor: '#fafbfc',
    },
    expandedContent: {
        padding: '1.5rem',
    },
    detailTable: {
        width: '100%',
        borderCollapse: 'collapse',
        backgroundColor: 'white',
        borderRadius: '6px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    detailTh: {
        padding: '0.75rem',
        textAlign: 'left',
        backgroundColor: '#667eea',
        color: 'white',
        fontWeight: '600',
        fontSize: '0.85rem',
    },
    detailTr: {
        borderBottom: '1px solid #e0e0e0',
    },
    detailTd: {
        padding: '0.75rem',
        fontSize: '0.85rem',
        color: '#333',
    },
    pauseNumber: {
        fontWeight: 'bold',
        color: '#667eea',
    },
    ongoing: {
        color: '#f57c00',
        fontWeight: '600',
    },
    reasonCell: {
        maxWidth: '250px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    statusActive: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.3rem 0.8rem',
        borderRadius: '12px',
        backgroundColor: '#fff3cd',
        color: '#856404',
        fontSize: '0.8rem',
        fontWeight: '600',
    },
    statusCompleted: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.3rem 0.8rem',
        borderRadius: '12px',
        backgroundColor: '#d4edda',
        color: '#155724',
        fontSize: '0.8rem',
        fontWeight: '600',
    },
    actions: {
        display: 'flex',
        gap: '0.5rem',
    },
    resumeButton: {
        padding: '0.5rem',
        border: 'none',
        borderRadius: '4px',
        backgroundColor: '#28a745',
        color: 'white',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        transition: 'background-color 0.2s',
    },
    deleteButton: {
        padding: '0.5rem',
        border: 'none',
        borderRadius: '4px',
        backgroundColor: '#dc3545',
        color: 'white',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        transition: 'background-color 0.2s',
    },
    subtotalRow: {
        backgroundColor: '#f8f9fa',
        borderTop: '2px solid #667eea',
    },
    subtotalLabel: {
        padding: '0.75rem',
        textAlign: 'right',
        fontSize: '0.9rem',
        color: '#333',
    },
    subtotalValue: {
        padding: '0.75rem',
        fontSize: '1rem',
        color: '#667eea',
    },
    modalBackdrop: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
    },
    modal: {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        zIndex: 1001,
        minWidth: '500px',
    },
    modalTitle: {
        fontSize: '1.5rem',
        fontWeight: 'bold',
        marginBottom: '0.5rem',
        color: '#333',
    },
    modalSubtitle: {
        fontSize: '0.95rem',
        color: '#666',
        marginBottom: '1.5rem',
    },
    modalField: {
        marginBottom: '1.5rem',
    },
    label: {
        display: 'block',
        marginBottom: '0.5rem',
        fontSize: '0.9rem',
        fontWeight: '500',
        color: '#555',
    },
    textarea: {
        width: '100%',
        padding: '0.75rem',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '0.9rem',
        fontFamily: 'inherit',
        resize: 'vertical',
    },
    modalActions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '0.75rem',
    },
    cancelButton: {
        padding: '0.7rem 1.5rem',
        border: '1px solid #ddd',
        borderRadius: '4px',
        background: 'white',
        color: '#666',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: '500',
    },
    confirmButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.7rem 1.5rem',
        border: 'none',
        borderRadius: '4px',
        background: '#28a745',
        color: 'white',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: '500',
    },
};