export const ADMIN_DATA_RESOURCES = [
  'users',
  'reports',
  'institutions',
  'departments',
  'categories',
  'subcategories',
  'zones',
  'routing-rules',
  'sla-policies',
  'audit-logs',
  'status-history',
] as const;

export type AdminDataResource = (typeof ADMIN_DATA_RESOURCES)[number];

export const ADMIN_DATA_BLOCKED_RESOURCES = [
  'auth-tokens',
  'refresh-tokens',
  'trusted-devices',
  'oauth-pendings',
  'sequence-counters',
] as const;

export type AdminDataBlockedResource = (typeof ADMIN_DATA_BLOCKED_RESOURCES)[number];

export type AdminDataCell = string | number | boolean | null;

export type AdminDataRow = Record<string, AdminDataCell | unknown>;

export interface AdminDataPage {
  resource: AdminDataResource;
  data: AdminDataRow[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SlaPolicyDto {
  id: string;
  name: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  responseTime: number;
  resolutionTime: number;
  departmentId: string | null;
  departmentName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  /** Derived: global | department | category | subcategory */
  scope: 'global' | 'department' | 'category' | 'subcategory';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSlaPolicyRequest {
  name: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  responseTime: number;
  resolutionTime: number;
  departmentId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  active?: boolean;
}
