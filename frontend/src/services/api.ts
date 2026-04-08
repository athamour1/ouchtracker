/**
 * Typed API service layer — thin wrappers around the axios instance.
 */
import { api } from 'src/boot/axios';

// ── Types ────────────────────────────────────────────────────────────────────

export type Role = 'ADMIN' | 'CHECKER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  locale: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string | null;
  user: User;
}

export interface KitItem {
  id: string;
  kitId: string;
  name: string;
  category?: string;
  unit?: string;
  quantity: number;
  locationInKit?: string;
  expirationDate?: string | null;
  notes?: string;
  isValid: boolean;   // virtual — computed by backend
  createdAt: string;
  updatedAt: string;
}

export interface Kit {
  id: string;
  name: string;
  description?: string;
  location?: string;
  isActive: boolean;
  assignees: Pick<User, 'id' | 'fullName' | 'email'>[];
  kitItems: KitItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InspectionLogItem {
  id: string;
  kitItemId: string;
  kitItem: KitItem;
  quantityFound: number;
  expirationDateFound?: string | null;
  notes?: string;
}

export interface InspectionLog {
  id: string;
  kitId: string;
  kit: Pick<Kit, 'id' | 'name'>;
  inspectedById: string;
  inspectedBy: Pick<User, 'id' | 'fullName' | 'email'>;
  notes?: string;
  items: InspectionLogItem[];
  createdAt: string;
}

export interface AlertSummary {
  totalKits: number;
  totalItems: number;
  expiredCount: number;
  expiringSoonCount: number;
  recentInspections: InspectionLog[];
}

export interface ExpiringItem extends KitItem {
  isExpired: boolean;
  daysUntilExpiry: number;
  kit: Pick<Kit, 'id' | 'name'>;
}

export interface IncidentReportItem {
  id: string;
  quantityUsed: number;
  notes?: string;
  kitItemId: string;
  kitItem: Pick<KitItem, 'id' | 'name' | 'category' | 'unit'>;
}

export interface IncidentReport {
  id: string;
  kitId: string;
  kit: Pick<Kit, 'id' | 'name'>;
  reportedById: string;
  reportedBy: Pick<User, 'id' | 'fullName' | 'email'>;
  description?: string;
  items: IncidentReportItem[];
  createdAt: string;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string, stayLoggedIn: boolean) =>
    api.post<LoginResponse>('/auth/login', { email, password, stayLoggedIn }),
  refresh: (userId: string, refreshToken: string) =>
    api.post<LoginResponse>('/auth/refresh', { userId, refreshToken }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get<User>('/auth/me'),
};

// ── Users ────────────────────────────────────────────────────────────────────

export const usersApi = {
  list: () => api.get<User[]>('/users'),
  get: (id: string) => api.get<User>(`/users/${id}`),
  create: (data: { email: string; password: string; fullName: string; role?: Role }) =>
    api.post<User>('/users', data),
  update: (id: string, data: Partial<Pick<User, 'fullName' | 'role' | 'isActive'>> & { password?: string }) =>
    api.patch<User>(`/users/${id}`, data),
  remove: (id: string) => api.delete<User>(`/users/${id}`),
  updateProfile: (data: { fullName?: string; email?: string; locale?: string; currentPassword?: string; newPassword?: string }) =>
    api.patch<User>('/users/me', data),
};

// ── Kits ─────────────────────────────────────────────────────────────────────

export const kitsApi = {
  list: () => api.get<Kit[]>('/kits'),
  myKits: () => api.get<Kit[]>('/kits/my'),
  get: (id: string) => api.get<Kit>(`/kits/${id}`),
  create: (data: Pick<Kit, 'name'> & { description?: string; location?: string }) =>
    api.post<Kit>('/kits', data),
  update: (id: string, data: Partial<Pick<Kit, 'name' | 'description' | 'location' | 'isActive'>>) =>
    api.patch<Kit>(`/kits/${id}`, data),
  remove: (id: string) => api.delete(`/kits/${id}`),
  assign: (id: string, userIds: string[]) =>
    api.patch<Kit>(`/kits/${id}/assign`, { userIds }),
  addItem: (kitId: string, data: {
    name: string; category?: string; unit?: string;
    quantity: number; locationInKit?: string; expirationDate?: string; notes?: string;
  }) => api.post<KitItem>(`/kits/${kitId}/items`, data),
  updateItem: (kitId: string, itemId: string, data: {
    name?: string; category?: string; unit?: string;
    quantity?: number; locationInKit?: string;
    expirationDate?: string | null; notes?: string;
  }) => api.patch<KitItem>(`/kits/${kitId}/items/${itemId}`, data),
  removeItem: (kitId: string, itemId: string) =>
    api.delete(`/kits/${kitId}/items/${itemId}`),
};

// ── Inspections ───────────────────────────────────────────────────────────────

export const inspectionsApi = {
  list: (kitId?: string) =>
    api.get<InspectionLog[]>('/inspections', { params: kitId ? { kitId } : undefined }),
  get: (id: string) => api.get<InspectionLog>(`/inspections/${id}`),
  submit: (data: {
    kitId: string;
    notes?: string;
    items: { kitItemId: string; quantityFound: number; expirationDateFound?: string | null; notes?: string }[];
  }) => api.post<InspectionLog>('/inspections', data),
};

// ── Incidents ─────────────────────────────────────────────────────────────────

export const incidentsApi = {
  list: (kitId?: string) =>
    api.get<IncidentReport[]>('/incidents', { params: kitId ? { kitId } : undefined }),
  submit: (data: {
    kitId: string;
    description?: string;
    items: { kitItemId: string; quantityUsed: number; notes?: string }[];
  }) => api.post<IncidentReport>('/incidents', data),
};

// ── Alerts ────────────────────────────────────────────────────────────────────

export const alertsApi = {
  summary: () => api.get<AlertSummary>('/alerts/summary'),
  expiring: (days = 30) => api.get<ExpiringItem[]>('/alerts/expiring', { params: { days } }),
};
