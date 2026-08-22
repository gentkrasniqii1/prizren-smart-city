import { describe, expect, it } from 'vitest';
import { omitLogNotes, sanitizeLogValue } from './sanitize-log';

describe('sanitizeLogValue', () => {
  it('redacts secret-bearing keys and JWT-shaped strings', () => {
    const cleaned = sanitizeLogValue({
      action: 'report.create',
      reportId: 'r1',
      authorization: 'Bearer abc',
      jwt: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.sig',
      accessToken: 'secret-token',
      raw: 'plain-token-value',
      resendApiKey: 're_live_xxx',
      smtpPass: 'hunter2',
      nested: { token: 'still-secret', publicId: 'PRZ-2026-000001' },
    });

    expect(cleaned).toEqual({
      action: 'report.create',
      reportId: 'r1',
      authorization: '[redacted]',
      jwt: '[redacted]',
      accessToken: '[redacted]',
      raw: '[redacted]',
      resendApiKey: '[redacted]',
      smtpPass: '[redacted]',
      nested: { token: '[redacted]', publicId: 'PRZ-2026-000001' },
    });
  });

  it('leaves civic identifiers and statuses intact', () => {
    expect(
      sanitizeLogValue({
        event: 'report.queue_enter',
        publicId: 'PRZ-2026-000042',
        status: 'ASSIGNED',
        institutionId: 'inst-1',
      }),
    ).toEqual({
      event: 'report.queue_enter',
      publicId: 'PRZ-2026-000042',
      status: 'ASSIGNED',
      institutionId: 'inst-1',
    });
  });

  it('drops note fields from process-log metadata only', () => {
    expect(omitLogNotes({ note: 'site visit', publicId: 'PRZ-1', jwt: 'secret' })).toEqual({
      publicId: 'PRZ-1',
      jwt: '[redacted]',
    });
  });
});
