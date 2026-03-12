import axios from 'axios';

const API_BASE = `${import.meta.env.BASE_URL}api`;

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject JWT token + cache-busting on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Cache-busting: add timestamp to all GET requests to prevent stale cache
  if (config.method === 'get') {
    config.params = { ...config.params, _t: Date.now() };
  }
  return config;
});

// Handle 401 responses globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = `${import.meta.env.BASE_URL}login`;
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth services
export const authService = {
  login: (identifier: string, password?: string) =>
    api.post('/auth/login.php', { identifier, ...(password ? { password } : {}) }),

  register: (data: { name: string; phone: string; email?: string; plate_number: string; vehicle_type?: string }) =>
    api.post('/auth/register.php', data),

  googleLogin: (credential: string) =>
    api.post('/auth/google.php', { credential }),

  me: () => api.get('/auth/me.php'),
};

// Customer services
export const customerService = {
  getActiveCard: (userId?: number) =>
    api.get('/customer/cards.php', { params: { action: 'active', ...(userId ? { user_id: userId } : {}) } }),

  getAllCards: () =>
    api.get('/customer/cards.php', { params: { action: 'all' } }),

  getProfile: () => api.get('/customer/profile.php'),

  updateProfile: (data: any) => api.put('/customer/profile.php', data),

  // Vehicle management
  getVehicles: (userId?: number) =>
    api.get('/customer/vehicles.php', { params: { action: 'list', ...(userId ? { user_id: userId } : {}) } }),

  addVehicle: (data: { plate_number: string; vehicle_type?: string; vehicle_model?: string; user_id?: number }) =>
    api.post('/customer/vehicles.php', { action: 'add', ...data }),

  removeVehicle: (vehicleId: number, userId?: number) =>
    api.post('/customer/vehicles.php', { action: 'remove', vehicle_id: vehicleId, ...(userId ? { user_id: userId } : {}) }),

  setPrimaryVehicle: (vehicleId: number, userId?: number) =>
    api.post('/customer/vehicles.php', { action: 'set_primary', vehicle_id: vehicleId, ...(userId ? { user_id: userId } : {}) }),
};

