export type Role = 'CITIZEN' | 'DEPARTMENT_STAFF' | 'DEPARTMENT_ADMIN' | 'SUPER_ADMIN';

export type { ReportStatus } from './report-status';
import type { ReportStatus } from './report-status';
import type { WorkflowAction } from './workflow';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AICategory = 'road_damage' | 'lighting' | 'waste' | 'water' | 'public_space' | 'other';

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
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  role: Role;
  emailVerified: boolean;
  totpEnabled: boolean;
  /** false for accounts created via Google/Apple/Facebook that never set a password. */
  hasPassword: boolean;
  /** true if a Google account is linked (via direct OAuth signup or auto-linking). */
  googleLinked: boolean;
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
  firstName: string;
  lastName: string;
  phone?: string;
  acceptedTerms: boolean;
  /** Honeypot — leave empty */
  website?: string;
}

export interface RegisterResponse {
  ok: true;
  email: string;
  requiresEmailVerification: true;
  /** Present only in development when SMTP is not configured. */
  devVerifyToken?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
  /** Honeypot — leave empty */
  website?: string;
}

export interface TwoFactorRequiredResponse {
  requiresTwoFactor: true;
  challengeToken: string;
}

export type LoginResponse = AuthResponse | TwoFactorRequiredResponse;

export interface OAuthProvidersStatus {
  google: boolean;
  apple: boolean;
  facebook: boolean;
}

export interface ForgotPasswordRequest {
  email: string;
  website?: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface TwoFactorVerifyRequest {
  challengeToken: string;
  code: string;
  trustDevice?: boolean;
}

export type IntegrationType = 'EMAIL' | 'REST_API' | 'WEBHOOK' | 'SFTP' | 'MANUAL' | 'MOCK';

export type IntegrationStatus = 'NOT_CONFIGURED' | 'MOCK' | 'TEST' | 'ACTIVE' | 'DISABLED';

export interface InstitutionDto {
  id: string;
  name: string;
  slug: string;
  type: string;
  contact: string | null;
  active: boolean;
  /** How incidents are exchanged with this organization — MANUAL until an adapter is configured. */
  integrationType: IntegrationType;
  /** Integration lifecycle — NOT_CONFIGURED until Phase 7/8 wiring. */
  integrationStatus: IntegrationStatus;
}

export interface DepartmentDto {
  id: string;
  name: string;
  contact: string | null;
  slaHours?: number;
  institutionId?: string | null;
  institutionName?: string | null;
}

export interface ReportDto {
  id: string;
  /** Human-readable incident code, e.g. "PRZ-2026-000184". */
  publicId: string;
  userId?: string;
  categoryId: string | null;
  subcategory: string | null;
  departmentId: string | null;
  /** Responsible external organization, distinct from the internal department. */
  institutionId: string | null;
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
  isDuplicate: boolean;
  assignedStaffId: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  categoryName?: string | null;
  departmentName?: string | null;
  institutionName?: string | null;
  voteCount?: number;
  /** Present when authenticated viewer context is available */
  votedByMe?: boolean;
  /** Status trail — present on GET /reports/:id */
  history?: StatusHistoryDto[];
  /** Next institution-desk actions for staff viewers */
  allowedActions?: WorkflowAction[];
  /** Last staff note recorded with a status change */
  latestNote?: string | null;
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
  slaHours: number;
  defaultPriority: Priority;
  institutionId?: string | null;
  institutionName?: string | null;
}

export interface StatusHistoryDto {
  id: string;
  oldStatus: ReportStatus;
  newStatus: ReportStatus;
  changedAt: string;
  note: string | null;
}

export interface UpdateReportStatusRequest {
  status: ReportStatus;
  note?: string;
}

export interface WorkflowActionRequest {
  action: WorkflowAction;
  note?: string;
}

export interface UpdateReportPriorityRequest {
  priority: Priority;
  note?: string;
}

export interface EscalateReportRequest {
  note?: string;
}

export interface AddReportNoteRequest {
  note: string;
}

export interface UpdateAiClassificationRequest {
  action: 'accept' | 'edit';
  category?: AICategory;
  severity?: AISeverity;
  confidence?: number;
  summary?: string;
  recommendedDepartment?: string;
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
  /** Reports created since local midnight. */
  newToday: number;
  /** Open reports with CRITICAL priority. */
  critical: number;
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

export interface AnalyticsByDepartmentItem {
  departmentId: string | null;
  department: string;
  count: number;
}

export interface AnalyticsByInstitutionItem {
  institutionId: string | null;
  institution: string;
  count: number;
}

export interface AnalyticsOverTimeItem {
  date: string;
  count: number;
}

export interface MyReportStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
}

export interface AssignReportRequest {
  departmentId?: string | null;
  assignedStaffId?: string | null;
  institutionId?: string | null;
}

export interface AnalyticsSla {
  overdue: number;
  dueSoon: number;
  onTime: number;
}

export type SlaBucket = 'overdue' | 'due_soon' | 'on_time';

export interface VoteCountResponse {
  voteCount: number;
  votedByMe: boolean;
}

export interface CommentDto {
  id: string;
  reportId: string;
  text: string;
  authorName: string;
  createdAt: string;
}

export interface CreateCommentRequest {
  text: string;
}

export interface PaginatedComments {
  data: CommentDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface NotificationDto {
  id: string;
  reportId: string | null;
  type: string;
  channel: string;
  read: boolean;
  createdAt: string;
  message?: string;
}

export interface PaginatedNotifications {
  data: NotificationDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    unreadCount: number;
  };
}

export interface TransparencyStats {
  total: number;
  resolved: number;
  pendingOpen: number;
  rejected: number;
  resolutionRate: number | null;
  byStatus: AnalyticsByStatusItem[];
  byCategory: AnalyticsByCategoryItem[];
  avgResolutionHours: number | null;
}

export type { QueueLane, WorkflowAction } from './workflow';
export {
  ALLOWED_STATUS_TRANSITIONS,
  allowedWorkflowActions,
  canTransitionStatus,
  CITIZEN_PIPELINE,
  notificationTypeForStatus,
  QUEUE_LANE_STATUSES,
  WORKFLOW_ACTION_TARGET,
  WORKFLOW_ACTIONS,
  WORKFLOW_ACTIONS_REQUIRING_NOTE,
} from './workflow';
export type {
  RouteInput,
  RoutePreview,
  RoutingRuleDto,
  UpsertCategoryRequest,
  UpsertDepartmentRequest,
  UpsertInstitutionRequest,
  UpsertRoutingRuleRequest,
} from './routing';
