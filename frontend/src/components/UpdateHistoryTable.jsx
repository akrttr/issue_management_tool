import { History, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';


export default function UpdateHistoryTable({ 
    updates, 
    requestId,
    updateCount,
    compact = false, // For smaller displays
    onLoadUpdates = null // Optional: Load updates on demand
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleToggle = async () => {
        if (!isExpanded && onLoadUpdates && !updates) {
            // Load updates if not loaded yet
            setIsLoading(true);
            await onLoadUpdates(requestId);
            setIsLoading(false);
        }
        setIsExpanded(!isExpanded);
    };

    // Don't show anything if no updates
    if (!updateCount || updateCount === 0) {
        return null;
    }

    return (
        <div style={styles.container}>
            {/* Toggle Button */}
            <button
                onClick={handleToggle}
                style={compact ? styles.toggleButtonCompact : styles.toggleButton}
            >
                {isLoading ? (
                    <div style={styles.spinner} />
                ) : isExpanded ? (
                    <ChevronDown size={16} />
                ) : (
                    <ChevronRight size={16} />
                )}
                <History size={14} />
                <span>{updateCount} güncelleme</span>
            </button>

            {/* Expanded Table */}
            {isExpanded && updates && updates.length > 0 && (
                <div style={compact ? styles.tableWrapperCompact : styles.tableWrapper}>
                    {/* Header */}
                    <div style={styles.header}>
                        <History size={16} />
                        <span>Güncelleme Geçmişi ({updates.length})</span>
                    </div>
                    
                    {/* Table */}
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={{...styles.th, width: '60px'}}>#</th>
                                <th style={styles.th}>Tarih</th>
                                <th style={styles.th}>Güncelleyen</th>
                                <th style={{...styles.th, width: '120px'}}>İlerleme</th>
                                {!compact && <th style={styles.th}>Tahmini Tamamlanma</th>}
                                <th style={styles.th}>Mesaj</th>
                            </tr>
                        </thead>
                        <tbody>
                            {updates.map((update, idx) => (
                                <tr key={update.id} style={styles.tr}>
                                    {/* Update Number */}
                                    <td style={styles.td}>
                                        <span style={styles.updateNumber}>
                                            #{updates.length - idx}
                                        </span>
                                    </td>
                                    
                                    {/* Date */}
                                    <td style={styles.td}>
                                        {formatDate(update.updatedAt)}
                                    </td>
                                    
                                    {/* Updated By */}
                                    <td style={styles.td}>
                                        {update.updatedByName}
                                    </td>
                                    
                                    {/* Progress Percentage */}
                                    <td style={styles.td}>
                                        {update.progressPercentage !== null ? (
                                            <div style={styles.progressCell}>
                                                <div style={styles.progressBar}>
                                                    <div 
                                                        style={{
                                                            ...styles.progressFill,
                                                            width: `${update.progressPercentage}%`
                                                        }}
                                                    />
                                                </div>
                                                <span style={styles.progressText}>
                                                    %{update.progressPercentage}
                                                </span>
                                            </div>
                                        ) : (
                                            <span style={styles.noData}>-</span>
                                        )}
                                    </td>
                                    
                                    {/* Estimated Completion (hide in compact mode) */}
                                    {!compact && (
                                        <td style={styles.td}>
                                            {update.estimatedCompletion 
                                                ? formatDate(update.estimatedCompletion)
                                                : '-'}
                                        </td>
                                    )}
                                    
                                    {/* Message */}
                                    <td style={styles.td}>
                                        <div style={styles.message}>
                                            {update.progressInfo || '-'}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

const styles = {
    container: {
        marginTop: '0.5rem',
    },
    
    // Toggle Buttons
    toggleButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.375rem 0.75rem',
        backgroundColor: '#e3f2fd',
        border: '1px solid #90caf9',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.75rem',
        fontWeight: '500',
        color: '#1976d2',
        transition: 'all 0.2s',
    },
    toggleButtonCompact: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.25rem 0.5rem',
        backgroundColor: '#e3f2fd',
        border: '1px solid #90caf9',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.7rem',
        fontWeight: '500',
        color: '#1976d2',
        transition: 'all 0.2s',
    },
    
    // Spinner
    spinner: {
        width: '14px',
        height: '14px',
        border: '2px solid #1976d2',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
    },
    
    // Table Wrapper
    tableWrapper: {
        marginTop: '0.75rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '6px',
        border: '1px solid #dee2e6',
    },
    tableWrapperCompact: {
        marginTop: '0.5rem',
        padding: '0.75rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        border: '1px solid #dee2e6',
    },
    
    // Header
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.75rem',
        fontSize: '0.9rem',
        fontWeight: '600',
        color: '#495057',
    },
    
    // Table
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        backgroundColor: 'white',
        borderRadius: '6px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    th: {
        padding: '0.75rem',
        textAlign: 'left',
        fontSize: '0.8rem',
        fontWeight: '600',
        color: '#6c757d',
        backgroundColor: '#f1f3f5',
        borderBottom: '2px solid #dee2e6',
    },
    tr: {
        borderBottom: '1px solid #e9ecef',
    },
    td: {
        padding: '0.75rem',
        fontSize: '0.85rem',
        color: '#495057',
    },
    
    // Update Number Badge
    updateNumber: {
        display: 'inline-block',
        padding: '0.25rem 0.5rem',
        backgroundColor: '#667eea',
        color: 'white',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: '700',
    },
    
    // Progress
    progressCell: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    progressBar: {
        flex: 1,
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
    
    // Message
    message: {
        maxWidth: '400px',
        padding: '0.5rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        borderLeft: '3px solid #667eea',
        color: '#495057',
        lineHeight: '1.4',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
    },
    
    // No Data
    noData: {
        color: '#a0aec0',
        fontStyle: 'italic',
    },
};

// Add keyframes for spinner
if (typeof document !== 'undefined') {
    const styleSheet = document.styleSheets[0];
    const keyframes = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    try {
        styleSheet.insertRule(keyframes, styleSheet.cssRules.length);
    } catch (e) {
        // Keyframes might already exist
    }
}