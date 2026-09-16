const API_BASE = '/api/v1';

class ApiError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('property_token');
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const json = await response.json();

  if (!response.ok || json.success === false) {
    const errorMsg = json.error?.message || response.statusText || 'An error occurred';
    const errorCode = json.error?.code || 'API_ERROR';
    throw new ApiError(errorMsg, errorCode);
  }

  return json.data as T;
}

export const api = {
  // Auth
  login: (credentials: { email: string; password: string }) =>
    request<{ accessToken: string; refreshToken: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }),

  register: (data: { email: string; password: string; fullName: string; phone?: string }) =>
    request<{ accessToken: string; refreshToken: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getMe: () => request<any>('/auth/me'),

  // Super Admin
  getSystemStats: () => request<any>('/admin/stats'),
  createOwner: (data: any) =>
    request<any>('/admin/owners', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  createProvider: (data: any) =>
    request<any>('/admin/providers', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getUsers: (params: string = '') => request<any[]>(`/admin/users?${params}`),
  getCompanies: (params: string = '') => request<any[]>(`/admin/companies?${params}`),
  getAuditLogs: (params: string = '') => request<any[]>(`/admin/audit-logs?${params}`),

  // Companies & Staff
  getCompany: (id: string) => request<any>(`/companies/${id}`),
  getCompanyStaff: (id: string) => request<any[]>(`/companies/${id}/staff`),
  createStaff: (companyId: string, data: any) =>
    request<any>(`/companies/${companyId}/staff`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Buildings & Rooms
  getBuildings: (params: string = '') => request<any[]>(`/buildings?${params}`),
  getBuildingById: (id: string) => request<any>(`/buildings/${id}`),
  getBuildingBySlug: (slug: string) => request<any>(`/buildings/slug/${slug}`),
  createBuilding: (data: any) =>
    request<any>('/buildings', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  addBuildingConfig: (buildingId: string, data: any) =>
    request<any>(`/buildings/${buildingId}/configurations`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getRooms: (params: string = '') => request<any[]>(`/rooms?${params}`),
  getRoomById: (id: string) => request<any>(`/rooms/${id}`),
  getRoomBySlug: (slug: string) => request<any>(`/rooms/slug/${slug}`),
  createRoom: (data: any) =>
    request<any>('/rooms', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateRoom: (id: string, data: any) =>
    request<any>(`/rooms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  getMetersByRoom: (roomId: string) => request<any[]>(`/meters/room/${roomId}`),

  // Rentals & Applications
  applyForRoom: (data: any) =>
    request<any>('/rentals/applications', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getApplications: (params: string = '') => request<any[]>(`/rentals/applications?${params}`),
  reviewApplication: (id: string, data: any) =>
    request<any>(`/rentals/applications/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Contracts
  getContracts: (params: string = '') => request<any[]>(`/contracts?${params}`),
  getActiveContract: () => request<any>('/contracts/active'),
  getContractById: (id: string) => request<any>(`/contracts/${id}`),
  createContract: (data: any) =>
    request<any>('/contracts', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  sendContractOtp: (contractId: string, channel: 'ZALO' | 'SMS' = 'ZALO') =>
    request<any>(`/contracts/${contractId}/send-otp`, {
      method: 'POST',
      body: JSON.stringify({ channel })
    }),
  signContract: (contractId: string, data: { signingMethod: 'CANVAS_DRAW' | 'OTP'; signatureData?: string; otpCode?: string }) =>
    request<any>(`/contracts/${contractId}/sign`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getContractEvidence: (contractId: string) => request<any>(`/contracts/${contractId}/evidence`),

  // Meters & Readings
  getRoomMeters: (roomId: string) => request<any[]>(`/meters/room/${roomId}`),
  recordMeterReading: (data: any) =>
    request<any>('/meters/readings', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Invoices & Billing
  getInvoices: (params: string = '') => request<any[]>(`/invoices?${params}`),
  getInvoiceById: (id: string) => request<any>(`/invoices/${id}`),
  generateInvoice: (data: any) =>
    request<any>('/invoices/generate', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Payments
  processPayment: (data: any) =>
    request<any>('/payments', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getPayments: (params: string = '') => request<any[]>(`/payments?${params}`),
  getVietQRInfo: (invoiceId: string) => request<any>(`/payments/vietqr/info/${invoiceId}`),
  sendVietQRWebhook: (data: any, secret?: string) =>
    request<any>('/payments/vietqr/webhook', {
      method: 'POST',
      headers: secret ? { 'x-api-key': secret } : undefined,
      body: JSON.stringify(data)
    }),

  // Services
  getServices: (params: string = '') => request<any[]>(`/services?${params}`),
  getStaffWorkload: (companyId?: string) => request<any[]>(`/services/workload?companyId=${companyId || ''}`),
  createService: (data: any) =>
    request<any>('/services', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Service Requests
  getServiceRequests: (params: string = '') => request<any[]>(`/service-requests?${params}`),
  createServiceRequest: (data: any) =>
    request<any>('/service-requests', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  reviewServiceRequest: (id: string, data: any) =>
    request<any>(`/service-requests/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  assignServiceStaff: (id: string, data: any) =>
    request<any>(`/service-requests/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateAssignmentStatus: (assignmentId: string, data: any) =>
    request<any>(`/service-requests/assignments/${assignmentId}/status`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Notifications
  getNotifications: () => request<{ notifications: any[]; unreadCount: number }>('/notifications'),
  markNotificationRead: (id: string) =>
    request<any>(`/notifications/${id}/read`, {
      method: 'POST'
    }),
  markAllNotificationsRead: () =>
    request<any>('/notifications/read-all', {
      method: 'POST'
    }),

  // Operations & Building Operating System
  getTodayCockpit: () => request<any>('/operations/today'),
  getActionCenter: (params: string = '') => request<any>(`/operations/actions?${params}`),
  executeQuickAction: (actionKey: string, actionType: string, payload: any = {}) =>
    request<any>(`/operations/actions/${encodeURIComponent(actionKey)}/quick-action`, {
      method: 'POST',
      body: JSON.stringify({ actionType, payload })
    }),
  getBuilding360: (id: string) => request<any>(`/operations/buildings/${id}/360`),
  getRoom360: (id: string) => request<any>(`/operations/rooms/${id}/360`),
  globalSearch: (q: string) => request<any>(`/operations/search?q=${encodeURIComponent(q)}`),
  getAiInsights: () => request<any>('/operations/ai-insights'),
  aiTriage: (description: string, categoryHint?: string) =>
    request<any>('/operations/ai-triage', {
      method: 'POST',
      body: JSON.stringify({ description, categoryHint })
    }),

  // Phase 4: OCR Meter Reading
  scanMeterOcr: (data: { meterId?: string; imageBase64OrUrl: string; meterType: 'ELECTRICITY' | 'WATER'; previousReading: number; manualReadingOverride?: number }) =>
    request<any>('/meters/ocr-scan', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  commitMeterOcr: (meterId: string, data: any) =>
    request<any>(`/meters/${meterId}/commit-ocr`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Phase 4: CRM Leads & Room Tours
  getCrmLeads: (params: string = '') => request<{ leads: any[]; funnel: any }>(`/crm/leads?${params}`),
  createCrmLead: (data: any) =>
    request<any>('/crm/leads', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateCrmLead: (id: string, data: any) =>
    request<any>(`/crm/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  getCrmTours: (params: string = '') => request<any[]>(`/crm/tours?${params}`),
  scheduleCrmTour: (data: any) =>
    request<any>('/crm/tours', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  completeCrmTour: (id: string, data: any) =>
    request<any>(`/crm/tours/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  convertCrmLead: (id: string, data: any) =>
    request<any>(`/crm/leads/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Phase 4: Multi-Building Consolidated Financial P&L
  getConsolidatedPnL: (periodMonth?: string) =>
    request<any>(`/finance/pnl/consolidated${periodMonth ? '?periodMonth=' + periodMonth : ''}`),
  getExpenses: (params: string = '') => request<any[]>(`/finance/expenses?${params}`),
  createExpense: (data: any) =>
    request<any>('/finance/expenses', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Phase 5: Provider Reviews & Ratings
  submitProviderReview: (data: any) =>
    request<any>('/reviews', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getPendingReviews: () => request<any[]>('/reviews/pending'),
  getProviderReputation: (providerId: string) => request<any>(`/reviews/provider/${providerId}`),
  getReviewByRequestId: (requestId: string) => request<any>(`/reviews/request/${requestId}`),

  // Phase 5: Resident PWA & Web Push
  subscribePushNotification: (data: any) =>
    request<any>('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  unsubscribePushNotification: (data: any) =>
    request<any>('/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getPushStatus: () => request<{ subscribed: boolean; count: number }>('/push/status'),
  testPushNotification: (data: any) =>
    request<any>('/push/test', {
      method: 'POST',
      body: JSON.stringify(data)
    })
};
