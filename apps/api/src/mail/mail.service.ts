import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { ConfigService } from '../auth/config.service';

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const STATUS_LABELS_SQ: Record<string, string> = {
  PENDING: 'Në pritje',
  IN_REVIEW: 'Në shqyrtim',
  ASSIGNED: 'I caktuar',
  IN_PROGRESS: 'Në progres',
  RESOLVED: 'I zgjidhur',
  REJECTED: 'I refuzuar',
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
        `<p>Faleminderit që u regjistrove në Prizren Smart City.</p>
         <p>Kliko butonin më poshtë për të konfirmuar adresën e email-it. Lidhja skadon pas 24 orësh.</p>
         <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 20px;background:#335f9b;color:#faf8f5;border-radius:8px;text-decoration:none;font-weight:600">Konfirmo email-in</a></p>
         <p style="color:#7d6a55;font-size:13px">Nëse nuk e krijove këtë llogari, injoro këtë mesazh.</p>`,
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
        `<p>Marrëm një kërkesë për të rikthyer fjalëkalimin e llogarisë tënde.</p>
         <p><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#335f9b;color:#faf8f5;border-radius:8px;text-decoration:none;font-weight:600">Vendos fjalëkalim të ri</a></p>
         <p style="color:#7d6a55;font-size:13px">Nëse nuk e kërkove këtë, mund ta injorosh mesazhin. Lidhja skadon pas 1 ore.</p>`,
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
        `<p>Fjalëkalimi i llogarisë tënde u ndryshua me sukses.</p>
         <p>Nëse nuk e bëre ti këtë ndryshim, na kontakto menjëherë.</p>`,
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
        `<p>Faleminderit! Raporti yt u regjistrua dhe do të shqyrtohet së shpejti.</p>
         <p style="padding:12px 16px;background:#f5f0e8;border-radius:8px;color:#4a3f33">${this.escapeHtml(excerpt)}</p>
         <p><a href="${params.reportUrl}" style="display:inline-block;padding:12px 20px;background:#335f9b;color:#faf8f5;border-radius:8px;text-decoration:none;font-weight:600">Shiko raportin</a></p>`,
      ),
    });
  }

  async sendReportStatusChangedEmail(
    to: string,
    params: { oldStatus: string; newStatus: string; reportUrl: string },
  ): Promise<void> {
    const oldLabel = statusLabel(params.oldStatus);
    const newLabel = statusLabel(params.newStatus);
    await this.send({
      to,
      subject: 'Statusi i raportit u ndryshua — Prizren Smart City',
      text: `Statusi i raportit tënd ndryshoi: ${oldLabel} → ${newLabel}\n\nShiko detajet këtu:\n${params.reportUrl}`,
      html: this.layout(
        'Statusi u përditësua',
        `<p>Statusi i raportit tënd ndryshoi:</p>
         <p style="font-size:16px"><strong>${this.escapeHtml(oldLabel)}</strong> → <strong>${this.escapeHtml(newLabel)}</strong></p>
         <p><a href="${params.reportUrl}" style="display:inline-block;padding:12px 20px;background:#335f9b;color:#faf8f5;border-radius:8px;text-decoration:none;font-weight:600">Shiko raportin</a></p>`,
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

  private layout(title: string, body: string): string {
    return `<!doctype html>
<html><body style="margin:0;background:#faf8f5;font-family:system-ui,sans-serif;color:#27211c">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e6ddd0">
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#7d6a55">Prizren Smart City</p>
    <h1 style="margin:0 0 16px;font-size:22px">${title}</h1>
    ${body}
  </div>
</body></html>`;
  }

  private async send(payload: MailPayload): Promise<void> {
    if (this.resend) {
      const { error } = await this.resend.emails.send({
        from: this.config.mailFrom,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });
      if (error) {
        this.logger.error(`Resend failed to send to ${payload.to}: ${error.message}`);
        throw new Error(`Failed to send email via Resend: ${error.message}`);
      }
      return;
    }

    if (!this.transporter) {
      this.logger.warn(`[mail-dev] To ${payload.to} | ${payload.subject}\n${payload.text}`);
      return;
    }

    await this.transporter.sendMail({
      from: this.config.mailFrom,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
  }
}
