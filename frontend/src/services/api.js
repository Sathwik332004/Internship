import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
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

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  getMe: () => api.get('/auth/me'),
  getUsers: () => api.get('/auth/users'),
  toggleUserStatus: (id) => api.put(`/auth/users/${id}/toggle-status`),
  deleteUser: (id) => api.delete(`/auth/users/${id}`)
  ,
  updateUser: (id, data) => api.put(`/auth/users/${id}`, data)
};

// Medicine API
export const medicineAPI = {
  getAll: (params) => api.get('/medicines', { params }),
  getOne: (id) => api.get(`/medicines/${id}`),
  search: (q) => api.get('/medicines/search', { params: { q } }),
  searchAll: (q) => api.get('/medicines/search-all', { params: { q } }),
  getByBarcode: (barcode) => api.get(`/medicines/barcode/${barcode}`),
  create: (data) => api.post('/medicines', data),
  update: (id, data) => api.put(`/medicines/${id}`, data),
  delete: (id) => api.delete(`/medicines/${id}`),
  getLowStock: () => api.get('/inventory/low-stock'),
  getExpiring: () => api.get('/medicines/alerts/expiring'),
  getBrands: () => api.get('/medicines/brands'),
  getInventoryReport: () => api.get('/medicines/report/inventory')
};

// Supplier API
export const supplierAPI = {
  getAll: (params) => api.get('/suppliers', { params }),
  getOne: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`)
};

// Purchase API
export const purchaseAPI = {
  getAll: (params) => api.get('/purchases', { params }),
  getOne: (id) => api.get(`/purchases/${id}`),
  create: (data) => api.post('/purchases', data),
  update: (id, data) => api.put(`/purchases/${id}`, data),
  delete: (id) => api.delete(`/purchases/${id}`),
  getReport: (params) => api.get('/purchases/report', { params })
};

// Purchase Return API
export const purchaseReturnAPI = {
  getAll: (params) => api.get('/purchase-returns', { params }),
  getOne: (id) => api.get(`/purchase-returns/${id}`),
  create: (data) => api.post('/purchase-returns', data)
};

// Inventory API
export const inventoryAPI = {
  getAll: (params) => api.get('/inventory', { params }),
  getByMedicine: (medicineId, params) => api.get(`/inventory/medicine/${medicineId}`, { params }),
  getStats: () => api.get('/inventory/stats'),
  dispose: (id, data) => api.post(`/inventory/${id}/dispose`, data),
  getDisposals: (params) => api.get('/inventory/disposals', { params })
};

// Bill API
export const billAPI = {
  getAll: (params) => api.get('/bills', { params }),
  getOne: (id) => api.get(`/bills/${id}`),
  create: (data) => api.post('/bills', data),
  update: (id, data) => api.put(`/bills/${id}`, data),
  getDashboard: () => api.get('/bills/dashboard'),
  getDailySales: (date) => api.get('/bills/sales/daily', { params: { date } }),
  getMonthlySales: (params) => api.get('/bills/sales/monthly', { params }),
  getTopMedicines: (params) => api.get('/bills/top-medicines', { params }),
  getSalesReport: (params) => api.get('/bills/report/sales', { params })
};

// Notification API
export const notificationAPI = {
  getAll: () => api.get('/notifications'),
  generate: () => api.post('/notifications/generate'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/mark-all-read')
};

// Audit Log API
export const auditLogAPI = {
  getAll: (params) => api.get('/audit-logs', { params })
};

// Staff Attendance API
export const staffAttendanceAPI = {
  getOverview: (params) => api.get('/staff-attendance', { params }),
  clockIn: (data) => api.post('/staff-attendance/clock-in', data),
  clockOut: (data) => api.post('/staff-attendance/clock-out', data),
  openSession: (data) => api.post('/staff-attendance/cashier-sessions', data),
  closeSession: (id, data) => api.post(`/staff-attendance/cashier-sessions/${id}/close`, data)
};

// Prescription API
export const prescriptionAPI = {
  getAll: (params) => api.get('/prescriptions', { params }),
  getOne: (id) => api.get(`/prescriptions/${id}`),
  create: (data) => api.post('/prescriptions', data),
  update: (id, data) => api.put(`/prescriptions/${id}`, data),
  linkBill: (id, data) => api.put(`/prescriptions/${id}/link-bill`, data),
  delete: (id) => api.delete(`/prescriptions/${id}`)
};

// Sales Return API
export const salesReturnAPI = {
  getAll: (params) => api.get('/sales-returns', { params }),
  getOne: (id) => api.get(`/sales-returns/${id}`),
  create: (data) => api.post('/sales-returns', data)
};

// Purchase Order API
export const purchaseOrderAPI = {
  getAll: (params) => api.get('/purchase-orders', { params }),
  getOne: (id) => api.get(`/purchase-orders/${id}`),
  create: (data) => api.post('/purchase-orders', data),
  update: (id, data) => api.put(`/purchase-orders/${id}`, data),
  approve: (id) => api.put(`/purchase-orders/${id}/approve`),
  send: (id) => api.put(`/purchase-orders/${id}/send`),
  cancel: (id) => api.put(`/purchase-orders/${id}/cancel`),
  delete: (id) => api.delete(`/purchase-orders/${id}`),
  removeItem: (id, itemId) => api.delete(`/purchase-orders/${id}/items/${itemId}`),
  runReorder: () => api.post('/purchase-orders/run-reorder')
};

// Asset API
export const assetAPI = {
  getAll: (params) => api.get('/assets', { params }),
  getOne: (id) => api.get(`/assets/${id}`),
  create: (data) => api.post('/assets', data),
  update: (id, data) => api.put(`/assets/${id}`, data),
  delete: (id) => api.delete(`/assets/${id}`),
  getReport: () => api.get('/assets/report')
};

export default api;
