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

export interface AuthTokensResponse {
  accessToken: string;
}

export interface AuthResponse extends AuthTokensResponse {
  user: PublicUser;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ReportDto {
  id: string;
  userId?: string;
  categoryId: string | null;
  departmentId: string | null;
  description: string;
  status: ReportStatus;
  priority: Priority | null;
  lat: number;
  lng: number;
  address: string | null;
  photoUrl: string | null;
  photoAfterUrl: string | null;
  aiClassification: AIClassification | null;
  aiConfidence: number | null;
  /** true when confidence < 0.6; null when no AI result */
  aiNeedsReview?: boolean | null;
  duplicateOfId: string | null;
  assignedStaffId: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  categoryName?: string | null;
  departmentName?: string | null;
  voteCount?: number;
}

export interface PaginatedReports {
  data: ReportDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CategoryDto {
  id: string;
  name: string;
  departmentId: string;
  departmentName: string;
}

export interface UpdateReportStatusRequest {
  status: ReportStatus;
  note?: string;
}

export interface UpdateAiClassificationRequest {
  action: 'accept' | 'edit';
  category?: AICategory;
  severity?: AISeverity;
  confidence?: number;
  summary?: string;
  recommendedDepartment?: string;
}

export interface DepartmentDto {
  id: string;
  name: string;
  contact: string | null;
}

export interface AnalyticsSummary {
  total: number;
  pending: number;
  resolved: number;
  rejected: number;
  inReview: number;
  assigned: number;
  inProgress: number;
  avgResolutionHours: number | null;
}

export interface AnalyticsByCategoryItem {
  categoryId: string | null;
  category: string;
  count: number;
}

export interface AnalyticsByStatusItem {
  status: ReportStatus;
  count: number;
}

export interface AssignReportRequest {
  departmentId?: string | null;
  assignedStaffId?: string | null;
}

export interface AnalyticsSla {
  overdue: number;
  dueSoon: number;
  onTime: number;
}

export type SlaBucket = 'overdue' | 'due_soon' | 'on_time';
