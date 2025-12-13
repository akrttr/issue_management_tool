import { useState, useEffect, useMemo } from 'react';
import {
    Clock,
    ChevronDown,
    ChevronUp,
    ChevronRight,
    Search,
    ArrowUpDown,
    ExternalLink,
    CheckCircle,
    Trash2,
    Filter,
    MessageSquare,
    TrendingUp,
    History
} from 'lucide-react';
import { progressRequestsAPI } from '../../services/api';
import { toast } from "react-toastify";

export default function ProgressRequestManagement({ onViewTicket, onNavigate }) {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'totalDuration', direction: 'desc' });
    const [expandedTickets, setExpandedTickets] = useState(new Set());
    const [filter, setFilter] = useState('all');
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [showRespondModal, setShowRespondModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [progressInfo, setProgressInfo] = useState('');
    const [progressPercentage, setProgressPercentage] = useState(0);
    const [estimatedCompletion, setEstimatedCompletion] = useState('');
    const [responseNotes, setResponseNotes] = useState('');
    const [expandedRequestUpdates, setExpandedRequestUpdates] = useState(new Set());


    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        try {
            setLoading(true);
            const response = await progressRequestsAPI.getAll();
            setRequests(response.data);
        } catch (error) {
            console.error('Error loading progress requests:', error);
            toast.error('Bilgi talepleri yüklenirken hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    const toggleRequestUpdates = (requestId) => {
        const newExpanded = new Set(expandedRequestUpdates);
        if (newExpanded.has(requestId)) {
            newExpanded.delete(requestId);
        } else {
            newExpanded.add(requestId);
        }
        setExpandedRequestUpdates(newExpanded);
    };
    const calculateDurationHours = (start, end) => {
        const startDate = new Date(start);
        const endDate = end ? new Date(end) : new Date();
        return Math.floor((endDate - startDate) / (1000 * 60 * 60));
    };

    // Group requests by ticket ID
    const groupedRequests = useMemo(() => {
        const groups = {};

        requests.forEach(req => {
            if (!groups[req.ticketId]) {
                groups[req.ticketId] = {
                    ticketId: req.ticketId,
                    ticketCode: req.ticketCode,
                    requests: [],
                    totalHours: 0,
                    pendingCount: 0,
                    respondedCount: 0,
                    hasPending: false,
                    latestProgress: null
                };
            }


            const hours = req.durationHours ?? calculateDurationHours(req.requestedAt, req.respondedAt);

            groups[req.ticketId].requests.push({
                ...req,
                durationHours: hours
            });
            groups[req.ticketId].totalHours += hours;

            if (!req.isResponded) {
                groups[req.ticketId].pendingCount++;
                groups[req.ticketId].hasPending = true;
            } else {
                groups[req.ticketId].respondedCount++;
            }

            // Track latest progress
            if (req.progressInfo && (!groups[req.ticketId].latestProgress ||
                new Date(req.requestedAt) > new Date(groups[req.ticketId].latestProgress.requestedAt))) {
                groups[req.ticketId].latestProgress = req;
            }
        });

        return Object.values(groups);
    }, [requests]);

    // Filter and sort similar to PauseManagement
    const filteredGroups = useMemo(() => {
        let filtered = groupedRequests;

        if (filter === 'pending') {
            filtered = filtered.filter(g => g.hasPending);
        } else if (filter === 'responded') {
            filtered = filtered.filter(g => !g.hasPending);
        }

        if (searchTerm) {
            filtered = filtered.filter(group =>
                group.ticketCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                group.requests.some(r =>
                    (r.requestMessage && r.requestMessage.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    r.requestedByUserName.toLowerCase().includes(searchTerm.toLowerCase())
                )
            );
        }

        return filtered;
    }, [groupedRequests, searchTerm, filter]);

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
                    aValue = a.totalHours;
                    bValue = b.totalHours;
                    break;
                case 'requestCount':
                    aValue = a.requests.length;
                    bValue = b.requests.length;
                    break;
                case 'status':
                    aValue = a.hasPending ? 1 : 0;
                    bValue = b.hasPending ? 1 : 0;
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

    const toggleExpand = (ticketId) => {
        debugger;
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

    const handleUpdateProgress = async () => {
        if (!selectedRequest) return;
        if (!progressInfo.trim()) {
            toast.warn('Lütfen ilerleme bilgisi giriniz');
            return;
        }

        try {
            await progressRequestsAPI.updateProgress(selectedRequest.id, {
                progressInfo,
                progressPercentage: progressPercentage || null,
                estimatedCompletion: estimatedCompletion || null
                // detectedDate: formData.detectedDate ? new Date(formData.detectedDate).toISOString() : null,

            });

            toast.info('Bilgi talebi güncellendi');
            setShowUpdateModal(false);
            resetUpdateForm();
            loadRequests();
        } catch (error) {
            console.error('Error updating progress:', error);
            toast.error('Bilgi talebi  güncellenirken hata oluştu');
        }
    };

    const handleRespond = async () => {
        if (!selectedRequest) return;
        if (!responseNotes.trim()) {
            toast.warn('Lütfen yanıt notu giriniz');
            return;
        }

        try {
            await progressRequestsAPI.respond(selectedRequest.id, {
                responseNotes
            });

            toast.info('Talep yanıtlandı');
            setShowRespondModal(false);
            resetRespondForm();
            loadRequests();
        } catch (error) {
            console.error('Error responding to request:', error);
            toast.error('Yanıtlama sırasında hata oluştu');
        }
    };

    const handleDelete = async (requestId) => {
        const confirm = await showConfirmToast(`Bu ilerleme talebini silmek istediğinize emin misiniz?`);
        if (!confirm) { toast.info("İşlem iptal edildi."); return; }



        try {
            await progressRequestsAPI.delete(requestId);
            toast.info('Talep silindi');
            loadRequests();
        } catch (error) {
            console.error('Error deleting request:', error);
            toast.info('Silme işlemi başarısız');
        }
    };

    const resetUpdateForm = () => {
        setProgressInfo('');
        setProgressPercentage(0);
        setEstimatedCompletion('');
        setSelectedRequest(null);
    };

    const resetRespondForm = () => {
        setResponseNotes('');
        setSelectedRequest(null);
    };

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

    const formatShortDate = (dateString) => {
        if (!dateString) return 'Tarih yok';
        return new Date(dateString).toLocaleString('tr-TR', {
            month: 'short',
            day: 'numeric',
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
                    <TrendingUp size={28} />
                    Bilgi Talepleri Yönetimi
                </h1>

                <div style={styles.stats}>
                    <div style={styles.statCard}>
                        <div style={styles.statValue}>{groupedRequests.length}</div>
                        <div style={styles.statLabel}>Toplam Ticket</div>
                    </div>
                    <div style={styles.statCard}>
                        <div style={styles.statValue}>{requests.filter(r => !r.isResponded).length}</div>
                        <div style={styles.statLabel}>Bekleyen Talepler</div>
                    </div>
                    <div style={styles.statCard}>
                        <div style={styles.statValue}>{requests.filter(r => r.progressInfo).length}</div>
                        <div style={styles.statLabel}>Bilgi Bildirilen</div>
                    </div>
                </div>
            </div>

            {/* Filters and Search */}
            <div style={styles.controls}>
                <div style={styles.searchContainer}>
                    <Search size={20} style={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Ticket numarası, mesaj veya kullanıcı ara..."
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
                        Tümü ({groupedRequests.length})
                    </button>
                    <button
                        onClick={() => setFilter('pending')}
                        style={{
                            ...styles.filterButton,
                            ...(filter === 'pending' ? styles.filterButtonActive : {})
                        }}
                    >
                        Bekleyen ({groupedRequests.filter(g => g.hasPending).length})
                    </button>
                    <button
                        onClick={() => setFilter('responded')}
                        style={{
                            ...styles.filterButton,
                            ...(filter === 'responded' ? styles.filterButtonActive : {})
                        }}
                    >
                        Yanıtlanan ({groupedRequests.filter(g => !g.hasPending).length})
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
                                onClick={() => handleSort('requestCount')}
                            >
                                <div style={styles.thContent}>
                                    Talep Sayısı
                                    <ArrowUpDown size={14} />
                                </div>
                            </th>
                            <th style={{ ...styles.th, width: '180px' }}>Son İlerleme</th>
                            <th
                                style={{ ...styles.th, ...styles.sortable, width: '150px' }}
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
                                <td colSpan="7" style={styles.emptyCell}>
                                    {searchTerm
                                        ? 'Arama kriterlerine uygun kayıt bulunamadı'
                                        : 'Bilgi talebi bulunamadı'}
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
                                                {group.requests.length} talep
                                            </div>
                                        </td>
                                        <td style={styles.td}>
                                            {group.latestProgress ? (
                                                <div style={styles.progressBadge}>
                                                    %{group.latestProgress.progressPercentage || 0}
                                                </div>
                                            ) : (
                                                <span style={styles.noProgress}>Bildirilmedi</span>
                                            )}
                                        </td>
                                        <td style={styles.td}>
                                            <strong style={styles.totalDuration}>
                                                {formatTotalDuration(group.totalHours)}
                                            </strong>
                                        </td>
                                        <td style={styles.td}>
                                            <div style={styles.statusGroup}>
                                                {group.pendingCount > 0 && (
                                                    <span style={styles.statusBadgePending}>
                                                        {group.pendingCount} Bekleyen
                                                    </span>
                                                )}
                                                {group.respondedCount > 0 && (
                                                    <span style={styles.statusBadgeResponded}>
                                                        {group.respondedCount} Yanıtlandı
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
                                            <td colSpan="7" style={styles.expandedCell}>
                                                <div style={styles.expandedContent}>
                                                    <table style={styles.detailTable}>
                                                        <thead>
                                                            <tr>
                                                                <th style={styles.detailTh}>#</th>
                                                                <th style={styles.detailTh}>Talep Eden</th>
                                                                <th style={styles.detailTh}>Hedef</th>
                                                                <th style={styles.detailTh}>Talep Tarihi</th>
                                                                <th style={styles.detailTh}>Süre</th>
                                                                <th style={styles.detailTh}>İlerleme</th>
                                                                <th style={styles.detailTh}>Tahmini Tamamlanma</th>
                                                                <th style={styles.detailTh}>Mesaj</th>
                                                                <th style={styles.detailTh}>Durum</th>
                                                                <th style={styles.detailTh}>İşlemler</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {group.requests.map((req, idx) => (
                                                                <>
                                                                    {/* Request Row */}
                                                                    <tr key={req.id}>
                                                                        <td style={styles.detailTd}>
                                                                            <span style={styles.requestNumber}>
                                                                                #{idx + 1}
                                                                            </span>
                                                                        </td>
                                                                        <td style={styles.detailTd}>
                                                                            {req.requestedByName}
                                                                        </td>
                                                                        <td style={styles.detailTd}>
                                                                            {req.targetUserName}
                                                                        </td>
                                                                        <td style={styles.detailTd}>
                                                                            {formatDate(req.requestedAt)}
                                                                        </td>
                                                                        <td style={styles.detailTd}>
                                                                            {formatDuration(req.durationHours)}
                                                                        </td>
                                                                        <td style={styles.detailTd}>
                                                                            {req.progressPercentage !== null ? (
                                                                                <div style={styles.progressCell}>
                                                                                    <div style={styles.progressBar}>
                                                                                        <div
                                                                                            style={{
                                                                                                ...styles.progressFill,
                                                                                                width: `${req.progressPercentage}%`
                                                                                            }}
                                                                                        />
                                                                                    </div>
                                                                                    <span style={styles.progressText}>
                                                                                        %{req.progressPercentage}
                                                                                    </span>
                                                                                </div>
                                                                            ) : (
                                                                                <span style={styles.noProgress}>-</span>
                                                                            )}
                                                                        </td>
                                                                        <td style={styles.detailTd}>
                                                                            {req.estimatedCompletion || '-'}
                                                                        </td>
                                                                        <td style={styles.detailTd}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                                {/* Expand/Collapse Icon - ONLY show if updates exist */}
                                                                                {req.updates && req.updates.length > 0 && (
                                                                                    <button
                                                                                        onClick={() => toggleRequestUpdates(req.id)}
                                                                                        style={{
                                                                                            padding: '0.25rem',
                                                                                            border: 'none',
                                                                                            background: 'none',
                                                                                            cursor: 'pointer',
                                                                                            display: 'flex',
                                                                                            alignItems: 'center',
                                                                                            color: '#667eea',
                                                                                        }}
                                                                                    >
                                                                                        {expandedRequestUpdates.has(req.id)
                                                                                            ? <ChevronDown size={16} />
                                                                                            : <ChevronRight size={16} />
                                                                                        }
                                                                                    </button>
                                                                                )}

                                                                                {/* Message Text */}
                                                                                <div style={{ flex: 1 }}>
                                                                                    <div>{req.progressInfo || '-'}</div>

                                                                                    {/* Update Count Badge */}
                                                                                    {req.updates && req.updates.length > 0 && (
                                                                                        <div style={{
                                                                                            display: 'inline-block',
                                                                                            marginTop: '0.25rem',
                                                                                            padding: '0.125rem 0.5rem',
                                                                                            backgroundColor: '#e3f2fd',
                                                                                            borderRadius: '10px',
                                                                                            fontSize: '0.7rem',
                                                                                            fontWeight: '600',
                                                                                            color: '#1976d2',
                                                                                        }}>
                                                                                            {req.updates.length} güncelleme
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td style={styles.detailTd}>
                                                                            {req.isResponded ? (
                                                                                <span style={styles.statusResponded}>
                                                                                    <CheckCircle size={14} />
                                                                                    Yanıtlandı
                                                                                </span>
                                                                            ) : (
                                                                                <span style={styles.statusPending}>
                                                                                    <Clock size={14} />
                                                                                    Bekliyor
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td style={styles.detailTd}>
                                                                            <div style={styles.actions}>
                                                                                {!req.isResponded && (
                                                                                    <>
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                setSelectedRequest(req);
                                                                                                setProgressInfo(req.progressInfo || '');
                                                                                                setProgressPercentage(req.progressPercentage || 0);
                                                                                                setEstimatedCompletion(req.estimatedCompletion ? req.estimatedCompletion.slice(0, 16) : '');
                                                                                                setShowUpdateModal(true);
                                                                                            }}
                                                                                            style={styles.updateButton}
                                                                                            title="Bilgi Güncelle"
                                                                                        >
                                                                                            <TrendingUp size={16} />
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                setSelectedRequest(req);
                                                                                                setShowRespondModal(true);
                                                                                            }}
                                                                                            style={styles.respondButton}
                                                                                            title="Yanıtla"
                                                                                        >
                                                                                            <MessageSquare size={16} />
                                                                                        </button>
                                                                                    </>
                                                                                )}
                                                                                <button
                                                                                    onClick={() => handleDelete(req.id)}
                                                                                    style={styles.deleteButton}
                                                                                    title="Sil"
                                                                                >
                                                                                    <Trash2 size={16} />
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                    </tr>

                                                                    {/* NEW: Update History Timeline */}
                                                                    {expandedRequestUpdates.has(req.id) && req.updates && req.updates.length > 0 && (
                                                                        <tr key={`updates-${req.id}`}>
                                                                            <td colSpan="10" style={{
                                                                                padding: '0',
                                                                                backgroundColor: '#f8f9fa',
                                                                                borderBottom: '2px solid #dee2e6',
                                                                            }}>
                                                                                <div style={{ padding: '1rem 1.5rem' }}>
                                                                                    {/* Header */}
                                                                                    <div style={{
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        gap: '0.5rem',
                                                                                        marginBottom: '0.75rem',
                                                                                        fontSize: '0.9rem',
                                                                                        fontWeight: '600',
                                                                                        color: '#495057',
                                                                                    }}>
                                                                                        <History size={16} />
                                                                                        <span>Güncelleme Geçmişi ({req.updates.length})</span>
                                                                                    </div>

                                                                                    {/* Nested Table */}
                                                                                    <table style={{
                                                                                        width: '100%',
                                                                                        borderCollapse: 'collapse',
                                                                                        backgroundColor: 'white',
                                                                                        borderRadius: '6px',
                                                                                        overflow: 'hidden',
                                                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                                                                    }}>
                                                                                        <thead>
                                                                                            <tr>
                                                                                                <th style={{
                                                                                                    padding: '0.75rem',
                                                                                                    textAlign: 'left',
                                                                                                    fontSize: '0.8rem',
                                                                                                    fontWeight: '600',
                                                                                                    color: '#6c757d',
                                                                                                    backgroundColor: '#f1f3f5',
                                                                                                    borderBottom: '2px solid #dee2e6',
                                                                                                    width: '60px',
                                                                                                }}>#</th>
                                                                                                <th style={{
                                                                                                    padding: '0.75rem',
                                                                                                    textAlign: 'left',
                                                                                                    fontSize: '0.8rem',
                                                                                                    fontWeight: '600',
                                                                                                    color: '#6c757d',
                                                                                                    backgroundColor: '#f1f3f5',
                                                                                                    borderBottom: '2px solid #dee2e6',
                                                                                                }}>Tarih</th>
                                                                                                <th style={{
                                                                                                    padding: '0.75rem',
                                                                                                    textAlign: 'left',
                                                                                                    fontSize: '0.8rem',
                                                                                                    fontWeight: '600',
                                                                                                    color: '#6c757d',
                                                                                                    backgroundColor: '#f1f3f5',
                                                                                                    borderBottom: '2px solid #dee2e6',
                                                                                                }}>Güncelleyen</th>
                                                                                                <th style={{
                                                                                                    padding: '0.75rem',
                                                                                                    textAlign: 'left',
                                                                                                    fontSize: '0.8rem',
                                                                                                    fontWeight: '600',
                                                                                                    color: '#6c757d',
                                                                                                    backgroundColor: '#f1f3f5',
                                                                                                    borderBottom: '2px solid #dee2e6',
                                                                                                    width: '120px',
                                                                                                }}>İlerleme</th>
                                                                                                <th style={{
                                                                                                    padding: '0.75rem',
                                                                                                    textAlign: 'left',
                                                                                                    fontSize: '0.8rem',
                                                                                                    fontWeight: '600',
                                                                                                    color: '#6c757d',
                                                                                                    backgroundColor: '#f1f3f5',
                                                                                                    borderBottom: '2px solid #dee2e6',
                                                                                                }}>Tahmini Tamamlanma</th>
                                                                                                <th style={{
                                                                                                    padding: '0.75rem',
                                                                                                    textAlign: 'left',
                                                                                                    fontSize: '0.8rem',
                                                                                                    fontWeight: '600',
                                                                                                    color: '#6c757d',
                                                                                                    backgroundColor: '#f1f3f5',
                                                                                                    borderBottom: '2px solid #dee2e6',
                                                                                                }}>Mesaj</th>
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody>
                                                                                            {req.updates.map((update, updateIdx) => (
                                                                                                <tr
                                                                                                    key={update.id}
                                                                                                    style={{
                                                                                                        borderBottom: updateIdx < req.updates.length - 1 ? '1px solid #e9ecef' : 'none',
                                                                                                    }}
                                                                                                >
                                                                                                    {/* Update Number */}
                                                                                                    <td style={{
                                                                                                        padding: '0.75rem',
                                                                                                        fontSize: '0.85rem',
                                                                                                    }}>
                                                                                                        <span style={{
                                                                                                            display: 'inline-block',
                                                                                                            padding: '0.25rem 0.5rem',
                                                                                                            backgroundColor: '#667eea',
                                                                                                            color: 'white',
                                                                                                            borderRadius: '4px',
                                                                                                            fontSize: '0.75rem',
                                                                                                            fontWeight: '700',
                                                                                                        }}>
                                                                                                            #{req.updates.length - updateIdx}
                                                                                                        </span>
                                                                                                    </td>

                                                                                                    {/* Date */}
                                                                                                    <td style={{
                                                                                                        padding: '0.75rem',
                                                                                                        fontSize: '0.85rem',
                                                                                                        color: '#495057',
                                                                                                    }}>
                                                                                                        {formatDate(update.updatedAt)}
                                                                                                    </td>

                                                                                                    {/* Updated By */}
                                                                                                    <td style={{
                                                                                                        padding: '0.75rem',
                                                                                                        fontSize: '0.85rem',
                                                                                                        color: '#495057',
                                                                                                    }}>
                                                                                                        {update.updatedByName}
                                                                                                    </td>

                                                                                                    {/* Progress Percentage */}
                                                                                                    <td style={{
                                                                                                        padding: '0.75rem',
                                                                                                        fontSize: '0.85rem',
                                                                                                    }}>
                                                                                                        {update.progressPercentage !== null ? (
                                                                                                            <div style={{
                                                                                                                display: 'flex',
                                                                                                                alignItems: 'center',
                                                                                                                gap: '0.5rem',
                                                                                                            }}>
                                                                                                                <div style={{
                                                                                                                    flex: 1,
                                                                                                                    height: '8px',
                                                                                                                    backgroundColor: '#e2e8f0',
                                                                                                                    borderRadius: '4px',
                                                                                                                    overflow: 'hidden',
                                                                                                                }}>
                                                                                                                    <div style={{
                                                                                                                        height: '100%',
                                                                                                                        backgroundColor: '#48bb78',
                                                                                                                        width: `${update.progressPercentage}%`,
                                                                                                                        transition: 'width 0.3s',
                                                                                                                    }} />
                                                                                                                </div>
                                                                                                                <span style={{
                                                                                                                    fontSize: '0.8rem',
                                                                                                                    fontWeight: '600',
                                                                                                                    color: '#4a5568',
                                                                                                                    minWidth: '45px',
                                                                                                                }}>
                                                                                                                    %{update.progressPercentage}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                        ) : (
                                                                                                            <span style={{ color: '#a0aec0' }}>-</span>
                                                                                                        )}
                                                                                                    </td>

                                                                                                    {/* Estimated Completion */}
                                                                                                    <td style={{
                                                                                                        padding: '0.75rem',
                                                                                                        fontSize: '0.85rem',
                                                                                                        color: '#495057',
                                                                                                    }}>
                                                                                                        {update.estimatedCompletion
                                                                                                            ? formatDate(update.estimatedCompletion)
                                                                                                            : '-'}
                                                                                                    </td>

                                                                                                    {/* Message */}
                                                                                                    <td style={{
                                                                                                        padding: '0.75rem',
                                                                                                        fontSize: '0.85rem',
                                                                                                    }}>
                                                                                                        <div style={{
                                                                                                            maxWidth: '400px',
                                                                                                            padding: '0.5rem',
                                                                                                            backgroundColor: '#f8f9fa',
                                                                                                            borderRadius: '4px',
                                                                                                            borderLeft: '3px solid #667eea',
                                                                                                            color: '#495057',
                                                                                                            lineHeight: '1.4',
                                                                                                        }}>
                                                                                                            {update.progressInfo || '-'}
                                                                                                        </div>
                                                                                                    </td>
                                                                                                </tr>
                                                                                            ))}
                                                                                        </tbody>
                                                                                    </table>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </>
                                                            ))}
                                                        </tbody>
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

            {/* Update Progress Modal */}
            {showUpdateModal && (
                <div style={styles.modalOverlay} onClick={() => setShowUpdateModal(false)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h2 style={styles.modalTitle}>Bilgi Talebi Güncelle</h2>
                        <div style={styles.modalBody}>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Bilgi Mesajı*</label>
                                <textarea
                                    value={progressInfo}
                                    onChange={(e) => setProgressInfo(e.target.value)}
                                    style={styles.textarea}
                                    rows={4}
                                    placeholder="İlerleme hakkında bilgi girin..."
                                />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>İlerleme Yüzdesi</label>
                                <div style={styles.percentageInput}>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={progressPercentage}
                                        onChange={(e) => setProgressPercentage(parseInt(e.target.value))}
                                        style={styles.rangeInput}
                                    />
                                    <span style={styles.percentageValue}>%{progressPercentage}</span>
                                </div>
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Tahmini Tamamlanma</label>
                                <input
                                    type="datetime-local"
                                    value={estimatedCompletion}
                                    onChange={(e) => setEstimatedCompletion(e.target.value)}
                                    style={styles.input}
                                />
                            </div>
                        </div>
                        <div style={styles.modalFooter}>
                            <button
                                onClick={() => setShowUpdateModal(false)}
                                style={styles.cancelButton}
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleUpdateProgress}
                                style={styles.submitButton}
                            >
                                Güncelle
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Respond Modal */}
            {showRespondModal && (
                <div style={styles.modalOverlay} onClick={() => setShowRespondModal(false)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h2 style={styles.modalTitle}>Talebe Yanıt Ver</h2>
                        <div style={styles.modalBody}>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Yanıt Mesajı*</label>
                                <textarea
                                    value={responseNotes}
                                    onChange={(e) => setResponseNotes(e.target.value)}
                                    style={styles.textarea}
                                    rows={6}
                                    placeholder="Talebi yanıtla ve sonlandır..."
                                />
                            </div>
                        </div>
                        <div style={styles.modalFooter}>
                            <button
                                onClick={() => setShowRespondModal(false)}
                                style={styles.cancelButton}
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleRespond}
                                style={styles.submitButton}
                            >
                                Yanıtla ve Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
const styles = {
    container: {
        padding: '2rem',
        maxWidth: '1600px',
        margin: '0 auto',
    },
    loading: {
        textAlign: 'center',
        padding: '3rem',
        fontSize: '1.1rem',
        color: '#666',
    },
    header: {
        marginBottom: '2rem',
    },
    title: {
        fontSize: '2rem',
        fontWeight: '700',
        color: '#1a202c',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
    },
    stats: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
    },
    statCard: {
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        textAlign: 'center',
    },
    statValue: {
        fontSize: '2rem',
        fontWeight: '700',
        color: '#667eea',
        marginBottom: '0.25rem',
    },
    statLabel: {
        fontSize: '0.875rem',
        color: '#718096',
        fontWeight: '500',
    },
    controls: {
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    searchContainer: {
        position: 'relative',
        flex: '1',
        minWidth: '300px',
    },
    searchIcon: {
        position: 'absolute',
        left: '12px',
        top: '50%',
        transform: 'translateY(-50%)',
        color: '#a0aec0',
    },
    searchInput: {
        width: '100%',
        padding: '0.75rem 1rem 0.75rem 2.75rem',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        fontSize: '0.95rem',
    },
    filterButtons: {
        display: 'flex',
        gap: '0.5rem',
    },
    filterButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1.25rem',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        backgroundColor: 'white',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: '500',
        color: '#4a5568',
        transition: 'all 0.2s',
    },
    filterButtonActive: {
        backgroundColor: '#667eea',
        color: 'white',
        borderColor: '#667eea',
    },
    tableContainer: {
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
    },
    th: {
        padding: '1rem',
        textAlign: 'left',
        fontSize: '0.875rem',
        fontWeight: '600',
        color: '#4a5568',
        backgroundColor: '#f7fafc',
        borderBottom: '2px solid #e2e8f0',
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
        fontWeight: '500',
    },
    td: {
        padding: '1rem',
        borderBottom: '1px solid #e2e8f0',
        fontSize: '0.9rem',
        color: '#2d3748',
    },
    expandButton: {
        padding: '0.25rem',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        color: '#667eea',
        display: 'flex',
        alignItems: 'center',
    },
    ticketCodeCell: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    ticketCode: {
        fontWeight: '600',
        color: '#667eea',
    },
    linkButton: {
        padding: '0.25rem',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        color: '#667eea',
        display: 'flex',
        alignItems: 'center',
    },
    countBadge: {
        display: 'inline-block',
        padding: '0.25rem 0.75rem',
        backgroundColor: '#edf2f7',
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: '600',
        color: '#4a5568',
    },
    progressBadge: {
        display: 'inline-block',
        padding: '0.25rem 0.75rem',
        backgroundColor: '#bee3f8',
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: '600',
        color: '#2c5282',
    },
    noProgress: {
        color: '#a0aec0',
        fontStyle: 'italic',
    },
    totalDuration: {
        color: '#2d3748',
    },
    statusGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
    },
    statusBadgePending: {
        display: 'inline-block',
        padding: '0.25rem 0.75rem',
        backgroundColor: '#fef5e7',
        borderRadius: '12px',
        fontSize: '0.8rem',
        fontWeight: '600',
        color: '#d68910',
    },
    statusBadgeResponded: {
        display: 'inline-block',
        padding: '0.25rem 0.75rem',
        backgroundColor: '#d5f5e3',
        borderRadius: '12px',
        fontSize: '0.8rem',
        fontWeight: '600',
        color: '#196f3d',
    },
    viewButton: {
        padding: '0.5rem 1rem',
        backgroundColor: '#667eea',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.85rem',
        fontWeight: '600',
    },
    emptyCell: {
        padding: '3rem',
        textAlign: 'center',
        color: '#a0aec0',
        fontStyle: 'italic',
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
    },
    detailTh: {
        padding: '0.75rem',
        textAlign: 'left',
        fontSize: '0.8rem',
        fontWeight: '600',
        color: '#718096',
        backgroundColor: '#edf2f7',
        borderBottom: '1px solid #e2e8f0',
    },
    detailTd: {
        padding: '0.75rem',
        borderBottom: '1px solid #e2e8f0',
        fontSize: '0.85rem',
        color: '#2d3748',
    },
    requestNumber: {
        fontWeight: '700',
        color: '#667eea',
    },
    progressCell: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    progressBar: {
        flex: '1',
        height: '8px',
        backgroundColor: '#e2e8f0',
        borderRadius: '4px',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#48bb78',
        transition: 'width 0.3s',
    },
    progressText: {
        fontSize: '0.8rem',
        fontWeight: '600',
        color: '#4a5568',
        minWidth: '45px',
    },
    messageCell: {
        maxWidth: '300px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
    },
    // NEW: Update history button
    updateHistoryButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.375rem 0.625rem',
        backgroundColor: '#f0f4f8',
        border: '1px solid #cbd5e0',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.75rem',
        fontWeight: '500',
        color: '#4a5568',
        marginTop: '0.5rem',
        transition: 'all 0.2s',
    },
    statusPending: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.25rem 0.5rem',
        backgroundColor: '#fef5e7',
        borderRadius: '4px',
        fontSize: '0.8rem',
        fontWeight: '600',
        color: '#d68910',
    },
    statusResponded: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.25rem 0.5rem',
        backgroundColor: '#d5f5e3',
        borderRadius: '4px',
        fontSize: '0.8rem',
        fontWeight: '600',
        color: '#196f3d',
    },
    actions: {
        display: 'flex',
        gap: '0.5rem',
    },
    updateButton: {
        padding: '0.5rem',
        backgroundColor: '#4299e1',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
    },
    respondButton: {
        padding: '0.5rem',
        backgroundColor: '#48bb78',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
    },
    deleteButton: {
        padding: '0.5rem',
        backgroundColor: '#f56565',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
    },

    // NEW: Update history timeline styles
    updateHistoryCell: {
        padding: '0',
        backgroundColor: '#f7fafc',
        borderBottom: '2px solid #e2e8f0',
    },
    updateHistoryContainer: {
        padding: '1.5rem 2rem',
    },
    updateHistoryHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '1rem',
        fontSize: '0.95rem',
        fontWeight: '600',
        color: '#2d3748',
    },
    timeline: {
        position: 'relative',
        paddingLeft: '2rem',
    },
    timelineItem: {
        position: 'relative',
        paddingBottom: '1.5rem',
    },
    timelineDot: {
        position: 'absolute',
        left: '-2rem',
        top: '0.25rem',
        width: '12px',
        height: '12px',
        backgroundColor: 'white',
        border: '3px solid #667eea',
        borderRadius: '50%',
        zIndex: 1,
    },
    timelineDotInner: {
        width: '100%',
        height: '100%',
        backgroundColor: '#667eea',
        borderRadius: '50%',
    },
    timelineLine: {
        position: 'absolute',
        left: '-1.5625rem',
        top: '1rem',
        bottom: '-0.5rem',
        width: '2px',
        backgroundColor: '#cbd5e0',
    },
    timelineContent: {
        backgroundColor: 'white',
        padding: '1rem',
        borderRadius: '6px',
        border: '1px solid #e2e8f0',
    },
    timelineHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '0.5rem',
    },
    timelineNumber: {
        fontWeight: '700',
        color: '#667eea',
        fontSize: '0.9rem',
    },
    timelinePercentage: {
        padding: '0.125rem 0.5rem',
        backgroundColor: '#bee3f8',
        borderRadius: '10px',
        fontSize: '0.75rem',
        fontWeight: '700',
        color: '#2c5282',
    },
    timelineDate: {
        fontSize: '0.75rem',
        color: '#718096',
        marginLeft: 'auto',
    },
    timelineMeta: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        fontSize: '0.8rem',
        color: '#4a5568',
        marginBottom: '0.5rem',
    },
    timelineAuthor: {
        fontWeight: '500',
    },
    timelineEstimate: {
        color: '#718096',
        fontStyle: 'italic',
    },
    timelineMessage: {
        fontSize: '0.875rem',
        color: '#2d3748',
        lineHeight: '1.5',
        padding: '0.5rem',
        backgroundColor: '#f7fafc',
        borderRadius: '4px',
        borderLeft: '3px solid #667eea',
    },

    // Modal styles
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    modal: {
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'auto',
    },
    modalTitle: {
        fontSize: '1.5rem',
        fontWeight: '600',
        padding: '1.5rem',
        borderBottom: '1px solid #e2e8f0',
        color: '#2d3748',
    },
    modalBody: {
        padding: '1.5rem',
    },
    formGroup: {
        marginBottom: '1.5rem',
    },
    label: {
        display: 'block',
        marginBottom: '0.5rem',
        fontSize: '0.9rem',
        fontWeight: '600',
        color: '#4a5568',
    },
    textarea: {
        width: '100%',
        padding: '0.75rem',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        fontSize: '0.9rem',
        resize: 'vertical',
    },
    percentageInput: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
    },
    rangeInput: {
        flex: 1,
    },
    percentageValue: {
        fontSize: '1.25rem',
        fontWeight: '700',
        color: '#667eea',
        minWidth: '60px',
    },
    input: {
        width: '100%',
        padding: '0.75rem',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        fontSize: '0.9rem',
    },
    modalFooter: {
        padding: '1.5rem',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        gap: '1rem',
        justifyContent: 'flex-end',
    },
    cancelButton: {
        padding: '0.75rem 1.5rem',
        backgroundColor: '#e2e8f0',
        color: '#4a5568',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: '600',
    },
    submitButton: {
        padding: '0.75rem 1.5rem',
        backgroundColor: '#667eea',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: '600',
    },
};