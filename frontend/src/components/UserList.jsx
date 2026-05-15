import { useState, useEffect } from 'react';
import { userApi, configurationAPI, militaryRanksAPI, systemAPI } from '../../services/api.jsx';
import {
    UserPlus,
    Edit2,
    Trash2,
    Save,
    X,
    FileText,
    Edit,
    RotateCcw,
    Shield,
    Server,
    Calendar,
    Clock,
    Eye,
    Download, ShieldOff, Plus, MinusCircle, Play, Circle, XCircle, RefreshCw, FileSpreadsheetIcon
} from 'lucide-react';

import { toast } from "react-toastify";
import { showConfirmToast } from './ConfirmToast.jsx';
import TimePreview from './TimePreview.jsx';


export default function UserList({ onViewUser, onEditUser, onCreateUser, onManagePermissions, onDeleteUser }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [affiliationFilter, setAffiliationFilter] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [showInactive, setShowInactive] = useState(false);

    const [configuration, setConfiguration] = useState(null);
    const [reportDate, setReportDate] = useState('');
    const [savingConfig, setSavingConfig] = useState(false);

    const [militaryRanks, setMilitaryRanks] = useState([]);
    const [showRankForm, setShowRankForm] = useState(false);
    const [editingRank, setEditingRank] = useState(null);
    const [rankFormData, setRankFormData] = useState({
        code: '',
        displayName: '',
        description: '',
        sortOrder: ''
    });

    const [serviceHealth, setServiceHealth] = useState([]);
    const [loadingHealth, setLoadingHealth] = useState(false);
    const [healthError, setHealthError] = useState(null);

    const [activeTab, setActiveTab] = useState('users');

    const userRole = localStorage.getItem('role');
    const isAdmin = userRole === 'Admin';

    const [configLoading, setConfigLoading] = useState(false);
    const [formatPreview, setFormatPreview] = useState('');

    const [timezones, setTimezones] = useState([]);


    const [configForm, setConfigForm] = useState({
        // expirationDate: '',
        // pdfReportDate: '',
        excelDateTimeFormat: 'yyyy-MM-dd HH:mm:ss',
        excelTimezone: 'Turkey Standard Time'

    });
    const commonFormats = [
        { value: 'yyyy-MM-dd HH:mm:ss', label: '2025-12-07 14:30:45' },
        { value: 'dd/MM/yyyy HH:mm', label: '07/12/2025 14:30' },
        { value: 'dd.MM.yyyy HH:mm:ss', label: '07.12.2025 14:30:45' },
        { value: 'MM/dd/yyyy hh:mm tt', label: '12/07/2025 02:30 PM' },
        { value: 'yyyy-MM-dd', label: '2025-12-07' },
        { value: 'dd/MM/yyyy', label: '07/12/2025' },
    ];
    


    useEffect(() => {
        loadUsers();
        loadConfiguration();
        loadMilitaryRanks();
        loadSystemHealth();

    }, [showInactive]);

    useEffect(() => {
        if (activeTab === 'exceldate') {
            loadConfiguration();
            loadTimezones();
        }
    }, [activeTab]);


    // Load health only when services tab is opened
    useEffect(() => {
        if (activeTab === 'services') {
            loadServiceHealth();
        }
    }, [activeTab]);

    const loadMilitaryRanks = async () => {
        try {
            const response = await militaryRanksAPI.getAll();
            setMilitaryRanks(response.data);
        } catch (error) {
            console.error('Error loading military ranks:', error);
        }
    };

    const loadTimezones = async () => {
        try {
            const response = await configurationAPI.getTimezones();
            setTimezones(response.data || []);
        } catch (error) {
            console.error('Error loading timezones:', error);
        }
    };

    const loadSystemHealth = async () => {
        try {
            setLoadingHealth(true);
            setHealthError(null);
            const response = await systemAPI.getHealth();
            setServiceHealth(response.data || []);
        } catch (error) {
            console.error('Error loading system health:', error);
            setHealthError('Sistem durumu alınamadı');
        } finally {
            setLoadingHealth(false);
        }
    };

    const handleConfigChange = (e) => {
        const { name, value } = e.target;
        setConfigForm(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const loadUsers = async () => {
        try {
            setLoading(true);
            const response = await userApi.getAll(showInactive);
            setUsers(response.data || []);
        } catch (error) {
            console.error('Error loading users:', error);
            toast.error('Failed to load users. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const loadConfiguration = async () => {
        try {
            setConfigLoading(true);
            const response = await configurationAPI.get();
            const data = response.data;
            setConfiguration(data);
            setConfigForm({
                // expirationDate: data.expirationDate ? data.expirationDate.split('T')[0] : '',
                // pdfReportDate: data.pdfReportDate.split('T')[0],
                excelDateTimeFormat: data.excelDateTimeFormat,
                excelTimezone: data.excelTimezone
            });

            const pdfDate = new Date(response.data.pdfReportDate);
            const localDateTime = formatDateTimeLocal(pdfDate);
            setReportDate(localDateTime);
        } catch (error) {
            console.error("Failed to load configuration", error);
            setReportDate(formatDateTimeLocal(new Date()));
        } finally {
            setConfigLoading(false);
        }
    };

    // NEW: load system health
    const loadServiceHealth = async () => {
        try {
            setLoadingHealth(true);
            setHealthError(null);
            // implement this in services/api.jsx to call GET /api/users/health
            const response = await systemAPI.getHealth();
            setServiceHealth(response.data || []);
        } catch (error) {
            console.error('Error loading system health:', error);
            setHealthError('Servis durumları yüklenemedi.');
        } finally {
            setLoadingHealth(false);
        }
    };

    const formatDateTimeLocal = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const handleAddRank = () => {
        setEditingRank(null);
        setRankFormData({
            code: '',
            displayName: '',
            description: '',
            sortOrder: ''
        });
        setShowRankForm(true);
    };

    const handleEditRank = (rank) => {
        setEditingRank(rank);
        setRankFormData({
            code: rank.code,
            displayName: rank.displayName,
            description: rank.description || '',
            sortOrder: rank.sortOrder.toString()
        });
        setShowRankForm(true);
    };


    const handleStartService = async (name) => {
        const confirm = await showConfirmToast(`${name} servisini başlatmak istiyor musunuz?`);
        if (!confirm) { toast.info("İşlem iptal edildi."); return; }



        try {
            await systemAPI.startService(name);
            await loadSystemHealth();
        } catch (error) {
            console.error('Error starting service:', error);
            toast.error('Servis başlatılamadı: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleRestartService = async (name) => {
        const confirm = await showConfirmToast(`${name} servisini yeniden başlatmak istiyor musunuz?`);
        if (!confirm) { toast.info("İşlem iptal edildi."); return; }

        try {
            await systemAPI.restartService(name);
            await loadSystemHealth();
        } catch (error) {
            console.error('Error restarting service:', error);
            toast.error('Servis yeniden başlatılamadı: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleFlushRedis = async () => {
        const confirm = await showConfirmToast("Redis önbelleğini tamamen temizlemek istediğinize emin misiniz?");
        if (!confirm) { toast.info("İşlem iptal edildi."); return; }

        try {
            await systemAPI.flushRedis();
            toast.success('Redis önbelleği temizlendi.');
        } catch (error) {
            console.error('Error flushing redis:', error);
            toast.error('Redis temizlenemedi: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleSaveRank = async () => {
        try {
            const data = {
                code: rankFormData.code,
                displayName: rankFormData.displayName,
                description: rankFormData.description || null,
                sortOrder: rankFormData.sortOrder ? parseInt(rankFormData.sortOrder) : null
            };

            if (editingRank) {
                await militaryRanksAPI.update(editingRank.id, data);
            } else {
                await militaryRanksAPI.create(data);
            }

            setShowRankForm(false);
            loadMilitaryRanks();
            toast.success(editingRank ? 'Rütbe güncellendi' : 'Rütbe eklendi');
        } catch (error) {
            console.error('Error saving rank:', error);
            toast.error('Rütbe kaydedilemedi: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleDeleteRank = async (id) => {

        const confirm = await showConfirmToast("Bu rütbeyi silmek istediğinize emin misiniz?");
        if (!confirm) { toast.info("İşlem iptal edildi."); return; }

        try {
            await militaryRanksAPI.delete(id);
            loadMilitaryRanks();
            toast.success('Rütbe silindi');
        } catch (error) {
            console.error('Error deleting rank:', error);
            toast.error('Rütbe silinemedi: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleToggleRankActive = async (id, isActive) => {
        try {
            if (isActive) {
                await militaryRanksAPI.deactivate(id);
            } else {
                await militaryRanksAPI.activate(id);
            }
            loadMilitaryRanks();
        } catch (error) {
            console.error('Error toggling rank:', error);
        }
    };

    const handleSaveConfiguration = async () => {

        const confirm = await showConfirmToast("Bilgileri güncellemek istediğinize emin misiniz?");
        if (!confirm) { toast.info("İşlem iptal edildi."); return; }


        try {
            setSavingConfig(true);

            const pdfDate = new Date(reportDate);

            const response = await configurationAPI.update({
                pdfReportDate: pdfDate.toISOString(),
                expirationDate: configuration?.expirationDate || null, 
                excelDateTimeFormat: configForm.excelDateTimeFormat,
                excelTimezone: configForm.excelTimezone
            });

            setConfiguration(response.data);
            toast.success('Konfigürasyon başarıyla güncellendi!');
        } catch (error) {
            console.error('Error saving configuration:', error);
            toast.error('Konfigürasyon güncellenirken hata oluştu: ' + error.message);
        } finally {
            setSavingConfig(false);
        }
    };

    const handleResetReportDate = () => {
        const now = new Date();
        setReportDate(formatDateTimeLocal(now));
    };

    const handleRestoreUser = async (userId) => {
        const confirm = await showConfirmToast("Bu kullanıcıyı geri yüklemek istediğinizden emin misi?");
        if (!confirm) { toast.info("İşlem iptal edildi."); return; }

        try {
            await userApi.restore(userId);
            toast.warning('Kullanıcı başarıyla geri yüklendi!');
            loadUsers();
        } catch (error) {
            console.error('Error restoring user:', error);
            toast.error('Kullanıcı geri yüklenirken hata oluştu!');
        }
    };

    const handleDeleteUserLocal = async (userId) => {

        const confirm = await showConfirmToast("Bu kullanıcıyı silmek istediğinizden emin misi?");
        if (!confirm) { toast.info("İşlem iptal edildi."); return; }


        try {
            await userApi.delete(userId);
            toast.success('User deleted successfully.');
            loadUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            toast.error('Failed to delete user. Please try again later.');
        }
    };

    const getRoleBadgeColor = (role) => {
        const colors = {
            Admin: '#d32f2f',
            Editor: '#f57c00',
            Viewer: '#1976d2',
        };
        return colors[role] || '#666';
    };

    const getAffiliationBadgeColor = (affiliation) => {
        const colors = {
            Airforce: '#2196f3',
            Navy: '#0d47a1',
            Army: '#388e3c',
            Marines: '#d32f2f',
            CoastGuard: '#ff6f00',
            Internal: '#7b1fa2',
            External: '#616161',
        };
        return colors[affiliation] || '#9e9e9e';
    };

    // Filter users
    const filteredUsers = users.filter(user => {
        if (searchText) {
            const search = searchText.toLowerCase();
            const matchesSearch =
                user.displayName.toLowerCase().includes(search) ||
                user.email.toLowerCase().includes(search) ||
                (user.department && user.department.toLowerCase().includes(search));
            if (!matchesSearch) return false;
        }
       if (affiliationFilter && user.affiliation !== affiliationFilter) return false; 
       if (roleFilter && user.role !== roleFilter) return false;

        return true;
    });

    // Helper for service status icon
    const renderServiceStatusIcon = (svc) => {
        const status = svc.status;
        const canStart = svc.canStart;

        if (status === 'Running') {
            return <span style={{ ...styles.serviceStatusBadge, ...styles.statusRunning }}>●</span>;
        }
        if (status === 'Stopped' && canStart) {
            return <span style={{ ...styles.serviceStatusBadge, ...styles.statusStopped }}>▲</span>;
        }
        return <span style={{ ...styles.serviceStatusBadge, ...styles.statusError }}>✖</span>;
    };

    if (!isAdmin) {
        return (
            <div style={styles.container}>
                <div style={styles.noAccess}>
                    <h2>Access Denied</h2>
                    <p>Only administrators can view the users list.</p>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Kullanıcı Kontrol Paneli</h1>
                    <p style={styles.subtitle}>
                        {filteredUsers.length} / {users.length} kullanıcı gösterilmektedir.
                    </p>
                </div>
            </div>

            {/* TAB BAR */}
            <div style={styles.tabsContainer}>
                <div style={styles.tabList}>
                    <button
                        type="button"
                        onClick={() => setActiveTab('users')}
                        style={{
                            ...styles.tabButton,
                            ...(activeTab === 'users' ? styles.tabButtonActive : {})
                        }}
                    >
                        <UserPlus size={18} style={styles.tabIcon} />
                        <span style={styles.tabLabel}>Kullanıcılar</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('report')}
                        style={{
                            ...styles.tabButton,
                            ...(activeTab === 'report' ? styles.tabButtonActive : {})
                        }}
                    >
                        <FileText size={18} style={styles.tabIcon} />
                        <span style={styles.tabLabel}>Rapor Tarihi</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('ranks')}
                        style={{
                            ...styles.tabButton,
                            ...(activeTab === 'ranks' ? styles.tabButtonActive : {})
                        }}
                    >
                        <Shield size={18} style={styles.tabIcon} />
                        <span style={styles.tabLabel}>Rütbe Yönetimi</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('services')}
                        style={{
                            ...styles.tabButton,
                            ...(activeTab === 'services' ? styles.tabButtonActive : {})
                        }}
                    >
                        <Server size={18} style={styles.tabIcon} />
                        <span style={styles.tabLabel}>Servisler</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('exceldate')}
                        style={{
                            ...styles.tabButton,
                            ...(activeTab === 'exceldate' ? styles.tabButtonActive : {})
                        }}
                    >
                        <FileSpreadsheetIcon size={18} style={styles.tabIcon} />
                        <span style={styles.tabLabel}>Tarih Formatı</span>
                    </button>
                </div>
            </div>

            <div style={styles.tabContent}>
                {/* TAB 1: USERS */}
                {activeTab === 'users' && (
                    <>
                        <div style={styles.controls}>
                            <div style={styles.filterGroup}>
                                <input
                                    type="text"
                                    placeholder="Kullanıcı Ara..."
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    style={styles.searchInput}
                                />

                                <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                    style={styles.select}
                                >
                                    <option value="">Erişim İzinleri</option>
                                    <option value="Admin">Yönetici</option>
                                    <option value="Editor">Editör</option>
                                    <option value="Viewer">Görüntüleyici</option>
                                </select>

                                <select
                                    value={affiliationFilter}
                                    onChange={(e) => setAffiliationFilter(e.target.value)}
                                    style={styles.select}
                                >
                                    <option value="">Kurumlar</option>
                                    <option value="Airforce">Hava Kuvvetleri</option>
                                    <option value="Contractor">TUSAS</option>
                                    <option value="Subcontractor">Yüklenici</option>
                                </select>

                                <label style={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        checked={showInactive}
                                        onChange={(e) => setShowInactive(e.target.checked)}
                                        style={styles.checkbox}
                                    />
                                    Aktif Olmayan Kullanıcılar
                                </label>

                                <button onClick={loadUsers} style={styles.refreshBtn}>
                                    Yenile
                                </button>
                            </div>

                            <button onClick={onCreateUser} style={styles.addBtn}>
                                + Yeni Kullanıcı Ekle
                            </button>
                        </div>

                        {loading ? (
                            <div style={styles.loading}>Loading users...</div>
                        ) : filteredUsers.length === 0 ? (
                            <div style={styles.emptyState}>
                                <p>No users found</p>
                            </div>
                        ) : (
                            <div style={styles.tableWrapper}>
                                <table style={styles.table}>
                                    <thead>
                                        <tr>
                                            <th style={styles.th}>İsim</th>
                                            <th style={styles.th}>E-posta</th>
                                            <th style={styles.th}>Rol</th>
                                            <th style={styles.th}>Kurum</th>
                                            <th style={styles.th}>Rütbe</th>
                                            <th style={styles.th}>Birim</th>
                                            <th style={styles.th}>Telefon</th>
                                            <th style={styles.th}>Durum</th>
                                            <th style={styles.th}>Ayarlar</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.map((user) => (
                                            <tr key={user.id} style={styles.tr}>
                                                <td style={styles.td}>
                                                    <strong>{user.displayName}</strong>
                                                </td>
                                                <td style={styles.td}>{user.email}</td>
                                                <td style={styles.td}>
                                                    <span style={{
                                                        ...styles.roleBadge,
                                                        backgroundColor: getRoleBadgeColor(user.role),
                                                    }}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td style={styles.td}>
                                                    <span style={{
                                                        ...styles.affiliationBadge,
                                                        backgroundColor: getAffiliationBadgeColor(user.affiliation),
                                                    }}>
                                                        {user.affiliation}
                                                    </span>
                                                </td>
                                                <td style={styles.td}>
                                                    {user.militaryRank || '-'}
                                                </td>
                                                <td style={styles.td}>{user.department || '-'}</td>
                                                <td style={styles.td}>{user.phoneNumber || '-'}</td>
                                                <td style={styles.td}>
                                                    <span style={{
                                                        ...styles.statusBadge,
                                                        backgroundColor: user.isActive ? '#e8f5e9' : '#ffebee',
                                                        color: user.isActive ? '#388e3c' : '#d32f2f',
                                                    }}>
                                                        {user.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td style={styles.td}>
                                                    <div style={styles.actions}>
                                                        <button
                                                            style={styles.actionBtn}
                                                            title="Edit User"
                                                            onClick={() => onEditUser(user.id)}
                                                        >
                                                            <Edit size={16} />
                                                        </button>

                                                        {!user.isActive && (
                                                            <button
                                                                onClick={() => handleRestoreUser(user.id)}
                                                                style={{ ...styles.actionBtn, color: '#d32f2f' }}
                                                                title="Geri Yükle"
                                                            >
                                                                <RotateCcw size={18} />
                                                            </button>
                                                        )}

                                                        <button
                                                            style={{ ...styles.actionBtn, color: '#d32f2f' }}
                                                            title="Delete User"
                                                            onClick={() => handleDeleteUserLocal(user.id)}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                {/* TAB 2: REPORT DATE */}
                {activeTab === 'report' && (
                    <div style={styles.reportSection}>
                        <h3 style={styles.reportTitle}>
                            <FileText size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            Rapor Basım Tarihi
                        </h3>
                        <div style={styles.reportDateContainer}>
                            <input
                                type="datetime-local"
                                value={reportDate}
                                onChange={(e) => setReportDate(e.target.value)}
                                style={styles.dateInput}
                            />
                            <button
                                onClick={handleResetReportDate}
                                style={styles.resetButton}
                                title="Şimdiki zamana sıfırla"
                            >
                                Şimdi
                            </button>
                            <button
                                onClick={handleSaveConfiguration}
                                disabled={savingConfig}
                                style={{ ...styles.button, ...styles.resetButton }}
                                title="Kaydet"
                            >
                                <Save size={18} style={{ marginRight: '8px' }} />
                                {savingConfig ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                            <div style={styles.dateInfo}>
                                <span style={styles.infoLabel}>Seçili Tarih:</span>
                                <span style={styles.infoValue}>
                                    {new Date(reportDate).toLocaleString('tr-TR', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </span>
                            </div>
                        </div>

                        {configuration && (
                            <div style={styles.configInfo}>
                                <p style={styles.configInfoText}>
                                    <strong>Son Güncelleme:</strong>{' '}
                                    {new Date(configuration.updatedDate).toLocaleString('tr-TR')}
                                    {configuration.updatedByName && ` • ${configuration.updatedByName}`}
                                </p>
                            </div>
                        )}

                        <p style={styles.reportNote}>
                            ℹ️ Bu tarih, oluşturulan tüm PDF raporlarında onay tarihi olarak kullanılacaktır.
                        </p>
                    </div>
                )}

                {/* TAB 3: RANK MANAGEMENT */}
                {activeTab === 'ranks' && (
                    <div style={styles.rankSection}>
                        <div style={styles.rankHeader}>
                            <h2 style={styles.reportTitle}>
                                Rütbe Yönetimi
                            </h2>
                            <button onClick={handleAddRank} style={styles.addBtn}>
                                + Yeni Rütbe Ekle
                            </button>
                        </div>
                        {showRankForm && (
                            <div style={styles.rankForm}>
                                <div style={styles.rankFormGrid}>
                                    <div style={styles.formGroup}>
                                        <label style={styles.label}>Kod *</label>
                                        <input
                                            type="text"
                                            value={rankFormData.code}
                                            onChange={(e) => setRankFormData({ ...rankFormData, code: e.target.value })}
                                            placeholder="Örn: ALBAY"
                                            style={styles.input}
                                        />
                                    </div>
                                    <div style={styles.formGroup}>
                                        <label style={styles.label}>Görünen İsim *</label>
                                        <input
                                            type="text"
                                            value={rankFormData.displayName}
                                            onChange={(e) => setRankFormData({ ...rankFormData, displayName: e.target.value })}
                                            placeholder="Örn: Albay"
                                            style={styles.input}
                                        />
                                    </div>
                                    <div style={styles.formGroup}>
                                        <label style={styles.label}>Açıklama</label>
                                        <input
                                            type="text"
                                            value={rankFormData.description}
                                            onChange={(e) => setRankFormData({ ...rankFormData, description: e.target.value })}
                                            placeholder="Opsiyonel açıklama"
                                            style={styles.input}
                                        />
                                    </div>
                                    <div style={styles.formGroup}>
                                        <label style={styles.label}>Sıralama</label>
                                        <input
                                            type="number"
                                            value={rankFormData.sortOrder}
                                            onChange={(e) => setRankFormData({ ...rankFormData, sortOrder: e.target.value })}
                                            placeholder="Boş bırakılırsa otomatik"
                                            style={styles.input}
                                        />
                                    </div>
                                </div>
                                <div style={styles.rankFormActions}>
                                    <button
                                        onClick={() => setShowRankForm(false)}
                                        style={styles.cancelButton}
                                    >
                                        <X size={16} />
                                        İptal
                                    </button>
                                    <button
                                        onClick={handleSaveRank}
                                        disabled={!rankFormData.code || !rankFormData.displayName}
                                        style={{
                                            ...styles.saveButton,
                                            ...(!rankFormData.code || !rankFormData.displayName ? styles.saveButtonDisabled : {})
                                        }}
                                    >
                                        <Save size={16} />
                                        {editingRank ? 'Güncelle' : 'Ekle'}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div style={styles.rankTable}>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={styles.th}>Kod</th>
                                        <th style={styles.th}>Görünen İsim</th>
                                        <th style={styles.th}>Açıklama</th>
                                        <th style={styles.th}>Sıralama</th>
                                        <th style={styles.th}>İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {militaryRanks.map((rank) => (
                                        <tr key={rank.id} style={{
                                            ...styles.tr,
                                            ...(rank.isActive ? {} : styles.inactiveRow)
                                        }}>
                                            <td style={styles.td}>{rank.code}</td>
                                            <td style={styles.td}>{rank.displayName}</td>
                                            <td style={styles.td}>{rank.description || '-'}</td>
                                            <td style={styles.td}>{rank.sortOrder}</td>

                                            <td style={styles.td}>
                                                <div style={styles.actions}>
                                                    <button
                                                        onClick={() => handleEditRank(rank)}
                                                        style={styles.iconButton}
                                                        title="Düzenle"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>

                                                    <button
                                                        onClick={() => handleDeleteRank(rank.id)}
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
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB 4: SERVICE MANAGEMENT */}
                {activeTab === 'services' && (
                    <div style={styles.servicePanel}>
                        <h3 style={styles.reportTitle}>
                            <Server size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            Servis Yönetimi
                        </h3>

                        <p style={styles.serviceIntro}>
                            Veritabanı, Redis ve yedekleme servislerinin durumunu izleyin.
                        </p>

                        <div style={styles.serviceToolbar}>
                            <button onClick={loadServiceHealth} style={styles.refreshBtn}>
                                Durumları Yenile
                            </button>
                        </div>

                        {loadingHealth && (
                            <div style={styles.loading}>Servis durumları yükleniyor...</div>
                        )}

                        {healthError && !loadingHealth && (
                            <div style={styles.healthError}>{healthError}</div>
                        )}

                        {!loadingHealth && !healthError && (
                            <div style={styles.tableWrapper}>
                                <table style={styles.table}>
                                    <thead>
                                        <tr>
                                            <th style={styles.th}>Servis</th>
                                            <th style={styles.th}>Durum</th>
                                            <th style={styles.th}>Açıklama</th>
                                            <th style={styles.th}>İşlemler</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {serviceHealth.map((svc) => {
                                            const isRedis = svc.name === "redis";
                                            const isRunning = svc.status === "Running";

                                            return (
                                                <tr key={svc.name} style={styles.tr}>
                                                    <td style={styles.td}>
                                                        <strong>{svc.name}</strong>
                                                    </td>

                                                    <td style={styles.td}>
                                                        {renderServiceStatusIcon(svc)}
                                                        <span style={{ marginLeft: 8 }}>{svc.status}</span>
                                                    </td>

                                                    <td style={styles.td}>{svc.description}</td>

                                                    <td style={styles.td}>
                                                        <div style={{ display: "flex", gap: "0.5rem" }}>

                                                            {/* ▶ START */}

                                                            {!isRunning && svc.canStart && (
                                                                <button
                                                                    style={{ ...styles.systemBtn, backgroundColor: "#22c55e" }}
                                                                    onClick={() => handleStartService(svc.name)}
                                                                >
                                                                    <Play size={14} style={{ marginRight: 4 }} />
                                                                    Başlat
                                                                </button>
                                                            )}



                                                            {/* ↻ RESTART */}
                                                            {isRunning && (
                                                                <button
                                                                    style={{ ...styles.systemBtn, backgroundColor: "#3b82f6" }}
                                                                    onClick={() => handleRestartService(svc.name)}
                                                                >
                                                                    <RefreshCw size={14} style={{ marginRight: 4 }} />
                                                                    Yeniden Başlat
                                                                </button>
                                                            )}

                                                            {/* 🧹 CLEAR / FLUSH (Redis only) */}
                                                            {isRedis && isRunning && (
                                                                <button
                                                                    style={{ ...styles.systemBtn, backgroundColor: "#f97316" }}
                                                                    onClick={handleFlushRedis}
                                                                >
                                                                    <Trash2 size={14} style={{ marginRight: 4 }} />
                                                                    Redis Flush
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 5: REPORT DATE */}
                {activeTab === 'exceldate' && (
                    <div style={styles.servicePanel}>
                        <h3 style={styles.reportTitle}>
                            <Calendar size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            Excel Tarih/Saat Formatı Ayarları
                        </h3>

                        <p style={styles.serviceIntro}>
                            Excel dışa aktarımlarında kullanılacak tarih/saat formatını ve saat dilimini yapılandırın.
                        </p>

                        {configLoading && (
                            <div style={styles.loading}>Yapılandırma yükleniyor...</div>
                        )}

                        {!configLoading && (
                            <div style={styles.configForm}>



                                {/* Excel Format Section */}
                                <div style={styles.configSection}>
                                    <h4 style={styles.configSectionTitle}>
                                        <Calendar size={18} style={{ marginRight: '8px' }} />
                                        Excel Tarih Formatı
                                    </h4>

                                    <div style={styles.formField}>
                                        <label style={styles.formLabel}>
                                            Hazır Format Şablonları
                                        </label>
                                        <select
                                            value={configForm.excelDateTimeFormat}
                                            onChange={(e) => setConfigForm(prev => ({
                                                ...prev,
                                                excelDateTimeFormat: e.target.value
                                            }))}
                                            style={styles.formSelect}
                                        >
                                            {commonFormats.map(format => (
                                                <option key={format.value} value={format.value}>
                                                    {format.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div style={styles.formField}>
                                        <label style={styles.formLabel}>
                                            <br></br>
                                            Özel Format <span style={styles.required}>*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="excelDateTimeFormat"
                                            value={configForm.excelDateTimeFormat}
                                            onChange={handleConfigChange}
                                            placeholder="yyyy-MM-dd HH:mm:ss"
                                            style={styles.formInput}
                                        />
                                        <div style={styles.formatHelp}>
                                            <strong>Format Kılavuzu:</strong>
                                            <div style={styles.formatGrid}>
                                                <li> yyyy = Yıl (4 haneli)  </li>
                                                <li>MM = Ay (2 haneli) </li>
                                                <li>dd = Gün (2 haneli) </li>
                                                <li>HH = Saat (24 saat) </li>
                                                <li>mm = Dakika </li>
                                                <li>ss = Saniye </li>
                                                <li>hh = Saat (12 saat) </li>
                                                <li>tt = AM/PM </li>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={styles.formField}>
                                        <label style={styles.formLabel}>
                                            Saat Dilimi <span style={styles.required}>*</span>
                                        </label>
                                        <select
                                            name="excelTimezone"
                                            value={configForm.excelTimezone}
                                            onChange={handleConfigChange}
                                            style={styles.formSelect}
                                        >
                                            {timezones.map(tz => (
                                                <option key={tz.id} value={tz.id}>
                                                    {tz.displayName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Preview Box */}
 <div style={styles.previewBox}>
                        <div style={styles.previewLabel}>
                            <Eye size={16} style={{ marginRight: '6px' }} />
                            Canlı Önizleme:
                        </div>
                        <TimePreview 
                            format={configForm.excelDateTimeFormat}
                            timezoneId={configForm.excelTimezone}
                        />
                    </div>
                                </div>

                                {/* Info Box */}
                                {configuration && (
                                    <div style={styles.infoBox}>
                                        <div style={styles.infoRow}>
                                            <strong>Son Güncelleme:</strong> {new Date(configuration.updatedDate).toLocaleString('tr-TR')}
                                        </div>
                                        {configuration.updatedByName && (
                                            <div style={styles.infoRow}>
                                                <strong>Güncelleyen:</strong> {configuration.updatedByName}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Save Button */}
                                <div style={styles.configActions}>
                                    <button
                                        onClick={handleSaveConfiguration}
                                        style={styles.saveConfigButton}
                                        disabled={configLoading}
                                    >
                                        <Save size={18} style={{ marginRight: '6px' }} />
                                        {configLoading ? 'Kaydediliyor...' : 'Yapılandırmayı Kaydet'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    container: {
        padding: '2rem',
        maxWidth: '1800px',
        margin: '0 auto',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
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

    /* TABS */
    tabsContainer: {
        marginBottom: '1rem',
    },
    tabList: {
        display: 'flex',
        gap: '0.25rem',
        borderBottom: '1px solid #e0e0e0',
        background: '#f3f4f6',
        padding: '0.25rem 0.25rem 0 0.25rem',
        borderRadius: '8px 8px 0 0',
    },

    tabButton: {
        display: 'flex',
        alignItems: 'center',
        padding: '0.65rem 1.3rem',
        background: 'transparent',
        border: 'none',
        borderBottom: '3px solid transparent',
        cursor: 'pointer',
        fontSize: '0.95rem',
        fontWeight: 500,
        color: '#6b7280', // gray-500
        borderRadius: '6px 6px 0 0',
        transition: 'background-color 0.2s, color 0.2s, border-color 0.2s, box-shadow 0.2s',
    },

    tabButtonActive: {
        backgroundColor: '#3b82f6',     // blue-500
        color: '#ffffff',
        borderBottomColor: '#3b82f6',
        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.3)',
    },
    tabIcon: {
        marginRight: '0.5rem',
    },
    tabLabel: {
        whiteSpace: 'nowrap',
    },
    tabContent: {
        marginTop: '1rem',
    },

    controls: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
        gap: '1rem',
        flexWrap: 'wrap',
    },
    filterGroup: {
        display: 'flex',
        gap: '1rem',
        flex: 1,
        flexWrap: 'wrap',
    },
    searchInput: {
        padding: '0.6rem',
        border: '1px solid #ddd',
        borderRadius: '4px',
        flex: 1,
        maxWidth: '300px',
    },
    select: {
        padding: '0.6rem',
        border: '1px solid #ddd',
        borderRadius: '4px',
        minWidth: '130px',
    },
    checkboxLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.6rem',
        fontSize: '0.9rem',
    },
    checkbox: {
        width: '16px',
        height: '16px',
    },
    refreshBtn: {
        padding: '0.6rem 1.2rem',
        background: '#f5f5f5',
        border: '1px solid #ddd',
        borderRadius: '4px',
        cursor: 'pointer',
    },
    addBtn: {
        padding: '0.6rem 1.2rem',
        background: '#4caf50',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: '500',
    },
    loading: {
        textAlign: 'center',
        padding: '3rem',
        color: '#666',
        fontSize: '1.2rem',
    },
    emptyState: {
        textAlign: 'center',
        padding: '3rem',
        background: 'white',
        borderRadius: '8px',
        color: '#666',
    },
    noAccess: {
        textAlign: 'center',
        padding: '3rem',
        background: 'white',
        borderRadius: '8px',
    },

    tableWrapper: {
        background: 'white',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        overflowX: 'auto',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        minWidth: '900px',
        backgroundColor: 'white',
    },
    th: {
        padding: '1rem',
        textAlign: 'left',
        background: '#f8f9fa',
        fontWeight: '600',
        borderBottom: '2px solid #dee2e6',
        fontSize: '0.85rem',
        color: '#333',
    },
    tr: {
        borderBottom: '1px solid #dee2e6',
        transition: 'background-color 0.2s',
    },
    td: {
        padding: '1rem',
        fontSize: '0.9rem',
        color: '#666',
    },

    roleBadge: {
        padding: '0.3rem 0.8rem',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: '600',
        color: 'white',
        textTransform: 'uppercase',
    },
    affiliationBadge: {
        padding: '0.3rem 0.8rem',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: '500',
        color: 'white',
    },
    statusBadge: {
        padding: '0.35rem 0.85rem',
        borderRadius: '12px',
        fontSize: '0.8rem',
        fontWeight: '600',
        textTransform: 'uppercase',
        display: 'inline-block',
    },

    actions: {
        display: 'flex',
        gap: '0.5rem',
    },
    actionBtn: {
        padding: '0.4rem',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: '#667eea',
        display: 'flex',
        alignItems: 'center',
    },

    reportSection: {
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginTop: '0.5rem',
    },
    reportTitle: {
        fontSize: '1.3rem',
        fontWeight: '600',
        color: '#333',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
    },
    reportDateContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
    },
    dateInput: {
        padding: '0.75rem',
        fontSize: '1rem',
        border: '2px solid #dee2e6',
        borderRadius: '6px',
        minWidth: '250px',
        cursor: 'pointer',
    },
    resetButton: {
        padding: '0.75rem 1.5rem',
        backgroundColor: '#667eea',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: '500',
        transition: 'background-color 0.2s',
    },
    dateInfo: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
    },
    infoLabel: {
        fontSize: '0.85rem',
        color: '#666',
    },
    infoValue: {
        fontSize: '1rem',
        fontWeight: '600',
        color: '#333',
    },
    reportNote: {
        margin: '1rem 0 0 0',
        padding: '1rem',
        backgroundColor: '#f0f7ff',
        borderLeft: '4px solid #667eea',
        color: '#333',
        fontSize: '0.9rem',
        borderRadius: '4px',
    },

    rankSection: {
        marginTop: '0.5rem',
        background: 'white',
        borderRadius: '8px',
        padding: '1.5rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    rankHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
    },
    rankForm: {
        background: '#f0f2ff',
        padding: '1.5rem',
        borderRadius: '8px',
        marginBottom: '1.5rem',
        border: '2px solid #667eea',
    },
    rankFormGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '1rem',
        marginBottom: '1rem',
    },
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
    },
    label: {
        fontSize: '0.875rem',
        fontWeight: '600',
        color: '#333',
    },
    input: {
        padding: '0.75rem',
        border: '1px solid #ddd',
        borderRadius: '6px',
        fontSize: '1rem',
        outline: 'none',
        transition: 'border-color 0.2s',
    },
    rankFormActions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '1rem',
    },
    cancelButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1.5rem',
        background: 'white',
        color: '#666',
        border: '1px solid #ddd',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.95rem',
        fontWeight: '500',
        transition: 'all 0.2s',
    },
    saveButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1.5rem',
        background: '#667eea',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.95rem',
        fontWeight: '500',
        transition: 'all 0.2s',
    },
    saveButtonDisabled: {
        background: '#ccc',
        cursor: 'not-allowed',
    },
    rankTable: {
        overflowX: 'auto',
    },
    inactiveRow: {
        backgroundColor: '#f8f9fa',
        opacity: 0.6,
    },
    iconButton: {
        padding: '0.5rem',
        background: '#e3f2fd',
        color: '#1976d2',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
    },

    systemBtn: {
        padding: '0.45rem 0.9rem',
        borderRadius: '6px',
        border: 'none',
        backgroundColor: '#6366f1',
        color: 'white',
        fontSize: '0.8rem',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        gap: '0.35rem',
        transition: 'opacity 0.2s',
    },
    systemBtnHover: {
        opacity: 0.85,
    },
    deleteButton: {
        padding: '0.5rem',
        background: '#ffebee',
        color: '#c62828',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
    },

    /* SERVICE PANEL */
    servicePanel: {
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '1.75rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginTop: '0.5rem',
    },
    serviceIntro: {
        marginBottom: '1rem',
        color: '#555',
        fontSize: '0.9rem',
    },
    serviceToolbar: {
        marginBottom: '1rem',
        display: 'flex',
        justifyContent: 'flex-end',
    },
    serviceStatusBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        fontSize: '0.7rem',
        fontWeight: 'bold',
        color: 'white',
    },
    statusRunning: {
        backgroundColor: '#4caf50',
    },
    statusStopped: {
        backgroundColor: '#4caf50',
        borderRadius: '4px',
    },
    statusError: {
        backgroundColor: '#f44336',
    },
    healthError: {
        padding: '1rem',
        backgroundColor: '#ffebee',
        borderRadius: '6px',
        color: '#c62828',
        marginTop: '0.5rem',
    },
    configForm: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
    },
    configSection: {
        padding: '1.5rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
    },
    configSectionTitle: {
        fontSize: '1.1rem',
        fontWeight: '600',
        color: '#444',
        marginBottom: '1.5rem',
        paddingBottom: '0.75rem',
        borderBottom: '2px solid #667eea',
        display: 'flex',
        alignItems: 'center',
    },
    formRow: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1.5rem',
    },
    formField: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
    },
    formLabel: {
        fontSize: '0.9rem',
        fontWeight: '500',
        color: '#555',
    },
    required: {
        color: '#dc3545',
    },
    formInput: {
        padding: '0.75rem',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '0.95rem',
        transition: 'border-color 0.2s',
    },
    formSelect: {
        padding: '0.75rem',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '0.95rem',
        backgroundColor: 'white',
        cursor: 'pointer',
    },
    formatHelp: {
        marginTop: '0.75rem',
        padding: '1rem',
        backgroundColor: '#fff',
        borderRadius: '6px',
        border: '1px solid #e0e0e0',
        fontSize: '0.85rem',
        color: '#666',
    },
    formatGrid: {
        marginTop: '0.5rem',
        lineHeight: '1.8',
        fontFamily: 'monospace',
    },
    previewBox: {
        marginTop: '1.5rem',
        padding: '1.5rem',
        backgroundColor: '#fff',
        borderRadius: '6px',
        border: '2px solid #667eea',
    },
    previewLabel: {
        fontSize: '0.9rem',
        color: '#666',
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
    },
    previewValue: {
        fontSize: '1.5rem',
        fontWeight: 'bold',
        color: '#667eea',
        fontFamily: 'monospace',
    },
    infoBox: {
        padding: '1rem',
        backgroundColor: '#e3f2fd',
        borderRadius: '6px',
        border: '1px solid #90caf9',
    },
    infoRow: {
        fontSize: '0.9rem',
        color: '#1976d2',
        marginBottom: '0.5rem',
    },
    configActions: {
        display: 'flex',
        justifyContent: 'flex-end',
        paddingTop: '1rem',
        borderTop: '2px solid #e0e0e0',
    },
    saveConfigButton: {
        display: 'flex',
        alignItems: 'center',
        padding: '0.75rem 2rem',
        border: 'none',
        borderRadius: '6px',
        background: '#28a745',
        color: 'white',
        cursor: 'pointer',
        fontSize: '0.95rem',
        fontWeight: '500',
        transition: 'all 0.2s',
    },
};
