import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from './logger.js';

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
        tls: {
          rejectUnauthorized: false, // Compatibility with varied certificates
        },
      });
    } catch (err: any) {
      logger.error('Failed to initialize nodemailer transporter:', err.message);
    }
  }

  async sendAccountVerificationEmail(toEmail: string, otpCode: string, username?: string): Promise<boolean> {
    if (!this.transporter) {
      this.initTransporter();
    }

    const subject = `BloodConnect — Verify Your Email Address: ${otpCode}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; border: 1px solid #E2E8F0; border-radius: 12px; background-color: #FFFFFF;">
        <div style="text-align: center; margin-bottom: 28px;">
          <h2 style="color: #B91C2C; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">BloodConnect</h2>
          <p style="color: #64748B; font-size: 13px; font-weight: 600; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">Be a Donor. Be a Savior.</p>
        </div>
        <p style="color: #1E293B; font-size: 16px; margin-bottom: 12px;">Hello${username ? ` <strong>${username}</strong>` : ''},</p>
        <p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
          Thank you for joining BloodConnect! To complete your registration and activate your account, please enter the single-use 6-digit verification code below:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <span style="display: inline-block; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #B91C2C; background-color: #FEF2F2; padding: 14px 28px; border-radius: 10px; border: 2px dashed #F87171; font-family: monospace;">
            ${otpCode}
          </span>
        </div>
        <div style="background-color: #F8FAFC; border-left: 4px solid #B91C2C; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;">
          <p style="color: #475569; font-size: 13px; margin: 0; line-height: 1.5;">
            ⏱ <strong>Expires in 5 minutes:</strong> This single-use code will expire in 5 minutes and is valid for a maximum of 5 attempts.
          </p>
        </div>
        <p style="color: #64748B; font-size: 13px; line-height: 1.5; margin-bottom: 24px;">
          If you did not request this account creation, please ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
        <p style="color: #94A3B8; font-size: 12px; text-align: center; margin: 0;">
          BloodConnect Emergency Healthcare &amp; Voluntary Donor Network
        </p>
      </div>
    `;

    return this.sendMail(toEmail, subject, html);
  }

  async sendLoginOtpEmail(toEmail: string, otpCode: string, ipAddress?: string): Promise<boolean> {
    if (!this.transporter) {
      this.initTransporter();
    }

    const subject = `BloodConnect — Your Login Security Code: ${otpCode}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; border: 1px solid #E2E8F0; border-radius: 12px; background-color: #FFFFFF;">
        <div style="text-align: center; margin-bottom: 28px;">
          <h2 style="color: #B91C2C; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">BloodConnect</h2>
          <p style="color: #64748B; font-size: 13px; font-weight: 600; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">Two-Factor Login Security</p>
        </div>
        <p style="color: #1E293B; font-size: 16px; margin-bottom: 12px;">Hello,</p>
        <p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
          We received a sign-in attempt for your BloodConnect account. Use the 6-digit login security code below to complete your authentication:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <span style="display: inline-block; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #B91C2C; background-color: #FEF2F2; padding: 14px 28px; border-radius: 10px; border: 2px dashed #F87171; font-family: monospace;">
            ${otpCode}
          </span>
        </div>
        <div style="background-color: #FFFBEB; border-left: 4px solid #F59E0B; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;">
          <p style="color: #92400E; font-size: 13px; margin: 0; line-height: 1.5;">
            🔒 <strong>Security Notice:</strong> This code is valid for <strong>5 minutes</strong>. Never share this code with anyone. BloodConnect staff will never ask for your code.
          </p>
        </div>
        <p style="color: #64748B; font-size: 13px; line-height: 1.5; margin-bottom: 24px;">
          ${ipAddress ? `Sign-in initiated from IP: <code>${ipAddress}</code>.<br/>` : ''}If you did not attempt to sign in, please secure your account by changing your password immediately.
        </p>
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
        <p style="color: #94A3B8; font-size: 12px; text-align: center; margin: 0;">
          BloodConnect Emergency Healthcare &amp; Voluntary Donor Network
        </p>
      </div>
    `;

    return this.sendMail(toEmail, subject, html);
  }

  private async sendMail(toEmail: string, subject: string, html: string): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      logger.info(`[TEST] Simulated email to ${toEmail}: ${subject}`);
      return true;
    }
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      await this.transporter.sendMail({
        from: `"${config.smtp.fromName}" <${config.smtp.from}>`,
        to: toEmail,
        subject,
        html,
      });

      logger.info(`Successfully dispatched email [${subject}] to ${toEmail}`);
      return true;
    } catch (error: any) {
      logger.error(`Error sending email to ${toEmail}:`, error.message);
      if (process.env.NODE_ENV === 'development') {
        logger.warn(`[DEV SIMULATION] Email dispatch failed: ${error.message}`);
      }
      return false;
    }
  }

  async sendOtpEmail(toEmail: string, otpCode: string, purpose: string): Promise<boolean> {
    if (purpose === 'login') {
      return this.sendLoginOtpEmail(toEmail, otpCode);
    }
    return this.sendAccountVerificationEmail(toEmail, otpCode);
  }

  async sendPasswordResetEmail(toEmail: string, resetLink: string): Promise<boolean> {
    if (!this.transporter) {
      this.initTransporter();
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #E6E8EC; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #B91C2C; margin: 0;">BloodBridge</h2>
          <p style="color: #69717D; font-size: 14px; margin-top: 4px;">Be a Donor. Be a Savior.</p>
        </div>
        <p style="color: #20252B; font-size: 16px;">Hello,</p>
        <p style="color: #20252B; font-size: 15px; line-height: 1.5;">
          We received a request to reset the password for your BloodBridge account. Click the button below to choose a new password:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetLink}" style="display: inline-block; background-color: #B91C2C; color: #FFFFFF; font-size: 15px; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 6px;">
            Reset Password
          </a>
        </div>
        <p style="color: #69717D; font-size: 13px; line-height: 1.4;">
          This link will expire in 15 minutes. If you did not request a password reset, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #E6E8EC; margin: 24px 0;" />
        <p style="color: #9AA2AD; font-size: 12px; text-align: center; margin: 0;">
          BloodBridge Emergency Healthcare & Donor Network
        </p>
      </div>
    `;

    return this.sendMail(toEmail, 'Reset Your BloodBridge Password', html);
  }

  async sendPasswordChangedNotificationEmail(toEmail: string): Promise<boolean> {
    if (!this.transporter) {
      this.initTransporter();
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #E6E8EC; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #B91C2C; margin: 0;">BloodBridge</h2>
          <p style="color: #69717D; font-size: 14px; margin-top: 4px;">Be a Donor. Be a Savior.</p>
        </div>
        <p style="color: #20252B; font-size: 16px;">Hello,</p>
        <p style="color: #20252B; font-size: 15px; line-height: 1.5;">
          This is a security notification confirming that your BloodBridge account password has just been changed.
        </p>
        <div style="background-color: #FEF3F2; border-left: 4px solid #B91C2C; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
          <p style="color: #B91C2C; font-size: 13px; font-weight: bold; margin: 0 0 4px 0;">Important Security Notice</p>
          <p style="color: #4A5568; font-size: 12px; margin: 0; line-height: 1.4;">
            If you made this change, you can safely disregard this email. If you did NOT change your password, please contact our support team immediately as your account may have been compromised.
          </p>
        </div>
        <hr style="border: none; border-top: 1px solid #E6E8EC; margin: 24px 0;" />
        <p style="color: #9AA2AD; font-size: 12px; text-align: center; margin: 0;">
          BloodBridge Emergency Healthcare & Donor Network
        </p>
      </div>
    `;

    return this.sendMail(toEmail, 'Security Alert: Your BloodBridge Password Has Changed', html);
  }
}

export const emailService = new EmailService();
