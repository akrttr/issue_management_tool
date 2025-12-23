import { useState, useEffect } from "react";
import { ticketsAPI,configurationAPI } from "../../services/api";
import { Edit, Trash2, Eye, Download, FileSpreadsheet, RotateCcw } from "lucide-react";
import { generateMultipleTicketsPDF } from "../utils/pdfGenerator";
import { showConfirmToast } from "./ConfirmToast";
import {toast} from "react-toastify";  


export default function TicketsTable({ onViewTicket, onEditTicket, onCreateTicket }) {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [showDeleted, setShowDeleted] = useState(false);

    // Sorting
    const [sortField, setSortField] = useState("Id");
    const [sortOrder, setSortOrder] = useState("desc");

    // Selection (for bulk PDF)
    const [selectedTickets, setSelectedTickets] = useState(new Set());
    const [generatingPDF, setGeneratingPDF] = useState(false);
    const [exportingExcel, setExportingExcel] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [bulkRestoring, setBulkRestoring] = useState(false);
    const [pdfReportDate, setPdfReportDate] = useState([]);

    useEffect(() => {
            loadConfiguration();
        }, []);
    
        const loadConfiguration = async () => {
            try {
                const configResponse = await configurationAPI.get();
                if (configResponse?.data?.pdfReportDate) {
                    setPdfReportDate(configResponse.data.pdfReportDate);
                } else {
                    // Fallback to current date if no configuration
                    setPdfReportDate(new Date().toISOString());
                }
            } catch (error) {
                console.error('Error loading configuration:', error);
                // Fallback to current date on error
                setPdfReportDate(new Date().toISOString());
            }
        };

    const STATUS_LABELS = {
        'OPEN': 'AÇIK',
        'CLOSED': 'KAPANDI',
        'CONFIRMED': 'ONAYLANDI',
        'PAUSED': 'DURDURULDU',
        'CANCELLED': 'İPTAL',
        'REOPENED': 'TEKRAR AÇILDI'

    };

    useEffect(() => {
        loadTickets();
    }, [statusFilter, showDeleted]);

    const loadTickets = async () => {
        try {
            setLoading(true);

            const response = await ticketsAPI.getAll(statusFilter || null, showDeleted);
            const ticketsData = Array.isArray(response.data) ? response.data : [];
            setTickets(ticketsData);
        } catch (error) {
            console.error("Error loading tickets:", error);
            toast.error("Error loading tickets");
        } finally {
            setLoading(false);
        }
    };

    const getTicketTooltip = (ticket) => {
        const now = new Date();

        // Başlangıç tarihi: önce tespit tarihi varsa onu, yoksa oluşturma
        const start = ticket.detectedDate
            ? new Date(ticket.detectedDate)
            : new Date(ticket.createdAt);

        let durationText = "-";
        if (!isNaN(start.getTime())) {
            const diffMs = now - start;
            const diffHours = diffMs / (1000 * 60 * 60);
            if (Math.abs(diffHours) < 24) {
                const hours = Math.round(diffHours);
                durationText = `${hours} saat`;
            } else {
                const days = Math.round(diffHours / 24);
                durationText = `${days} gün`;
            }
        }

        const startText = isNaN(start.getTime())
            ? "-"
            : start.toLocaleString("tr-TR");


        const lastActDate = ticket.lastActivityDate
            ? new Date(ticket.lastActivityDate).toLocaleString("tr-TR")
            : "-";

        const lastActItem = ticket.lastActivityItem || "-";

        return (
            `Başlangıç: ${startText} (${durationText})\n` +
            `Son Aktivite: ${lastActDate} - ${lastActItem}`
        );
    };

    const handleSort = (field) => {
        if (sortField === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortOrder("asc");
        }
    };

    const handleExportExcel = async () => {
        try {
            setExportingExcel(true);
            await ticketsAPI.exportToExcel(); // api.jsx içindeki endpoint çağrısı
            // ticketsAPI.exportToExcel zaten dosyayı indirtiyor
        } catch (error) {
            console.error("Excel export error:", error);
            toast.error("Excel dışa aktarma sırasında hata oluştu.");
        } finally {
            setExportingExcel(false);
        }
    };

    const handleDelete = async (ticketId) => {

        const confirm = await showConfirmToast('Bu sorun kaydını silmek istediğinize emin misiniz?');
        if (!confirm) {toast.info("İşlem iptal edildi."); return;}


        try {
            await ticketsAPI.delete(ticketId);
            toast.info('Sorun kaydı silindi');
            loadTickets();
            // Remove from selection if selected
            setSelectedTickets(prev => {
                const newSet = new Set(prev);
                newSet.delete(ticketId);
                return newSet;
            });
        } catch (error) {
            console.error('Error deleting ticket:', error);
            toast.error('Sorun kaydı silinirken hata oluştu');
        }
    };

    // handle Bulk Delete
    const handleBulkDelete = async () => {
        if (selectedTickets.size === 0) return;

        const selectedTicketObjects = tickets.filter(t =>
            selectedTickets.has(t.id)
        );

        // Sadece silinmemiş olanlar silinebilir
        const deletable = selectedTicketObjects.filter(t => !t.isDeleted);
        const alreadyDeleted = selectedTicketObjects.filter(t => t.isDeleted);

        if (deletable.length === 0) {
            toast.warn("Seçili sorunların hepsi zaten silinmiş; silinecek kayıt yok.");
            return;
        }

        let message = `${deletable.length} adet sorunu silmek istediğinize emin misiniz?`;
        if (alreadyDeleted.length > 0) {
            message += `\n${alreadyDeleted.length} adet sorun zaten silinmiş olduğu için atlanacak.`;
        }

        const confirm = await showConfirmToast(`${name} servisini başlatmak istiyor musunuz?`);
        if (!confirm) {toast.info("İşlem iptal edildi."); return;}
        
        

        try {
            setBulkDeleting(true);

            await Promise.all(
                deletable.map(t => ticketsAPI.delete(t.id))
            );

            toast.info(`${deletable.length} adet sorun kaydı silindi.`);

            // Silinenleri seçimden çıkar
            setSelectedTickets(prev => {
                const s = new Set(prev);
                deletable.forEach(t => s.delete(t.id));
                return s;
            });

            loadTickets();
        } catch (error) {
            console.error("Bulk delete error:", error);
            toast.error("Toplu silme sırasında hata oluştu.");
        } finally {
            setBulkDeleting(false);
        }
    };


    const handleRestore = async (ticketId) => {
        const confirm = await showConfirmToast("Bu sorun kaydını geri almak istediğinize emin misiniz?");
        if (!confirm) {toast.info("İşlem iptal edildi."); return;}

        try {
            await ticketsAPI.restore(ticketId);
            toast.info('Sorun kaydı geri alındı!');
            loadTickets();
            // ensure it’s unselected
            setSelectedTickets(prev => {
                const newSet = new Set(prev);
                newSet.delete(ticketId);
                return newSet;
            });
        } catch (error) {
            console.error('Sorunu Geri Almada problem olmuştur :', error);
            toast.error('Sorunu Geri Almada problem olmuştur');
        }
    };

    // Bulk Restore 

    const handleBulkRestore = async () => {
        if (selectedTickets.size === 0) return;

        // Seçili satırların tamamını bul
        const selectedTicketObjects = tickets.filter(t =>
            selectedTickets.has(t.id)
        );

        // Sadece silinmiş olanlar restore edilebilir
        const restorable = selectedTicketObjects.filter(t => t.isDeleted);
        const notRestorable = selectedTicketObjects.filter(t => !t.isDeleted);

        if (restorable.length === 0) {
            toast.warn("Seçili sorunların hiçbiri silinmiş değil; geri alınacak kayıt yok.");
            return;
        }

        let message = `${restorable.length} adet silinmiş sorun geri alınacak.`;
        if (notRestorable.length > 0) {
            message += `\n${notRestorable.length} adet sorun zaten silinmemiş olduğu için atlanacak.`;
        }
        message += "\nDevam etmek istiyor musunuz?";

        const confirm = await showConfirmToast(message);
        if (!confirm) {toast.info("İşlem iptal edildi."); return;}
        

        try {
            setBulkRestoring(true);

            // Sadece silinmiş olanlara istek at
            await Promise.all(
                restorable.map(t => ticketsAPI.restore(t.id))
            );

            toast.success(`${restorable.length} adet sorun kaydı geri alındı.`);

            // Restore edilenleri seçimden çıkar
            setSelectedTickets(prev => {
                const s = new Set(prev);
                restorable.forEach(t => s.delete(t.id));
                return s;
            });

            // Listeyi yenile
            loadTickets();
        } catch (error) {
            console.error("Bulk restore error:", error);
            toast.error("Toplu geri alma sırasında hata oluştu.");
        } finally {
            setBulkRestoring(false);
        }
    };


    const handleToggleTicket = (ticketId) => {
        setSelectedTickets(prev => {
            const newSet = new Set(prev);
            if (newSet.has(ticketId)) {
                newSet.delete(ticketId);
            } else {
                newSet.add(ticketId);
            }
            return newSet;
        });
    };

    const handleToggleAll = () => {
        if (selectedTickets.size === filteredTickets.length) {
            setSelectedTickets(new Set());
        } else {
            setSelectedTickets(new Set(filteredTickets.map(t => t.id)));
        }
    };

    const handleGenerateBulkPDF = async () => {
        if (selectedTickets.size === 0) {
            toast.warn("Lütfen en az bir sorun seçiniz!");
            return;
        }

        try {
            setGeneratingPDF(true);

            const ticketDetailsPromises = Array.from(selectedTickets).map(async (ticketId) => {
                const response = await ticketsAPI.getById(ticketId);
                const ticketData = response.data;

                const formData = {
                    externalCode: ticketData.externalCode || '',
                    title: ticketData.title || '',
                    description: ticketData.description || '',
                    isBlocking: ticketData.isBlocking || false,
                    itemDescription: ticketData.itemDescription || '',
                    itemId: ticketData.itemId || '',
                    itemSerialNo: ticketData.itemSerialNo || '',
                    detectedDate: ticketData.detectedDate,
                    detectedContractorNotifiedAt: ticketData.detectedContractorNotifiedAt,
                    detectedNotificationMethods: ticketData.detectedNotificationMethods || [],
                    responseDate: ticketData.responseDate,
                    responseResolvedAt: ticketData.responseResolvedAt,
                    responseActions: ticketData.responseActions || '',
                    activityControlDate: ticketData.activityControlDate,
                    activityControlResult: ticketData.activityControlResult || '',
                    ttcomsCode: ticketData.ttcomsCode || '',
                };

                return { ticket: ticketData, formData };
            });

            const ticketsData = await Promise.all(ticketDetailsPromises);
            await generateMultipleTicketsPDF(ticketsData, pdfReportDate);

            toast.info(`${selectedTickets.size} adet sorun raporu PDF olarak oluşturuldu!`);
            setSelectedTickets(new Set());

        } catch (error) {
            console.error("Error generating bulk PDF:", error);
            toast.error("PDF oluşturulurken hata oluştu: " + error.message);
        } finally {
            setGeneratingPDF(false);
        }
    };

    const filteredTickets = tickets
        .filter(ticket => {
            // Search filter
            if (searchText) {
                const search = searchText.toLowerCase();
                const matchesSearch =
                    ticket.title.toLowerCase().includes(search) ||
                    ticket.externalCode.toLowerCase().includes(search) ||
                    (ticket.ttcomsCode && ticket.ttcomsCode.toLowerCase().includes(search));
                if (!matchesSearch) return false;
            }
            return true;
        })
        .sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            // Handle date sorting
            if (sortField === "createdAt" || sortField === "detectedDate" || sortField === "responseDate") {
                aVal = aVal ? new Date(aVal).getTime() : 0;
                bVal = bVal ? new Date(bVal).getTime() : 0;
            }

            // Handle null/undefined values
            if (aVal == null) return sortOrder === "asc" ? 1 : -1;
            if (bVal == null) return sortOrder === "asc" ? -1 : 1;

            if (sortOrder === "asc") {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

    const getStatusLabel = (status) => STATUS_LABELS[status] || status;
    const userRole = localStorage.getItem("role");
    const isAdmin = userRole === 'Admin';
    const canEdit = userRole === 'Editor' || userRole === 'Admin';

    if (loading) {
        return <div style={styles.loading}>Sorunlar yükleniyor...</div>;
    }

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerLeft}>
                    <div>
                        <h1 style={styles.title}>Sorunlar (Tickets)</h1>
                        <p style={styles.subtitle}>
                            {filteredTickets.length} / {tickets.length} sorun gösterilmektedir
                        </p>
                    </div>
                </div>
                <div style={styles.headerRight}>
                    {canEdit && (
                        <button
                            onClick={handleExportExcel}
                            style={{ ...styles.button, ...styles.excelButton }}
                            disabled={exportingExcel}
                        >
                            <FileSpreadsheet size={18} />
                            {exportingExcel ? "Excel hazırlanıyor..." : "Excel'e Aktar"}
                        </button>
                    )}

                    {selectedTickets.size > 0 && canEdit && (
                        <>
                            {isAdmin && (
                                <button
                                    onClick={handleBulkRestore}
                                    style={{ ...styles.button, ...styles.restoreTopButton }}
                                    disabled={bulkRestoring}
                                    title="Geri Al"
                                >
                                    <RotateCcw size={18} />
                                    {bulkRestoring ? "Geri alınıyor..." : "Geri Al"}
                                </button>
                            )}

                            <button
                                onClick={handleBulkDelete}
                                style={{ ...styles.button, ...styles.bulkDeleteButton }}
                                disabled={bulkDeleting}
                                title="Sorunları Sil"
                            >
                                <Trash2 size={18} />
                                {bulkDeleting ? "Siliniyor..." : "Sil"}
                            </button>

                            <button
                                onClick={handleGenerateBulkPDF}
                                style={{ ...styles.button, ...styles.pdfButton }}
                                disabled={generatingPDF}
                            >
                                <Download size={18} />
                                {generatingPDF
                                    ? "PDF Oluşturuluyor..."
                                    : `${selectedTickets.size} Sorun için PDF`}
                            </button>
                        </>
                    )}

                    {canEdit && (
                        <button
                            onClick={onCreateTicket}
                            style={{ ...styles.button, ...styles.createButton }}
                        >
                            + Yeni Sorun
                        </button>
                    )}
                </div>

            </div>

            {/* Controls - Search & Filter */}
            <div style={styles.controls}>
                <div style={styles.filterGroup}>
                    <input
                        type="text"
                        placeholder="Sorun ara (Başlık, Kod, TTCOMS)..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        style={styles.searchInput}
                    />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={styles.select}
                    >
                        <option value="">Tüm Durumlar</option>
                        <option value="OPEN">Açık</option>
                        <option value="CLOSED">Kapalı</option>
                        <option value="CONFIRMED">Onaylandı</option>
                        <option value="PAUSED">Durduruldu</option>
                        <option value="CANCELLED">İptal</option>
                        <option value="REOPENED">Yeniden Açıldı</option>

                    </select>
                    {isAdmin && (
                        <label style={styles.deletedToggle}>
                            <input
                                type="checkbox"
                                checked={showDeleted}
                                onChange={(e) => setShowDeleted(e.target.checked)}
                            />
                            Silinen sorunlar
                        </label>
                    )}
                    <button onClick={loadTickets} style={styles.refreshBtn}>
                        Yenile
                    </button>
                </div>
            </div>

            {/* Table */}
            {filteredTickets.length === 0 ? (
                <div style={styles.emptyState}>
                    <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Sorun bulunamadı</p>
                    {tickets.length > 0 && searchText && (
                        <p style={{ fontSize: '0.9rem', color: '#999' }}>
                            Arama filtrelerini temizlemeyi deneyin. Toplam {tickets.length} sorun mevcut.
                        </p>
                    )}
                </div>
            ) : (
                <div style={styles.tableContainer}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ ...styles.th, width: '50px' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedTickets.size === filteredTickets.length && filteredTickets.length > 0}
                                        onChange={handleToggleAll}
                                        style={styles.checkbox}
                                    />
                                </th>
                                <th style={styles.th} onClick={() => handleSort('id')}>
                                    ID {sortField === 'id' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th style={styles.th} onClick={() => handleSort('externalCode')}>
                                    Sorun No {sortField === 'externalCode' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th style={styles.th} onClick={() => handleSort('title')}>
                                    Başlık {sortField === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th style={styles.th} onClick={() => handleSort('status')}>
                                    Durum {sortField === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th style={styles.th} onClick={() => handleSort('ttcomsCode')}>
                                    TTCOMS {sortField === 'ttcomsCode' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th style={styles.th} onClick={() => handleSort('detectedByUserName')}>
                                    Tespit Eden {sortField === 'detectedByUserName' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th style={styles.th} onClick={() => handleSort('createdAt')}>
                                    Oluşturma {sortField === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th style={{ ...styles.th, cursor: 'default' }}>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTickets.map((ticket) => (
                                <tr
                                    key={ticket.id}
                                    style={{
                                        ...styles.row,
                                        backgroundColor: selectedTickets.has(ticket.id) ? '#e3f2fd' : 'white',
                                        cursor: 'pointer',
                                    }}
                                    title={getTicketTooltip(ticket)}
                                    onClick={(e) => {
                                        // Eğer tıklanan şey buton / input ise satır navigasyonu yapma
                                        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) {
                                            return;
                                        }
                                        onViewTicket(ticket.id);
                                    }}
                                >
                                    <td style={styles.td}>
                                        <input
                                            type="checkbox"
                                            checked={selectedTickets.has(ticket.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={() => handleToggleTicket(ticket.id)}
                                            style={styles.checkbox}
                                        />
                                    </td>
                                    <td style={styles.td}>#{ticket.id}</td>
                                    <td style={styles.td}>
                                        <span style={styles.ticketCode}>{ticket.externalCode}</span>
                                    </td>
                                    <td style={styles.td}>
                                        <div style={styles.titleCell}>
                                            {ticket.isBlocking && (
                                                <span style={styles.blockingBadge}>
                                                    ⚠️ KRİTİK
                                                </span>
                                            )}
                                            <span style={styles.ticketTitle}>{ticket.title}</span>
                                        </div>
                                    </td>
                                    <td style={styles.td}>
                                        <span
                                            style={{
                                                ...styles.statusBadge,
                                                backgroundColor: getStatusColor(ticket.status),
                                                color: getStatusTextColor(ticket.status)
                                            }}
                                        >
                                            {getStatusLabel(ticket.status)}
                                        </span>
                                    </td>
                                    <td style={styles.td}>{ticket.ttcomsCode || '-'}</td>
                                    <td style={styles.td}>{ticket.detectedByUserName || '-'}</td>
                                    <td style={styles.td}>
                                        {new Date(ticket.createdAt).toLocaleDateString('tr-TR')}
                                    </td>
                                    <td style={styles.td}>
                                        <div style={styles.actions}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onViewTicket(ticket.id);
                                                }}
                                                style={{ ...styles.actionButton, ...styles.viewButton }}
                                                title="Görüntüle"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            {canEdit && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEditTicket(ticket.id);
                                                    }} style={{ ...styles.actionButton, ...styles.editButton }}
                                                    title="Düzenle"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                            )}
                                            {isAdmin && (
                                                ticket.isDeleted ? (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRestore(ticket.id);
                                                        }} style={{ ...styles.actionButton, ...styles.restoreButton }}
                                                        title="Geri Al"
                                                    >
                                                        <RotateCcw size={16} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(ticket.id);
                                                        }} style={{ ...styles.actionButton, ...styles.deleteButton }}
                                                        title="Sil"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )
                                            )}

                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Selection summary */}
            {selectedTickets.size > 0 && (
                <div style={styles.selectionSummary}>
                    <span>{selectedTickets.size} sorun seçildi</span>
                    <button
                        onClick={() => setSelectedTickets(new Set())}
                        style={styles.clearButton}
                    >
                        Seçimi Temizle
                    </button>
                </div>
            )}
        </div>
    );
}

