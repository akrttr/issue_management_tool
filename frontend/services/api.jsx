import axios from 'axios';
import { API_BASE_URL } from '../src/config';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';



const GKT1_API_BASE_URL = import.meta.env.VITE_GKT1_API_URL || 'http://localhost:5001';

const gkt1Api = axios.create({
    baseURL: GKT1_API_BASE_URL,
    timeout: 10000,
});

export const gkt1API = {
    // Get latest TLE data for GKT1
    getTLE: () => gkt1Api.get('/api/gkt1/tle'),
    
    // Get today's pass predictions
    getTodayPasses: () => gkt1Api.get('/api/gkt1/passes/today'),
    
    // Get track points for visualization (orbit ground track)
    getTodayTrack: () => gkt1Api.get('/api/gkt1/track/today'),
    
    // Get current satellite position
    getCurrentPosition: () => gkt1Api.get('/api/gkt1/position/current'),
};

const api = axios.create({
    baseURL: API_BASE_URL,
});

let isRefreshing = false;
let failedQueue = [];
let isBackendOffline = false;
let offlineToastId = null;

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};


//Show persistent offline toast
const showOfflineToast = () => {
    if (!isBackendOffline && !offlineToastId) {
        isBackendOffline = true;
        offlineToastId = toast.error(
            '🔴 Sistem çevrimdışı! Bağlantı bekleniyor...',
            {
                position: 'top-center',
                autoClose: false,
                closeButton: true,
                draggable: false,
                closeOnClick: false,
                toastId: 'offline-toast'
            }
        );
    }
};

// Show online toast and dismiss offline toast
const showOnlineToast = () => {
    if (isBackendOffline) {
        isBackendOffline = false;
        
        // Dismiss offline toast
        if (offlineToastId) {
            toast.dismiss(offlineToastId);
            offlineToastId = null;
        }
        
        // Show success message
        toast.success('Sistem çevrimiçi! Bağlantı kuruldu.', {
            position: 'top-center',
            autoClose: 3000
        });
    }
};

const isTokenExpiringSoon = (token) => {
    try {
        const decoded = jwt_decode(token);
        const currentTime = Date.now() / 1000;
        // Refresh if token expires in less than 5 minutes
        return decoded.exp - currentTime < 300;
    } catch {
        return true;
    }
};