// Admin services
export const adminService = {
  getDashboard: () => api.get('/admin/dashboard.php'),

  searchCustomers: (query: string) =>
    api.get('/admin/customers.php', { params: { action: 'search', q: query } }),

  listCustomers: (page = 1, limit = 20, sort = 'newest') =>
    api.get('/admin/customers.php', { params: { action: 'list', page, limit, sort } }),

  getCustomerDetail: (id: number) =>
    api.get('/admin/customers.php', { params: { action: 'detail', id } }),

  addToken: (data: { customer_id: number; vehicle_id: number; amount?: number; token_count?: number; notes?: string; payment_method?: string; cash_amount?: number; online_amount?: number }) =>
    api.post('/admin/tokens.php', { action: 'add', ...data }),

  recordPayment: (data: { customer_id: number; vehicle_id: number; amount: number; notes?: string; payment_method?: string; cash_amount?: number; online_amount?: number }) =>
    api.post('/admin/tokens.php', { action: 'record_payment', ...data }),

  getTokenHistory: (customerId?: number, page = 1) =>
    api.get('/admin/tokens.php', { params: { action: 'history', customer_id: customerId, page } }),

  getPendingRedemptions: () =>
    api.get('/admin/redemptions.php', { params: { action: 'pending' } }),

  listRedemptions: (page = 1, q?: string, year?: number, month?: number) =>
    api.get('/admin/redemptions.php', { params: { action: 'list', page, q, year, month } }),

  getRedemptionStats: () =>
    api.get('/admin/redemptions.php', { params: { action: 'stats' } }),

  redeemCard: (cardId: number, notes?: string) =>
    api.post('/admin/redemptions.php', { action: 'redeem', card_id: cardId, notes }),

  getSettings: () => api.get('/admin/settings.php'),

  updateSettings: (data: Record<string, string>) => api.put('/admin/settings.php', data),

  uploadLogo: (file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    formData.append('action', 'upload_logo');
    return api.post('/admin/settings.php', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  removeLogo: () => api.post('/admin/settings.php', { action: 'remove_logo' }),

  // Service categories
  getCategories: (all = false) =>
    api.get('/admin/service-categories.php', { params: all ? { all: '1' } : {} }),

  addCategory: (data: { name: string; color?: string }) =>
    api.post('/admin/service-categories.php', { action: 'add', ...data }),

  updateCategory: (data: { id: number; name: string; status?: string; color?: string }) =>
    api.post('/admin/service-categories.php', { action: 'update', ...data }),

  deleteCategory: (id: number) =>
    api.post('/admin/service-categories.php', { action: 'delete', id }),

  reorderCategories: (order: number[]) =>
    api.post('/admin/service-categories.php', { action: 'reorder', order }),

  // Services management
  getServices: (all = false) =>
    api.get('/admin/services.php', { params: all ? { all: '1' } : {} }),

  addService: (data: { name: string; price: number; category_id?: number | null }) =>
    api.post('/admin/services.php', { action: 'add', ...data }),

  updateService: (data: { id: number; name: string; price: number; status: string; category_id?: number | null }) =>
    api.post('/admin/services.php', { action: 'update', ...data }),

  deleteService: (id: number) =>
    api.post('/admin/services.php', { action: 'delete', id }),

  reorderServices: (order: number[]) =>
    api.post('/admin/services.php', { action: 'reorder', order }),

  // Admin vehicle management
  getCustomerVehicles: (userId: number) =>
    api.get('/customer/vehicles.php', { params: { action: 'list', user_id: userId } }),

  // Revenue chart
  getRevenueChart: (year: number) =>
    api.get('/admin/revenue-chart.php', { params: { year } }),

  // Activity log
  getActivityLog: (page = 1, limit = 10, q?: string, type?: string) =>
    api.get('/admin/activity.php', { params: { page, limit, q, type } }),

  // Report
  getReport: (view: string, year?: number, month?: number) =>
    api.get('/admin/report.php', { params: { view, year, month } }),

  // Transaction details (drill-down from report)
  getTransactionDetails: (view: string, year: number, month?: number, day?: number) =>
    api.get('/admin/transactions-detail.php', { params: { view, year, month, day } }),

  // Staff management
  listStaff: (page = 1, limit = 20) =>
    api.get('/admin/staff.php', { params: { action: 'list', page, limit } }),

  searchStaff: (query: string) =>
    api.get('/admin/staff.php', { params: { action: 'search', q: query } }),

  addStaff: (data: { name: string; phone: string; email?: string; password: string; role: string }) =>
    api.post('/admin/staff.php', { action: 'add', ...data }),

  deleteStaff: (staffId: number) =>
    api.post('/admin/staff.php', { action: 'delete', staff_id: staffId }),

  changeStaffRole: (staffId: number, role: string) =>
    api.post('/admin/staff.php', { action: 'change_role', staff_id: staffId, role }),

  updateCustomer: (customerId: number, data: { name?: string; phone?: string; email?: string }) =>
    api.post('/admin/customers.php', { action: 'update', customer_id: customerId, ...data }),

  deleteCustomer: (customerId: number) =>
    api.post('/admin/customers.php', { action: 'delete', customer_id: customerId }),

  changeCustomerStatus: (customerId: number, status: 'active' | 'inactive' | 'banned') =>
    api.post('/admin/customers.php', { action: 'change_status', customer_id: customerId, status }),

  updateStaffPassword: (staffId: number, newPassword: string) =>
    api.post('/admin/staff.php', { action: 'update_password', staff_id: staffId, new_password: newPassword }),

  createStaffInvite: () =>
    api.post('/admin/staff.php', { action: 'create_invite' }),

  // Walk-in sales
  getWalkInSalesToday: () =>
    api.get('/admin/walkin-sales.php', { params: { action: 'today' } }),

  addWalkInSale: (data: { amount: number; customer_name?: string; notes?: string; payment_method?: string; cash_amount?: number; online_amount?: number }) =>
    api.post('/admin/walkin-sales.php', { action: 'add', ...data }),

  deleteWalkInSale: (id: number) =>
    api.post('/admin/walkin-sales.php', { action: 'delete', id }),

  // Transaction history & void
  getRecentTransactions: (params?: {
    page?: number; limit?: number;
    date_from?: string; date_to?: string;
    sort_by?: string; sort_dir?: 'ASC' | 'DESC';
    type?: string; status?: string; payment_method?: string; search?: string;
  }) => api.get('/admin/recent-transactions.php', { params }),

  voidTransaction: (transactionId: number, type: 'loyalty' | 'walkin', reason: string) =>
    api.post('/transaction-void.php', { transaction_id: transactionId, type, reason }),

  editPaymentMethod: (data: { transaction_id: number; type: 'loyalty' | 'walkin'; payment_method: string; cash_amount?: number; online_amount?: number }) =>
    api.post('/transaction-edit-payment.php', data),

  editWalkinAmount: (data: { transaction_id: number; amount: number; payment_method?: string; cash_amount?: number; online_amount?: number }) =>
    api.post('/transaction-edit-amount.php', data),

  // Truncate / Reset data
  getTruncatePreview: () =>
    api.get('/admin/truncate.php', { params: { action: 'preview' } }),

  truncateData: (action: string, confirmCode: string) =>
    api.post('/admin/truncate.php', { action, confirm_code: confirmCode }),

  // Broadcasts
  getBroadcasts: (page = 1) =>
    api.get('/admin/broadcasts.php', { params: { action: 'list', page } }),

  getBroadcastStats: () =>
    api.get('/admin/broadcasts.php', { params: { action: 'stats' } }),

  sendBroadcast: (data: { title: string; message: string; channels: string; customer_ids?: number[] }) =>
    api.post('/admin/broadcasts.php', { action: 'send', ...data }),

  deleteBroadcast: (broadcastId: number) =>
    api.post('/admin/broadcasts.php', { action: 'delete', broadcast_id: broadcastId }),

};

// Staff registration services (public, no auth required)
export const staffRegisterService = {
  validateInvite: (code: string) =>
    api.get('/auth/validate-invite.php', { params: { code } }),

  registerManual: (data: { invite_code: string; name: string; phone: string; password: string; email?: string }) =>
    api.post('/auth/staff-register.php', data),

  registerGoogle: (data: { invite_code: string; credential: string }) =>
    api.post('/auth/staff-register.php', data),
};

// Public services (no auth required)
export const publicService = {
  getSettings: () => api.get('/settings-public.php'),
};
