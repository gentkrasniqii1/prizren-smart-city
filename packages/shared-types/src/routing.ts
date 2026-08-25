import type { Priority } from './index';

export type RouteInput = {
  categoryId?: string | null;
  subcategoryId?: string | null;
  subcategory?: string | null;
  severity?: Priority | null;
  zoneId?: string | null;
  zone?: string | null;
  isEmergency?: boolean | null;
};

export interface RoutingRuleDto {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategory: string | null;
  severity: Priority | null;
  zoneId: string | null;
  zone: string | null;
  isEmergency: boolean | null;
  departmentId: string | null;
  departmentName: string | null;
  institutionId: string | null;
  institutionName: string | null;
  /** Lower number wins when several rules match. */
  priority: number;
  slaHours: number | null;
  defaultPriority: Priority | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertInstitutionRequest {
  name: string;
  slug?: string;
  type: string;
  phone?: string | null;
  contact?: string | null;
  /** Defaults to MANUAL when omitted on create. */
  integrationType?: 'EMAIL' | 'REST_API' | 'WEBHOOK' | 'SFTP' | 'MANUAL' | 'MOCK';
  /** Defaults to NOT_CONFIGURED when omitted on create — never auto-ACTIVE. */
  integrationStatus?: 'NOT_CONFIGURED' | 'MOCK' | 'TEST' | 'ACTIVE' | 'DISABLED';
  active?: boolean;
}

export interface UpsertDepartmentRequest {
  name: string;
  contact?: string | null;
  slaHours?: number;
  institutionId?: string | null;
}

export interface UpsertCategoryRequest {
  name: string;
  departmentId: string;
  slaHours?: number;
  defaultPriority?: Priority;
}

export interface UpsertRoutingRuleRequest {
  name: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  /**
   * Legacy free-text — rejected on new writes without subcategoryId.
   * Existing historical rows may still store a string for matcher fallback.
   */
  subcategory?: string | null;
  severity?: Priority | null;
  zoneId?: string | null;
  /**
   * Legacy free-text — rejected on new writes without zoneId.
   */
  zone?: string | null;
  /** null = wildcard; true/false = exact. Never coerce null to false. */
  isEmergency?: boolean | null;
  departmentId?: string | null;
  institutionId?: string | null;
  priority?: number;
  slaHours?: number | null;
  defaultPriority?: Priority | null;
  active?: boolean;
}

export interface RoutePreview {
  categoryId: string;
  categoryName: string;
  departmentId: string | null;
  departmentName: string | null;
  institutionId: string | null;
  institutionName: string | null;
  slaHours: number;
  defaultPriority: Priority;
  matchedRuleId: string | null;
  matchedRuleName: string | null;
  source: 'rule' | 'category_fallback' | 'unrouted';
}

export interface ZoneDto {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertZoneRequest {
  name: string;
  active?: boolean;
}
