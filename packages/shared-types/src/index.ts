export type Role = 'CITIZEN' | 'DEPARTMENT_STAFF' | 'DEPARTMENT_ADMIN' | 'SUPER_ADMIN';

export type ReportStatus =
  | 'PENDING'
  | 'IN_REVIEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'REJECTED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AICategory =
  | 'road_damage'
  | 'lighting'
  | 'waste'
  | 'water'
  | 'public_space'
  | 'other';

export type AISeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AIClassification {
  category: AICategory;
  severity: AISeverity;
  confidence: number;
  summary: string;
  recommendedDepartment: string;
}

export interface HealthResponse {
  status: 'ok';
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}
