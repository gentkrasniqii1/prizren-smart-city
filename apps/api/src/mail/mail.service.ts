import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { ConfigService } from '../auth/config.service';
import { isOauthPlaceholderEmail } from '../auth/oauth-email';

/**
 * Single outbound-mail abstraction. The web app never sends mail and must never
 * see RESEND_API_KEY / SMTP_*. Production: Resend. Fallback: SMTP. Dev: log.
 */

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type SendResult = {
  provider: 'resend' | 'smtp' | 'console';
  messageId?: string;
};

/** Visual tone for the shared layout chrome (header accent / info boxes). */
type MailTone = 'default' | 'security' | 'success' | 'warning';

const BRAND = {
  navy: '#1a2b48',
  navyDeep: '#101827',
  accent: '#335f9b',
  gold: '#c09460',
  cream: '#faf8f5',
  card: '#ffffff',
  text: '#27211c',
  muted: '#7d6a55',
  border: '#e6ddd0',
  infoBg: '#f5f0e8',
  securityBg: '#fdf2e9',
  securityBorder: '#d97706',
  warningBg: '#fef2f2',
  warningBorder: '#b91c1c',
  successBg: '#ecfdf5',
  successBorder: '#059669',
} as const;

const STATUS_LABELS_SQ: Record<string, string> = {
  SUBMITTED: 'Dërguar',
  RECEIVED: 'I pranuar nga institucioni',
  UNDER_REVIEW: 'Në shqyrtim',
  ASSIGNED: 'Në radhën e institucionit',
  IN_PROGRESS: 'Në hetim',
  WAITING_FOR_INFORMATION: 'Në pritje të informacionit',
  RESOLVED: 'I zgjidhur',
  REJECTED: 'I refuzuar',
  DUPLICATE: 'Kopje e një raporti ekzistues',
};

