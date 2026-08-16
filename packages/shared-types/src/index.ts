export type Role = 'CITIZEN' | 'DEPARTMENT_STAFF' | 'DEPARTMENT_ADMIN' | 'SUPER_ADMIN';

export type ReportStatus =
  | 'PENDING'
  | 'IN_REVIEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_INFORMATION'
  | 'RESOLVED'
  | 'REJECTED'
  | 'DUPLICATE';

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

export interface InstitutionDto {
  id: string;
  name: string;
  slug: string;
  type: string;
  contact: string | null;
  active: boolean;
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
  /** Present when authenticated viewer context is available */
  votedByMe?: boolean;
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

export interface AnalyticsByDepartmentItem {
  departmentId: string | null;
  department: string;
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
