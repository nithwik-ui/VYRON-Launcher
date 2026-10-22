/**
 * VYRON Identity — Email Service Abstraction
 *
 * Implements a pluggable email provider supporting Console (development/testing)
 * and transactional SMTP (production). Never logs raw secrets or plain OTPs
 * in production environments.
 */

import nodemailer, { Transporter } from 'nodemailer';

export interface EmailProvider {
  send(to: string, subject: string, text: string, html: string): Promise<boolean>;
}

export class ConsoleEmailProvider implements EmailProvider {
  async send(to: string, subject: string, text: string, _html: string): Promise<boolean> {
    const masked = EmailService.maskEmail(to);
    console.log(`[EmailService:Console] Sent "${subject}" to ${masked} (Raw email: ${to})`);
    return true;
  }
}

export class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter;
  private from: string;

  constructor() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';
    this.from = process.env.SMTP_FROM || `"VYRON Launcher" <${user || 'no-reply@vyronlauncher.com'}>`;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async send(to: string, subject: string, text: string, html: string): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html,
      });
      console.log(`[EmailService:SMTP] Delivered "${subject}" to ${EmailService.maskEmail(to)}`);
      return true;
    } catch (err: any) {
      console.error(`[EmailService:SMTP] Failed to send email to ${EmailService.maskEmail(to)}:`, err?.message || err);
      return false;
    }
  }
}

export class ResendEmailProvider implements EmailProvider {
  private apiKey: string;
  private from: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.from = process.env.RESEND_FROM || 'VYRON Launcher <onboarding@resend.dev>';
  }

  async send(to: string, subject: string, text: string, html: string): Promise<boolean> {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [to],
          subject,
          text,
          html,
        }),
      });
      if (res.ok) {
        console.log(`[EmailService:Resend] Delivered "${subject}" to ${EmailService.maskEmail(to)}`);
        return true;
      }
      const data = await res.text();
      console.error(`[EmailService:Resend] Error delivering email:`, data);
      return false;
    } catch (err: any) {
      console.error(`[EmailService:Resend] Network error:`, err?.message || err);
      return false;
    }
  }
}

export class EmailService {
  private static initProvider(): EmailProvider {
    if (process.env.RESEND_API_KEY) {
      return new ResendEmailProvider(process.env.RESEND_API_KEY);
    }
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      return new SmtpEmailProvider();
    }
    return new ConsoleEmailProvider();
  }

  private static provider: EmailProvider = EmailService.initProvider();

  public static setProvider(customProvider: EmailProvider): void {
    this.provider = customProvider;
  }

  /**
   * Helper to mask email address for audit and logging purposes (e.g. j***@example.com).
   */
  public static maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    const maskedLocal = local.length <= 2 
      ? local[0] + '***' 
      : local[0] + '***' + local[local.length - 1];
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Dispatches a 6-digit Email OTP for account verification.
   */
  public static async sendVerificationOtp(email: string, username: string, otp: string): Promise<boolean> {
    const subject = 'Your VYRON Verification Code';
    const text = `Hello ${username},\n\nYour 6-digit verification code is: ${otp}\n\nThis code will expire in 15 minutes. If you did not request this, please ignore this email.\n\n— The VYRON Team`;
    const html = `
      <div style="font-family: sans-serif; background: #0f141c; color: #f0f4fc; padding: 24px; border-radius: 8px;">
        <h2 style="color: #4ade80;">VYRON Verification Code</h2>
        <p>Hello <strong>${username}</strong>,</p>
        <p>Use the following 6-digit code to verify your VYRON account:</p>
        <div style="background: #1e293b; padding: 16px; border-radius: 6px; font-size: 24px; font-weight: bold; letter-spacing: 6px; text-align: center; color: #4ade80; margin: 16px 0;">
          ${otp}
        </div>
        <p style="color: #94a3b8; font-size: 13px;">This code expires in 15 minutes. Never share this code with anyone.</p>
      </div>
    `;

    return this.provider.send(email, subject, text, html);
  }

  /**
   * Dispatches a password reset challenge token or OTP.
   */
  public static async sendPasswordReset(email: string, username: string, token: string): Promise<boolean> {
    const subject = 'Reset Your VYRON Password';
    const text = `Hello ${username},\n\nA password reset request was received for your VYRON account.\nReset Token: ${token}\n\nIf you did not make this request, you can safely ignore this email.\n\n— The VYRON Team`;
    const html = `
      <div style="font-family: sans-serif; background: #0f141c; color: #f0f4fc; padding: 24px; border-radius: 8px;">
        <h2 style="color: #38bdf8;">VYRON Password Reset</h2>
        <p>Hello <strong>${username}</strong>,</p>
        <p>A password reset request was submitted for your account.</p>
        <p>Token: <code>${token}</code></p>
        <p style="color: #94a3b8; font-size: 13px;">This token expires in 1 hour. If you did not request this, please secure your account immediately.</p>
      </div>
    `;

    return this.provider.send(email, subject, text, html);
  }

  /**
   * Dispatches a security notification (e.g. login from new device, password changed).
   */
  public static async sendSecurityAlert(email: string, username: string, subject: string, message: string): Promise<boolean> {
    const text = `Hello ${username},\n\nSecurity Notice:\n${message}\n\n— The VYRON Team`;
    const html = `
      <div style="font-family: sans-serif; background: #0f141c; color: #f0f4fc; padding: 24px; border-radius: 8px;">
        <h2 style="color: #f87171;">VYRON Security Alert</h2>
        <p>Hello <strong>${username}</strong>,</p>
        <p>${message}</p>
      </div>
    `;

    return this.provider.send(email, subject, text, html);
  }
}