api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - handle errors properly
api.interceptors.response.use(
    (response) => {
        // If we get a successful response and were offline, show online toast
        if (isBackendOffline) {
            showOnlineToast();
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // CRITICAL: Check if this is a network error (backend offline)
        if (!error.response) {
            // Network error - backend is offline
            showOfflineToast();
            
            // Don't redirect to login, just reject the promise
            return Promise.reject(error);
        }

        //If we get any response, backend is online
        if (isBackendOffline) {
            showOnlineToast();
        }

        // Handle 401 errors (authentication errors)
        if (error.response.status === 401 && !originalRequest._retry) {
            // Check if this is from login or refresh endpoint
            if (originalRequest.url?.includes('/auth/login') || 
                originalRequest.url?.includes('/auth/refresh')) {
                // Don't try to refresh token for login/refresh failures
                return Promise.reject(error);
            }

            if (isRefreshing) {
                // Queue this request
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then(token => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return api(originalRequest);
                    })
                    .catch(err => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = localStorage.getItem('refreshToken');

            if (!refreshToken) {
                // No refresh token, redirect to login
                localStorage.clear();
                window.location.href = '/';
                return Promise.reject(error);
            }

            try {
                const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                    refreshToken
                });

                const { accessToken, refreshToken: newRefreshToken } = response.data;

                localStorage.setItem('token', accessToken);
                localStorage.setItem('refreshToken', newRefreshToken);

                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                processQueue(null, accessToken);

                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                
                // Only show toast and redirect if refresh actually failed (not network error)
                if (refreshError.response) {
                    toast.error('Oturum süresi doldu. Lütfen tekrar giriş yapın.', {
                        position: 'top-center',
                        autoClose: 3000,
                        onClose: () => {
                            localStorage.clear();
                            window.location.href = '/';
                        }
                    });
                }
                
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);
export const authAPI = {
    // login: (email, password) => api.post('/auth/login', { email, password }),
    // getCurrentUser: () => api.get('/auth/me'),
    login: (email, password) => api.post('/auth/login', { email, password }),
    refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
    logout: () => api.post('/auth/logout'),
    getCurrentUser: () => api.get('/auth/me'),

};

export const progressRequestsAPI = {
    getAll: (status) => api.get('/ProgressRequests', { params: { status } }),
    getByTicket: (ticketId) => api.get(`/ProgressRequests/${ticketId}`),
    getById: (id) => api.get(`/ProgressRequests/${id}`),
    updateProgress: (id, data) => api.post(`/ProgressRequests/${id}/update-progress`, data),
    respond: (id, data) => api.post(`/ProgressRequests/${id}/respond`, data),
    cancel: (id) => api.post(`/ProgressRequests/${id}/cancel`),
    delete: (id) => api.delete(`/ProgressRequests/${id}`),
};

export const notificationsAPI = {
    getAll: (params) => api.get('/Notifications', { params }),
    getById: (id) => api.get(`/Notifications/${id}`),
    getUnreadCount: () => api.get('/Notifications/unread-count'),
    getStats: () => api.get('/Notifications/stats'),
    createProgressRequest: (data) => api.post('/Notifications/progress-request', data),
    markAsRead: (id, readFrom = null) => api.post(`/Notifications/${id}/mark-read`, null, { params: { readFrom } }),
    markMultipleAsRead: (data) => api.post('/Notifications/mark-read', data),
    resolve: (id, data) => api.post(`/Notifications/${id}/resolve`, data),
};

export const ticketsAPI = {

    getAll: (status = null, includeDeleted = false) => {
        const params = {};
        if (status) params.status = status;
        if (includeDeleted) params.includeDeleted = true;
        return api.get('/tickets', { params });
    },
    getById: (id) => api.get(`/tickets/${id}`),

       getRecentActivities: (limit = 20) => 
        api.get(`/tickets/recent-activities?limit=${limit}`),

    create: (data) => api.post('/tickets', data),
    update: (id, data) => api.put(`/tickets/${id}`, data),
    delete: (id) => api.delete(`/tickets/${id}`),
    restore: (id) => api.post(`/tickets/${id}/restore`),

    // Change ticket status with optional pause reason
    changeStatus: (id, data) => api.post(`/tickets/${id}/status`, data),



    addComment: (id, body) => api.post(`/tickets/${id}/comments`, body),
    getAvailablePersonnel: () => api.get('/tickets/available-personnel'),

    //dropdowns except users 
    getAvailableSystems: () => api.get('/tickets/system'),
    getAvailableSubsystems: (systemId = null) => {
        const params = systemId ? { systemId } : {};
        return api.get('/tickets/subsystem', { params });
    },
    getAvailableCIs: (subsystemId = null) => {
        const params = subsystemId ? { subsystemId } : {};
        return api.get('/tickets/ci', { params });
    },
    getAvailableComponents: (ciId = null) => {
        const params = ciId ? { ciId } : {};
        return api.get('/tickets/component', { params });
    },

    exportToExcel: async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/tickets/export/excel`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Export failed');
            }

            // Get filename from Content-Disposition header if available
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `Ariza_Kayitlari_${new Date().getTime()}.xlsx`;
            if (contentDisposition) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            return { success: true };
        } catch (error) {
            console.error('Excel export error:', error);
            throw error;
        }
    }

};

export const dashboardAPI = {
    getStats: () => api.get('/dashboard'),
};

export const userApi = {
    getAll: async (includeInactive = false) => {
        try {
            const url = includeInactive
                ? `${API_BASE_URL}/Users?includeInactive=true`
                : `${API_BASE_URL}/Users`;

            const response = await fetch(url, {
                method: 'GET',
                headers: createHeaders(),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return { data };
        } catch (error) {
            console.error('Error fetching users:', error);
            return { error: error.message };
        }
    },

    getById: async (id) => {
        try {
            const response = await fetch(`${API_BASE_URL}/users/${id}`, {
                method: 'GET',
                headers: createHeaders(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return { data };
        } catch (error) {
            console.error(`Error fetching user ${id}:`, error);
            throw error;
        }
    },
    getPositions: async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/Users/positions`, {
                method: 'GET',
                headers: createHeaders(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return { data };
        } catch (error) {
            console.error(`Error fetching user ${id}:`, error);
            throw error;
        }
    },



    // Get current user profile
    getMyProfile: async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/users/me`, {
                method: 'GET',
                headers: createHeaders(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return { data };
        } catch (error) {
            console.error('Error fetching profile:', error);
            throw error;
        }
    },

    // Create new user (Admin only)
    create: async (userData) => {
        try {
            const response = await fetch(`${API_BASE_URL}/users`, {
                method: 'POST',
                headers: createHeaders(),
                body: JSON.stringify(userData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return { data };
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    },

    // Update user
    update: async (id, userData) => {
        try {
            const response = await fetch(`${API_BASE_URL}/users/${id}`, {
                method: 'PUT',
                headers: createHeaders(),
                body: JSON.stringify(userData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return { success: true };
        } catch (error) {
            console.error(`Error updating user ${id}:`, error);
            throw error;
        }
    },

    restore: async (id) => {
        try {
            const response = await fetch(`${API_BASE_URL}/users/${id}/restore`, {
                method: 'POST',
                headers: createHeaders(),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            console.error(`Error restoring user ${id}:`, error);
            throw error;
        }
    },

    // Change password
    changePassword: async (id, currentPassword, newPassword) => {
        try {
            const response = await fetch(`${API_BASE_URL}/users/${id}/password`, {
                method: 'PUT',
                headers: createHeaders(),
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return { success: true };
        } catch (error) {
            console.error('Error changing password:', error);
            throw error;
        }
    },


    // Delete user (Admin only - soft delete)
    delete: async (id) => {
        try {
            const response = await fetch(`${API_BASE_URL}/users/${id}`, {
                method: 'DELETE',
                headers: createHeaders(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return { success: true };
        } catch (error) {
            console.error(`Error deleting user ${id}:`, error);
            throw error;
        }
    },
    // Grant permission to user (Admin only)
    grantPermission: async (id, permissionData) => {
        try {
            const response = await fetch(`${API_BASE_URL}/users/${id}/permissions`, {
                method: 'POST',
                headers: createHeaders(),
                body: JSON.stringify(permissionData),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return { success: true };
        } catch (error) {
            console.error('Error granting permission:', error);
            throw error;
        }
    },

    // Revoke permission from user (Admin only)
    revokePermission: async (id, permissionType) => {
        try {
            const response = await fetch(`${API_BASE_URL}/users/${id}/permissions/${permissionType}`, {
                method: 'DELETE',
                headers: createHeaders(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return { success: true };
        } catch (error) {
            console.error('Error revoking permission:', error);
            throw error;
        }
    },

    // Get all military ranks
    getRanks: async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/users/ranks`, {
                method: 'GET',
                headers: createHeaders(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return { data };
        } catch (error) {
            console.error('Error fetching military ranks:', error);
            throw error;
        }
    },
};

function createHeaders() {
    const headers = {
        'Content-Type': 'application/json',
    };
    const token = localStorage.getItem('token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}


export const configurationAPI = {
    get: async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/configuration`, {
                method: 'GET',
                headers: createHeaders(),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return { data };
        } catch (error) {
            console.error('Error fetching configuration:', error);
            throw error;
        }
    },

    getTimezones: async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/configuration/timezones`, {
                method: 'GET',
                headers: createHeaders(),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return { data };
        } catch (error) {
            console.error('Error fetching configuration:', error);
            throw error;
        }
    },


    update: async (configData) => {
        try {
            const response = await fetch(`${API_BASE_URL}/configuration`, {
                method: 'PUT',
                headers: createHeaders(),
                body: JSON.stringify(configData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            console.error('Error updating configuration:', error);
            throw error;
        }
    },
};

export const militaryRanksAPI = {
    getAll: (includeInactive = false) => api.get('/MilitaryRanks'),
    getById: (id) => api.get(`/MilitaryRanks/${id}`),
    create: (data) => api.post('/MilitaryRanks', data),
    update: (id, data) => api.put(`/MilitaryRanks/${id}`, data),
    delete: (id) => api.delete(`/MilitaryRanks/${id}`),
    activate: (id) => api.post(`/MilitaryRanks/${id}/activate`),
    deactivate: (id) => api.post(`/MilitaryRanks/${id}`),
};


export const ticketPausesAPI = {
    getAll: (activeOnly) => api.get('/TicketPauses', { params: { activeOnly } }),
    getByTicket: (ticketId) => api.get(`/TicketPauses/ticket/${ticketId}`),
    getById: (id) => api.get(`/TicketPauses/${id}`),
    create: (data) => api.post('/TicketPauses', data),
    resume: (id, data) => api.post(`/TicketPauses/${id}/resume`, data),
    update: (id, data) => api.put(`/TicketPauses/${id}`, data),
    delete: (id) => api.delete(`/TicketPauses/${id}`),
};

export const systemAPI = {
    getHealth: () => api.get("/Users/health"),
    startService: (name) => api.post(`/Users/services/${name}/start`),
    restartService: (name) => api.post(`/Users/services/${name}/restart`),
    flushRedis: () => api.post("/Users/redis/flush"),
};


export default api; 