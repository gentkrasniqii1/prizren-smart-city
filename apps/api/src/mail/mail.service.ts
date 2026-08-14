import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { ConfigService } from '../auth/config.service';

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    if (this.config.smtpHost) {
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
    return Boolean(this.transporter);
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
