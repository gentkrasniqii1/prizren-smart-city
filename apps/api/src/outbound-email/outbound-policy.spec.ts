import { describe, expect, it } from 'vitest';
import { evaluateInstitutionalMailPolicy } from './outbound-policy';

const kedsSeed = {
  contact: 'info@keds-energy.com',
  integrationType: 'MANUAL',
  integrationStatus: 'NOT_CONFIGURED',
};

const ready = {
  contact: 'info@keds-energy.com',
  integrationType: 'EMAIL',
  integrationStatus: 'ACTIVE',
};

describe('evaluateInstitutionalMailPolicy', () => {
  it('stays off when the feature flag is not true', () => {
    expect(
      evaluateInstitutionalMailPolicy({
        enabled: false,
        providerConfigured: true,
        institution: ready,
      }),
    ).toEqual({ send: false, skipReason: 'FLAG_OFF' });
  });

  it('does not send to a seeded KEDS contact while integration is MANUAL', () => {
    expect(
      evaluateInstitutionalMailPolicy({
        enabled: true,
        providerConfigured: true,
        institution: kedsSeed,
      }),
    ).toEqual({ send: false, skipReason: 'INTEGRATION_TYPE' });
  });

  it('does not invent a mailbox when contact is null', () => {
    expect(
      evaluateInstitutionalMailPolicy({
        enabled: true,
        providerConfigured: true,
        institution: {
          contact: null,
          integrationType: 'EMAIL',
          integrationStatus: 'ACTIVE',
        },
      }),
    ).toEqual({ send: false, skipReason: 'NO_CONTACT' });
  });

  it('requires TEST or ACTIVE integration status', () => {
    expect(
      evaluateInstitutionalMailPolicy({
        enabled: true,
        providerConfigured: true,
        institution: { ...ready, integrationStatus: 'NOT_CONFIGURED' },
      }),
    ).toEqual({ send: false, skipReason: 'INTEGRATION_STATUS' });
  });

  it('requires a mail provider before queuing a real send', () => {
    expect(
      evaluateInstitutionalMailPolicy({
        enabled: true,
        providerConfigured: false,
        institution: ready,
      }),
    ).toEqual({ send: false, skipReason: 'NO_PROVIDER' });
  });

  it('allows send only when flag, EMAIL integration, TEST/ACTIVE, contact, and provider are set', () => {
    expect(
      evaluateInstitutionalMailPolicy({
        enabled: true,
        providerConfigured: true,
        institution: ready,
      }),
    ).toEqual({ send: true, recipient: 'info@keds-energy.com' });
  });

  it('records NO_INSTITUTION when the report has no institution', () => {
    expect(
      evaluateInstitutionalMailPolicy({
        enabled: true,
        providerConfigured: true,
        institution: null,
      }),
    ).toEqual({ send: false, skipReason: 'NO_INSTITUTION' });
  });
});
