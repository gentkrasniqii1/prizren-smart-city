import type { OutboundEmailSkipReason } from '@prizren/shared-types';

export const EMAIL_INTEGRATION_TYPE = 'EMAIL';
export const SENDABLE_INTEGRATION_STATUSES = ['TEST', 'ACTIVE'] as const;

export type InstitutionMailFacts = {
  contact: string | null;
  integrationType: string;
  integrationStatus: string;
};

export type MailPolicyDecision =
  { send: true; recipient: string } | { send: false; skipReason: OutboundEmailSkipReason };

/**
 * Fail closed. Does not invent mailboxes. Flag must be the boolean already
 * parsed from INSTITUTIONAL_MAIL_ENABLED === 'true'.
 */
export function evaluateInstitutionalMailPolicy(input: {
  enabled: boolean;
  providerConfigured: boolean;
  institution: InstitutionMailFacts | null;
}): MailPolicyDecision {
  if (!input.enabled) {
    return { send: false, skipReason: 'FLAG_OFF' };
  }
  if (!input.institution) {
    return { send: false, skipReason: 'NO_INSTITUTION' };
  }

  const recipient = input.institution.contact?.trim() ?? '';
  if (!recipient) {
    return { send: false, skipReason: 'NO_CONTACT' };
  }
  if (input.institution.integrationType !== EMAIL_INTEGRATION_TYPE) {
    return { send: false, skipReason: 'INTEGRATION_TYPE' };
  }
  if (
    !SENDABLE_INTEGRATION_STATUSES.includes(
      input.institution.integrationStatus as (typeof SENDABLE_INTEGRATION_STATUSES)[number],
    )
  ) {
    return { send: false, skipReason: 'INTEGRATION_STATUS' };
  }
  if (!input.providerConfigured) {
    return { send: false, skipReason: 'NO_PROVIDER' };
  }

  return { send: true, recipient };
}