// Helper functions
const getStatusColor = (status) => {
    const colors = {
        OPEN: '#e3f2fd',
        CONFIRMED: '#fff3e0',
        PAUSED: '#f3e5f5',
        CLOSED: '#e8f5e9',
        CANCELLED: '#ffebee',
        REOPENED: '#fce4ec',
    };
    return colors[status] || '#f5f5f5';
};

const getStatusTextColor = (status) => {
    const colors = {
        OPEN: '#1976d2',
        CONFIRMED: '#f57c00',
        PAUSED: '#7b1fa2',
        CLOSED: '#388e3c',
        CANCELLED: '#d32f2f',
        REOPENED: '#c2185b',
    };
    return colors[status] || '#666';
};

const styles = {
    container: {
        padding: '1.5rem',
        maxWidth: '1600px',
        margin: '0 auto',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        padding: '1rem',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    deletedToggle: {
        display: "flex",
        alignItems: "center",
        gap: "0.4rem",
        fontSize: "0.9rem",
        whiteSpace: "nowrap",
        padding: "0 0.3rem",
        cursor: "pointer",
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
    },
    headerRight: {
        display: 'flex',
        gap: '0.5rem',
    },
    title: {
        fontSize: '1.5rem',
        fontWeight: 'bold',
        margin: 0,
    },
    subtitle: {
        color: '#666',
        fontSize: '0.9rem',
        margin: '0.5rem 0 0 0',
    },
    controls: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
        gap: '1rem',
    },
    filterGroup: {
        display: 'flex',
        gap: '1rem',
        flex: 1,
    },
    searchInput: {
        padding: '0.6rem',
        border: '1px solid #ddd',
        borderRadius: '4px',
        flex: 1,
        maxWidth: '400px',
        fontSize: '0.9rem',
    },
    select: {
        padding: '0.6rem',
        border: '1px solid #ddd',
        borderRadius: '4px',
        minWidth: '150px',
        fontSize: '0.9rem',
        cursor: 'pointer',
    },
    refreshBtn: {
        padding: '0.6rem 1.2rem',
        background: '#f5f5f5',
        border: '1px solid #ddd',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: '500',
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
    createButton: {
        backgroundColor: '#4caf50',
        color: 'white',
    },

    excelButton: {
        backgroundColor: '#0d9488',
        color: 'white',
    },
    restoreTopButton: {
        backgroundColor: '#facc15',
        color: '#78350f',
    },
    bulkDeleteButton: {
        backgroundColor: '#ef4444',
        color: 'white',
    },

    pdfButton: {
        backgroundColor: '#2196f3',
        color: 'white',
    },
    emptyState: {
        textAlign: 'center',
        padding: '3rem',
        background: 'white',
        borderRadius: '8px',
        color: '#666',
    },
    tableContainer: {
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        overflow: 'hidden',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
    },
    th: {
        padding: '1rem',
        textAlign: 'left',
        backgroundColor: '#f5f5f5',
        fontWeight: '600',
        fontSize: '0.9rem',
        color: '#555',
        borderBottom: '2px solid #ddd',
        cursor: 'pointer',
        userSelect: 'none',
    },
    td: {
        padding: '1rem',
        borderBottom: '1px solid #eee',
        fontSize: '0.9rem',
    },
    row: {
        transition: 'background-color 0.2s',
    },
    checkbox: {
        width: '18px',
        height: '18px',
        cursor: 'pointer',
    },
    ticketCode: {
        fontWeight: '600',
        color: '#1976d2',
    },
    titleCell: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    ticketTitle: {
        flex: 1,
    },
    blockingBadge: {
        padding: '0.2rem 0.5rem',
        backgroundColor: '#ffebee',
        color: '#d32f2f',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: '600',
    },
    statusBadge: {
        padding: '0.3rem 0.8rem',
        borderRadius: '12px',
        fontSize: '0.8rem',
        fontWeight: '500',
        display: 'inline-block',
    },
    actions: {
        display: 'flex',
        gap: '0.5rem',
    },
    actionButton: {
        padding: '0.4rem',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        transition: 'all 0.2s',
    },
    viewButton: {
        backgroundColor: '#e3f2fd',
        color: '#1976d2',
    },
    editButton: {
        backgroundColor: '#fff3e0',
        color: '#f57c00',
    },
    deleteButton: {
        backgroundColor: '#ffebee',
        color: '#d32f2f',
    },
    selectionSummary: {
        marginTop: '1rem',
        padding: '1rem',
        backgroundColor: '#e3f2fd',
        borderRadius: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontWeight: '500',
    },
    clearButton: {
        padding: '0.5rem 1rem',
        backgroundColor: 'white',
        border: '1px solid #1976d2',
        color: '#1976d2',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.85rem',
        fontWeight: '500',
    },
    loading: {
        textAlign: 'center',
        padding: '3rem',
        fontSize: '1.2rem',
        color: '#666',
    },
    checkboxLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.85rem',
    },
    restoreButton: {
        color: '#0d9488',
    },

};