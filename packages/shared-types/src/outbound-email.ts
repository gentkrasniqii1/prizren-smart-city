export const OUTBOUND_EMAIL_PURPOSES = ['INSTITUTION_NEW_CASE'] as const;
export type OutboundEmailPurpose = (typeof OUTBOUND_EMAIL_PURPOSES)[number];

export const OUTBOUND_EMAIL_STATUSES = [
  'NOT_CONFIGURED',
  'QUEUED',
  'SENDING',
  'SENT',
  'ACCEPTED',
  'FAILED',
  'RETRYING',
  'PERMANENTLY_FAILED',
] as const;
export type OutboundEmailStatus = (typeof OUTBOUND_EMAIL_STATUSES)[number];

export const OUTBOUND_EMAIL_SKIP_REASONS = [
  'FLAG_OFF',
  'NO_INSTITUTION',
  'NO_CONTACT',
  'INTEGRATION_TYPE',
  'INTEGRATION_STATUS',
  'NO_PROVIDER',
] as const;
export type OutboundEmailSkipReason = (typeof OUTBOUND_EMAIL_SKIP_REASONS)[number];

export interface OutboundEmailDto {
  id: string;
  reportId: string;
  publicId: string;
  institutionId: string | null;
  institutionName: string | null;
  purpose: OutboundEmailPurpose;
  recipient: string | null;
  subject: string;
  provider: string | null;
  providerMessageId: string | null;
  status: OutboundEmailStatus;
  skipReason: OutboundEmailSkipReason | string | null;
  attemptCount: number;
  maxAttempts: number;
  lastError: string | null;
  queuedAt: string;
  sentAt: string | null;
  failedAt: string | null;
  nextRetryAt: string | null;
  createdAt: string;
  updatedAt: string;
  accessTokenId: string | null;
  accessTokenExpiresAt: string | null;
  accessTokenRevokedAt: string | null;
}

export interface PaginatedOutboundEmails {
  data: OutboundEmailDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    /** Mirrors INSTITUTIONAL_MAIL_ENABLED === 'true'. */
    enabled: boolean;
  };
}