function statusLabel(status: string): string {
  return STATUS_LABELS_SQ[status] ?? status;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend | null = null;
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    if (this.config.resendApiKey) {
      this.resend = new Resend(this.config.resendApiKey);
    } else if (this.config.smtpHost) {
      this.transporter = nodemailer.createTransport({
        host: this.config.smtpHost,
        port: this.config.smtpPort,
        secure: this.config.smtpSecure,
        auth:
          this.config.smtpUser && this.config.smtpPass
            ? { user: this.config.smtpUser, pass: this.config.smtpPass }
            : undefined,
      });
    }
  }

  get configured(): boolean {
    return Boolean(this.resend || this.transporter);
  }

  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    await this.send({
      to,
      subject: 'Konfirmo email-in — Prizren Smart City',
      text: `Konfirmo adresën tënde të email-it për të aktivizuar llogarinë:\n${verifyUrl}\n\nLidhja skadon pas 24 orësh.`,
      html: this.layout(
        'Konfirmo email-in',
        `<p style="margin:0 0 16px;line-height:1.55">Faleminderit që u regjistrove në Prizren Smart City.</p>
         <p style="margin:0 0 16px;line-height:1.55">Kliko butonin më poshtë për të konfirmuar adresën e email-it. Lidhja skadon pas 24 orësh.</p>
         ${this.ctaButton(verifyUrl, 'Konfirmo email-in')}
         <p style="margin:16px 0 0;color:${BRAND.muted};font-size:13px;line-height:1.5">Nëse nuk e krijove këtë llogari, injoro këtë mesazh.</p>`,
      ),
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.send({
      to,
      subject: 'Rikthe fjalëkalimin — Prizren Smart City',
      text: `Për të vendosur një fjalëkalim të ri, hap këtë lidhje (skadon pas 1 ore):\n${resetUrl}`,
      html: this.layout(
        'Rikthimi i fjalëkalimit',
        `<p style="margin:0 0 16px;line-height:1.55">Marrëm një kërkesë për të rikthyer fjalëkalimin e llogarisë tënde.</p>
         ${this.ctaButton(resetUrl, 'Vendos fjalëkalim të ri')}
         <p style="margin:16px 0 0;color:${BRAND.muted};font-size:13px;line-height:1.5">Nëse nuk e kërkove këtë, mund ta injorosh mesazhin. Lidhja skadon pas 1 ore.</p>`,
        'security',
      ),
    });
  }

  async sendPasswordChangedEmail(to: string): Promise<void> {
    await this.send({
      to,
      subject: 'Fjalëkalimi u ndryshua — Prizren Smart City',
      text: 'Fjalëkalimi i llogarisë tënde u ndryshua me sukses. Nëse nuk e bëre ti, na kontakto menjëherë.',
      html: this.layout(
        'Fjalëkalimi u ndryshua',
        `<p style="margin:0 0 16px;line-height:1.55">Fjalëkalimi i llogarisë tënde u ndryshua me sukses.</p>
         <p style="margin:0;line-height:1.55">Nëse nuk e bëre ti këtë ndryshim, na kontakto menjëherë.</p>`,
        'security',
      ),
    });
  }

  async sendSuspiciousLoginEmail(
    to: string,
    params: { ip: string | null; userAgent: string | null; resetUrl: string },
  ): Promise<void> {
    const ip = params.ip ?? 'i panjohur';
    const agent = params.userAgent ?? 'i panjohur';
    await this.send({
      to,
      subject: 'Hyrje e re në llogari — Prizren Smart City',
      text: `U zbulua një hyrje e re në llogarinë tënde.\nIP: ${ip}\nPajisja: ${agent}\n\nNëse nuk ishe ti, ndrysho fjalëkalimin:\n${params.resetUrl}\n\nLidhja skadon pas 1 ore.`,
      html: this.layout(
        'Hyrje e re në llogari',
        `<p style="margin:0 0 16px;line-height:1.55">U zbulua një hyrje e re në llogarinë tënde nga një adresë IP e ndryshme nga herët e fundit.</p>
         ${this.infoBox(
           `IP: ${this.escapeHtml(ip)}<br/>Pajisja: ${this.escapeHtml(agent)}`,
           'security',
         )}
         <p style="margin:16px 0;line-height:1.55">Nëse nuk ishe ti, ndrysho fjalëkalimin menjëherë dhe dil nga të gjitha pajisjet.</p>
         ${this.ctaButton(params.resetUrl, 'Ndrysho fjalëkalimin')}
         <p style="margin:16px 0 0;color:${BRAND.muted};font-size:13px;line-height:1.5">Lidhja është e njëpërdorimshme dhe skadon pas 1 ore.</p>`,
        'security',
      ),
    });
  }

  async sendAccountLockedEmail(to: string): Promise<void> {
    await this.send({
      to,
      subject: 'Llogaria u bllokua përkohësisht — Prizren Smart City',
      text: 'Llogaria jote u bllokua përkohësisht pas shumë tentativave të pasakta të hyrjes. Provo përsëri pas 15 minutash. Nëse nuk ishe ti, rikthe fjalëkalimin.',
      html: this.layout(
        'Llogaria u bllokua përkohësisht',
        `<p style="margin:0 0 16px;line-height:1.55">Llogaria jote u bllokua përkohësisht pas shumë tentativave të pasakta të hyrjes.</p>
         ${this.infoBox(
           'Provo përsëri pas 15 minutash. Nëse nuk ishe ti, përdor rikthimin e fjalëkalimit.',
           'security',
         )}`,
        'security',
      ),
    });
  }

  async sendReportReceivedEmail(
    to: string,
    params: { reportId: string; description: string; reportUrl: string },
  ): Promise<void> {
    const excerpt =
      params.description.length > 140 ? `${params.description.slice(0, 140)}…` : params.description;
    await this.send({
      to,
      subject: 'Raporti u pranua — Prizren Smart City',
      text: `Raporti yt u pranua me sukses.\n\n"${excerpt}"\n\nShiko statusin këtu:\n${params.reportUrl}`,
      html: this.layout(
        'Raporti u pranua',
        `<p style="margin:0 0 16px;line-height:1.55">Faleminderit! Raporti yt u regjistrua dhe do të shqyrtohet së shpejti.</p>
         ${this.infoBox(this.escapeHtml(excerpt))}
         ${this.ctaButton(params.reportUrl, 'Shiko raportin')}`,
      ),
    });
  }

  async sendReportStatusChangedEmail(
    to: string,
    params: { oldStatus: string; newStatus: string; reportUrl: string; note?: string },
  ): Promise<void> {
    const oldLabel = statusLabel(params.oldStatus);
    const newLabel = statusLabel(params.newStatus);
    const noteBlock = params.note
      ? this.infoBox(
          `<strong>Shënim nga stafi:</strong> ${this.escapeHtml(params.note)}`,
          params.newStatus === 'REJECTED' ? 'warning' : 'default',
        )
      : '';
    const noteText = params.note ? `\n\nShënim nga stafi: ${params.note}` : '';

    if (params.newStatus === 'RESOLVED') {
      await this.send({
        to,
        subject: 'Raporti yt u zgjidh ✅ — Prizren Smart City',
        text: `Lajm i mirë! Raporti yt u shënua si i zgjidhur.${noteText}\n\nShiko rezultatin këtu:\n${params.reportUrl}`,
        html: this.layout(
          'Raporti u zgjidh',
          `<p style="margin:0 0 16px;line-height:1.55">Lajm i mirë! Raporti yt u shënua si <strong>i zgjidhur</strong>.</p>
           ${noteBlock}
           ${this.ctaButton(params.reportUrl, 'Shiko rezultatin')}`,
          'success',
        ),
      });
      return;
    }

    if (params.newStatus === 'ASSIGNED') {
      await this.send({
        to,
        subject: 'Raporti yt hyri në radhën e institucionit — Prizren Smart City',
        text: `Raporti yt u kalua te institucioni përgjegjës dhe pret pranimin.${noteText}\n\nShiko detajet këtu:\n${params.reportUrl}`,
        html: this.layout(
          'Në radhën e institucionit',
          `<p style="margin:0 0 16px;line-height:1.55">Raporti yt u kalua te institucioni përgjegjës dhe pret pranimin.</p>
           ${noteBlock}
           ${this.ctaButton(params.reportUrl, 'Shiko raportin')}`,
        ),
      });
      return;
    }

    if (params.newStatus === 'RECEIVED') {
      await this.send({
        to,
        subject: 'Institucioni e pranoi raportin tënd — Prizren Smart City',
        text: `Institucioni përgjegjës e pranoi raportin tënd dhe do ta hetojë.${noteText}\n\nShiko detajet këtu:\n${params.reportUrl}`,
        html: this.layout(
          'Raporti u pranua',
          `<p style="margin:0 0 16px;line-height:1.55">Institucioni përgjegjës e <strong>pranoi</strong> raportin tënd dhe do ta hetojë.</p>
           ${noteBlock}
           ${this.ctaButton(params.reportUrl, 'Shiko raportin')}`,
        ),
      });
      return;
    }

    if (params.newStatus === 'IN_PROGRESS') {
      await this.send({
        to,
        subject: 'Raporti yt është në hetim — Prizren Smart City',
        text: `Institucioni po heton raportin tënd.${noteText}\n\nShiko detajet këtu:\n${params.reportUrl}`,
        html: this.layout(
          'Në hetim',
          `<p style="margin:0 0 16px;line-height:1.55">Institucioni po <strong>heton</strong> raportin tënd.</p>
           ${noteBlock}
           ${this.ctaButton(params.reportUrl, 'Shiko raportin')}`,
        ),
      });
      return;
    }

    if (params.newStatus === 'REJECTED') {
      await this.send({
        to,
        subject: 'Përditësim për raportin tënd — Prizren Smart City',
        text: `Raporti yt u shqyrtua dhe u refuzua.${noteText}\n\nShiko detajet këtu:\n${params.reportUrl}`,
        html: this.layout(
          'Raporti u refuzua',
          `<p style="margin:0 0 16px;line-height:1.55">Raporti yt u shqyrtua dhe u <strong>refuzua</strong>.</p>
           ${noteBlock}
           ${this.ctaButton(params.reportUrl, 'Shiko raportin')}`,
          'warning',
        ),
      });
      return;
    }

    await this.send({
      to,
      subject: 'Statusi i raportit u ndryshua — Prizren Smart City',
      text: `Statusi i raportit tënd ndryshoi: ${oldLabel} → ${newLabel}${noteText}\n\nShiko detajet këtu:\n${params.reportUrl}`,
      html: this.layout(
        'Statusi u përditësua',
        `<p style="margin:0 0 12px;line-height:1.55">Statusi i raportit tënd ndryshoi:</p>
         <p style="margin:0 0 16px;font-size:16px;line-height:1.55"><strong>${this.escapeHtml(oldLabel)}</strong> → <strong>${this.escapeHtml(newLabel)}</strong></p>
         ${noteBlock}
         ${this.ctaButton(params.reportUrl, 'Shiko raportin')}`,
      ),
    });
  }

  /**
   * Operational notice to Institution.contact. No citizen name or email.
   * Callers must already have passed the institutional mail policy.
   */
  async sendInstitutionalNewCase(params: {
    to: string;
    publicId: string;
    description: string;
    categoryName: string | null;
    priority: string | null;
    address: string | null;
    lat: number;
    lng: number;
    createdAt: Date;
    dueAt: Date | null;
    photoUrl: string | null;
    reportUrl: string;
    institutionName: string | null;
  }): Promise<SendResult> {
    const excerpt =
      params.description.length > 400 ? `${params.description.slice(0, 400)}…` : params.description;
    const location = params.address?.trim()
      ? params.address.trim()
      : `${params.lat.toFixed(5)}, ${params.lng.toFixed(5)}`;
    const due = params.dueAt ? params.dueAt.toISOString() : '—';
    const created = params.createdAt.toISOString();
    const photoLine = params.photoUrl ? `\nFoto: ${params.photoUrl}` : '';
    const photoHtml = params.photoUrl
      ? `<p style="margin:16px 0"><a href="${this.escapeHtml(params.photoUrl)}" style="color:${BRAND.accent}">Hap foton e raportit</a></p>`
      : '';

    return this.send({
      to: params.to,
      subject: `Raport i ri ${params.publicId} — Prizren Smart City`,
      text: `Një rast i ri hyri në radhën e institucionit.

Rasti: ${params.publicId}
Institucioni: ${params.institutionName ?? '—'}
Kategoria: ${params.categoryName ?? '—'}
Prioriteti: ${params.priority ?? '—'}
Lokacioni: ${location}
Krijuar: ${created}
Afati SLA: ${due}

${excerpt}
${photoLine}

Hap rastin (lidhje e sigurt, kërkon hyrje të stafit të institucionit):
${params.reportUrl}

Lidhja skadon dhe mund të revokohet. Mos përfshini të dhëna personale të qytetarit në përgjigje.`,
      html: this.layout(
        `Raport i ri ${this.escapeHtml(params.publicId)}`,
        `<p style="margin:0 0 16px;line-height:1.55">Një rast i ri hyri në radhën e institucionit${
          params.institutionName
            ? ` <strong>${this.escapeHtml(params.institutionName)}</strong>`
            : ''
        }.</p>
         ${this.infoBox(
           `Rasti: <strong>${this.escapeHtml(params.publicId)}</strong><br/>
           Kategoria: ${this.escapeHtml(params.categoryName ?? '—')}<br/>
           Prioriteti: ${this.escapeHtml(params.priority ?? '—')}<br/>
           Lokacioni: ${this.escapeHtml(location)}<br/>
           Krijuar: ${this.escapeHtml(created)}<br/>
           Afati SLA: ${this.escapeHtml(due)}`,
         )}
         ${this.infoBox(this.escapeHtml(excerpt))}
         ${photoHtml}
         ${this.ctaButton(params.reportUrl, 'Hap rastin')}
         <p style="margin:16px 0 0;color:${BRAND.muted};font-size:13px;line-height:1.5">Lidhja është e sigurt, skadon, dhe kërkon hyrje si staf i këtij institucioni. Mos përfshini të dhëna personale të qytetarit në përgjigje.</p>`,
      ),
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private ctaButton(href: string, label: string): string {
    return `<p style="margin:20px 0 0"><a href="${this.escapeHtml(href)}" style="display:inline-block;padding:12px 20px;background:${BRAND.accent};color:${BRAND.cream};border-radius:8px;text-decoration:none;font-weight:600">${label}</a></p>`;
  }

  private infoBox(innerHtml: string, tone: MailTone = 'default'): string {
    const border =
      tone === 'security'
        ? BRAND.securityBorder
        : tone === 'warning'
          ? BRAND.warningBorder
          : tone === 'success'
            ? BRAND.successBorder
            : BRAND.accent;
    const bg =
      tone === 'security'
        ? BRAND.securityBg
        : tone === 'warning'
          ? BRAND.warningBg
          : tone === 'success'
            ? BRAND.successBg
            : BRAND.infoBg;
    return `<p style="margin:0 0 16px;padding:12px 16px;background:${bg};border-left:4px solid ${border};border-radius:0 8px 8px 0;color:#4a3f33;line-height:1.55">${innerHtml}</p>`;
  }

  /**
   * Shared HTML chrome for every transactional email.
   * Table-based + inline styles for Outlook; text wordmark remains readable if images are blocked.
   * Optional PNG at /icons/icon-192.png (no dedicated logo.png / SVG in email).
   */
  private layout(title: string, body: string, tone: MailTone = 'default'): string {
    const origin = this.config.webOrigin.replace(/\/$/, '');
    const logoUrl = `${origin}/icons/icon-192.png`;
    const headerAccent =
      tone === 'security'
        ? BRAND.securityBorder
        : tone === 'warning'
          ? BRAND.warningBorder
          : tone === 'success'
            ? BRAND.successBorder
            : BRAND.gold;

    return `<!doctype html>
<html lang="sq">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${this.escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.cream};font-family:Georgia,'Times New Roman',serif;color:${BRAND.text}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.cream};margin:0;padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden">
          <tr>
            <td style="background:${BRAND.navy};padding:20px 28px;border-bottom:3px solid ${headerAccent}">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:14px">
                    <img src="${this.escapeHtml(logoUrl)}" width="40" height="40" alt="Prizren Smart City" style="display:block;border:0;outline:none;width:40px;height:40px;border-radius:6px">
                  </td>
                  <td style="vertical-align:middle">
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.2;color:#ffffff;letter-spacing:0.04em">PRIZREN</div>
                    <div style="font-family:system-ui,-apple-system,sans-serif;font-size:11px;line-height:1.3;color:${BRAND.gold};letter-spacing:0.18em;text-transform:uppercase;margin-top:2px">Smart City</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;font-family:system-ui,-apple-system,sans-serif">
              <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:${BRAND.navyDeep};font-weight:700">${title}</h1>
              <div style="font-size:15px;color:${BRAND.text}">
                ${body}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 28px;font-family:system-ui,-apple-system,sans-serif;border-top:1px solid ${BRAND.border}">
              <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:${BRAND.muted}">Komuna e Prizrenit · Prizren Smart City</p>
              <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:${BRAND.muted}">Ky është një mesazh i automatizuar. Ju lutemi mos i përgjigjeni këtij emaili.</p>
              <p style="margin:0;font-size:12px;line-height:1.5"><a href="${this.escapeHtml(origin)}" style="color:${BRAND.accent};text-decoration:underline">${this.escapeHtml(origin.replace(/^https?:\/\//, ''))}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  // Citizen mail uses this path. Institutional mail goes through OutboundEmailService
  // and sendInstitutionalNewCase() only after policy allows it.
  private async send(payload: MailPayload): Promise<SendResult> {
    if (isOauthPlaceholderEmail(payload.to)) {
      this.logger.warn(
        JSON.stringify({ event: 'mail.skip_placeholder', subject: payload.subject }),
      );
      return { provider: 'console' };
    }
    if (this.resend) {
      const { data, error } = await this.resend.emails.send({
        from: this.config.mailFrom,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });
      if (error) {
        this.logger.error(JSON.stringify({ event: 'mail.resend_failed', message: error.message }));
        throw new Error(`Failed to send email via Resend: ${error.message}`);
      }
      return { provider: 'resend', messageId: data?.id };
    }

    if (!this.transporter) {
      this.logger.warn(JSON.stringify({ event: 'mail.console', subject: payload.subject }));
      return { provider: 'console' };
    }

    const info = await this.transporter.sendMail({
      from: this.config.mailFrom,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    return { provider: 'smtp', messageId: info.messageId };
  }
}
