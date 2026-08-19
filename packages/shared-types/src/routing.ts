import type { Priority } from './index';

export type RouteInput = {
  categoryId?: string | null;
  subcategory?: string | null;
  severity?: Priority | null;
  zone?: string | null;
  isEmergency?: boolean | null;
};

export interface RoutingRuleDto {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  subcategory: string | null;
  severity: Priority | null;
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
  contact?: string | null;
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
  subcategory?: string | null;
  severity?: Priority | null;
  zone?: string | null;
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
