import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MailService } from './mail.service';
import { ConfigService } from '../auth/config.service';

// No RESEND_API_KEY/SMTP configured => MailService falls back to logging the
// payload via `logger.warn`, which gives us a black-box way to assert on the
// subject/text/html it built without reaching into private methods.
function makeConfig(): ConfigService {
  return {
    resendApiKey: '',
    smtpHost: '',
    mailFrom: 'Prizren Smart City <onboarding@resend.dev>',
  } as unknown as ConfigService;
}

describe('MailService — status-changed outcome templates', () => {
  let mail: MailService;
  let warnSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mail = new MailService(makeConfig());
    warnSpy = vi.fn();
    // @ts-expect-error — overriding the private logger instance for assertions
    mail['logger'] = { warn: warnSpy, error: vi.fn() };
  });

  function lastWarnText(): string {
    expect(warnSpy).toHaveBeenCalledTimes(1);
    return warnSpy.mock.calls[0][0] as string;
  }

  it('sends a dedicated "resolved" outcome email, including the staff note', async () => {
    await mail.sendReportStatusChangedEmail('citizen@test.local', {
      oldStatus: 'ASSIGNED',
      newStatus: 'RESOLVED',
      reportUrl: 'https://app.local/reports/1',
      note: 'Fixed the pothole.',
    });
    const logged = lastWarnText();
    expect(logged).toContain('Raporti yt u zgjidh');
    expect(logged).toContain('Fixed the pothole.');
    expect(logged).toContain('https://app.local/reports/1');
  });

  it('sends a dedicated "assigned" outcome email', async () => {
    await mail.sendReportStatusChangedEmail('citizen@test.local', {
      oldStatus: 'UNDER_REVIEW',
      newStatus: 'ASSIGNED',
      reportUrl: 'https://app.local/reports/2',
    });
    expect(lastWarnText()).toContain('hyri në radhën e institucionit');
  });

  it('sends a dedicated "rejected" outcome email', async () => {
    await mail.sendReportStatusChangedEmail('citizen@test.local', {
      oldStatus: 'UNDER_REVIEW',
      newStatus: 'REJECTED',
      reportUrl: 'https://app.local/reports/3',
      note: 'Out of scope.',
    });
    const logged = lastWarnText();
    expect(logged).toContain('Përditësim për raportin');
    expect(logged).toContain('Out of scope.');
  });

  it('falls back to the generic transition email for non-outcome statuses', async () => {
    await mail.sendReportStatusChangedEmail('citizen@test.local', {
      oldStatus: 'SUBMITTED',
      newStatus: 'UNDER_REVIEW',
      reportUrl: 'https://app.local/reports/4',
    });
    const logged = lastWarnText();
    expect(logged).toContain('Statusi i raportit u ndryshua');
    expect(logged).toContain('Dërguar');
    expect(logged).toContain('Në shqyrtim');
  });

  it('labels WAITING_FOR_INFORMATION and DUPLICATE instead of leaking raw enum values', async () => {
    await mail.sendReportStatusChangedEmail('citizen@test.local', {
      oldStatus: 'DUPLICATE',
      newStatus: 'WAITING_FOR_INFORMATION',
      reportUrl: 'https://app.local/reports/5',
    });
    const logged = lastWarnText();
    expect(logged).not.toContain('WAITING_FOR_INFORMATION');
    expect(logged).not.toContain('DUPLICATE');
    expect(logged).toContain('Në pritje të informacionit');
    expect(logged).toContain('Kopje e një raporti ekzistues');
  });

  it('builds an institutional notice without citizen identity', async () => {
    await mail.sendInstitutionalNewCase({
      to: 'info@keds-energy.com',
      publicId: 'PRZ-2026-000042',
      description: 'Broken lamp',
      categoryName: 'Ndriçim publik i prishur',
      priority: 'HIGH',
      address: 'Shadërvan',
      lat: 42.21,
      lng: 20.74,
      createdAt: new Date('2026-08-22T10:00:00.000Z'),
      dueAt: null,
      photoUrl: null,
      reportUrl: 'https://app.local/reports/uuid',
      institutionName: 'KEDS',
    });
    const logged = lastWarnText();
    expect(logged).toContain('Raport i ri PRZ-2026-000042');
    expect(logged).toContain('info@keds-energy.com');
    expect(logged).toContain('Ndriçim publik i prishur');
    expect(logged).not.toContain('citizen@');
    expect(logged).not.toContain('qytetar@');
  });
});
