import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MailService } from './mail.service';
import { ConfigService } from '../auth/config.service';

function makeConfig(): ConfigService {
  return {
    resendApiKey: '',
    smtpHost: '',
    mailFrom: 'Prizren Smart City <onboarding@resend.dev>',
    webOrigin: 'http://localhost:3000',
  } as unknown as ConfigService;
}

describe('MailService — status-changed outcome templates', () => {
  let mail: MailService;
  let sendSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mail = new MailService(makeConfig());
    sendSpy = vi
      .spyOn(mail as unknown as { send: (payload: unknown) => Promise<unknown> }, 'send')
      .mockResolvedValue({ provider: 'console' });
  });

  function lastPayload(): { to: string; subject: string; text: string; html: string } {
    expect(sendSpy).toHaveBeenCalledTimes(1);
    return sendSpy.mock.calls[0][0] as {
      to: string;
      subject: string;
      text: string;
      html: string;
    };
  }

  it('sends a dedicated "resolved" outcome email, including the staff note', async () => {
    await mail.sendReportStatusChangedEmail('citizen@test.local', {
      oldStatus: 'ASSIGNED',
      newStatus: 'RESOLVED',
      reportUrl: 'https://app.local/reports/1',
      note: 'Fixed the pothole.',
    });
    const payload = lastPayload();
    expect(payload.subject).toContain('Raporti yt u zgjidh');
    expect(payload.text).toContain('Fixed the pothole.');
    expect(payload.text).toContain('https://app.local/reports/1');
  });

  it('sends a dedicated "assigned" outcome email', async () => {
    await mail.sendReportStatusChangedEmail('citizen@test.local', {
      oldStatus: 'UNDER_REVIEW',
      newStatus: 'ASSIGNED',
      reportUrl: 'https://app.local/reports/2',
    });
    expect(lastPayload().subject).toContain('hyri në radhën e institucionit');
  });

  it('sends a dedicated "rejected" outcome email', async () => {
    await mail.sendReportStatusChangedEmail('citizen@test.local', {
      oldStatus: 'UNDER_REVIEW',
      newStatus: 'REJECTED',
      reportUrl: 'https://app.local/reports/3',
      note: 'Out of scope.',
    });
    const payload = lastPayload();
    expect(payload.subject).toContain('Përditësim për raportin');
    expect(payload.text).toContain('Out of scope.');
  });

  it('falls back to the generic transition email for non-outcome statuses', async () => {
    await mail.sendReportStatusChangedEmail('citizen@test.local', {
      oldStatus: 'SUBMITTED',
      newStatus: 'UNDER_REVIEW',
      reportUrl: 'https://app.local/reports/4',
    });
    const payload = lastPayload();
    expect(payload.subject).toContain('Statusi i raportit u ndryshua');
    expect(payload.text).toContain('Dërguar');
    expect(payload.text).toContain('Në shqyrtim');
  });

  it('labels WAITING_FOR_INFORMATION and DUPLICATE instead of leaking raw enum values', async () => {
    await mail.sendReportStatusChangedEmail('citizen@test.local', {
      oldStatus: 'DUPLICATE',
      newStatus: 'WAITING_FOR_INFORMATION',
      reportUrl: 'https://app.local/reports/5',
    });
    const payload = lastPayload();
    expect(payload.text).not.toContain('WAITING_FOR_INFORMATION');
    expect(payload.text).not.toContain('DUPLICATE');
    expect(payload.text).toContain('Në pritje të informacionit');
    expect(payload.text).toContain('Kopje e një raporti ekzistues');
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
      reportUrl: 'https://app.local/institution/reports/secure-token-example',
      institutionName: 'KEDS',
    });
    const payload = lastPayload();
    expect(payload.to).toBe('info@keds-energy.com');
    expect(payload.subject).toContain('Raport i ri PRZ-2026-000042');
    expect(payload.text).toContain('Ndriçim publik i prishur');
    expect(payload.text).not.toContain('citizen@');
    expect(payload.text).not.toContain('qytetar@');
    expect(payload.text).toContain('/institution/reports/');
    expect(payload.text).not.toMatch(/\/reports\/[0-9a-f-]{36}/i);
  });
  it('includes branding chrome and home link in shared layout', async () => {
    await mail.sendReportReceivedEmail('citizen@test.local', {
      reportId: 'r1',
      description: 'Broken lamp',
      reportUrl: 'https://app.local/reports/1',
    });
    const payload = lastPayload();
    expect(payload.html).toContain('PRIZREN');
    expect(payload.html).toContain('Smart City');
    expect(payload.html).toContain('viewport');
    expect(payload.html).toContain('http://localhost:3000');
    expect(payload.html).toContain('/icons/icon-192.png');
    expect(payload.html).toContain('mesazh i automatizuar');
  });

  it('adds a password-reset CTA on suspicious-login emails', async () => {
    await mail.sendSuspiciousLoginEmail('citizen@test.local', {
      ip: '8.8.8.8',
      userAgent: 'vitest',
      resetUrl: 'http://localhost:3000/reset-password?token=abc',
    });
    const payload = lastPayload();
    expect(payload.html).toContain('Ndrysho fjalëkalimin');
    expect(payload.html).toContain('/reset-password?token=abc');
    expect(payload.text).toContain('/reset-password?token=abc');
  });
});

describe('MailService — console fallback logs', () => {
  it('does not log recipient, body, or token URLs', async () => {
    const mail = new MailService(makeConfig());
    const warnSpy = vi.fn();
    // @ts-expect-error — override private logger
    mail['logger'] = { warn: warnSpy, error: vi.fn() };

    await mail.sendReportStatusChangedEmail('citizen@test.local', {
      oldStatus: 'ASSIGNED',
      newStatus: 'RESOLVED',
      reportUrl: 'https://app.local/reports/1?token=eyJhbGciOiJub25lIn0.aaa.bbb',
      note: 'Fixed the pothole.',
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = warnSpy.mock.calls[0][0] as string;
    expect(logged).toContain('mail.console');
    expect(logged).not.toContain('citizen@test.local');
    expect(logged).not.toContain('Fixed the pothole');
    expect(logged).not.toContain('eyJ');
    expect(logged).not.toContain('/reports/1');
  });
});
