import { config } from '../config/index.js';
import { logger } from './logger.js';

/**
 * SMS delivery for "Login with mobile number".
 *
 * Set SMS_PROVIDER=msg91 with MSG91_AUTH_KEY and MSG91_TEMPLATE_ID (a DLT-approved OTP template
 * that contains the variable ##otp##) to send real SMS in India.
 * With no provider set, sendLoginOtp returns false and the caller emails the code instead.
 */
class SmsService {
  isConfigured(): boolean {
    return config.sms.provider === 'msg91' && !!config.sms.msg91AuthKey && !!config.sms.msg91TemplateId;
  }

  async sendLoginOtp(phoneE164: string, otpCode: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: { authkey: config.sms.msg91AuthKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          template_id: config.sms.msg91TemplateId,
          short_url: '0',
          recipients: [{ mobiles: phoneE164.replace(/^\+/, ''), otp: otpCode }],
        }),
      });
      if (!res.ok) {
        logger.error(`SMS send failed (${res.status}): ${await res.text()}`);
        return false;
      }
      return true;
    } catch (err: any) {
      logger.error(`SMS send failed: ${err?.message}`);
      return false;
    }
  }
}

export const smsService = new SmsService();
