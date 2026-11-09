/**
 * Voice calls through a calling provider. OFF until VOICE_PROVIDER is set (see README "Phone calls and SMS alerts").
 *
 * Exotel "Connect Two Numbers": POST https://<subdomain>/v1/Accounts/<sid>/Calls/connect with From, To, CallerId.
 * Exotel calls From first; when they answer it dials To and joins the two. Both people see only the ExoPhone (CallerId),
 * so nobody's own number is shown to the other side.
 * "Connect to a call flow": same address with Url (a flow built in the Exotel dashboard) instead of To.
 * Check the request fields against Exotel's current documentation when you switch it on.
 */
import { config } from '../../config/index.js';
import { logger } from '../../shared/logger.js';

export interface VoiceResult {
  ok: boolean;
  callId?: string;
  error?: string;
}

class VoiceService {
  isConfigured(): boolean {
    const v = config.voice;
    return v.provider === 'exotel' && !!v.exotelSid && !!v.exotelApiKey && !!v.exotelApiToken && !!v.exotelCallerId;
  }

  /** Automatic alert calls also need a call flow (reads the alert, "press 1 if you can donate, 2 if not") */
  canPlaceAlertCalls(): boolean {
    return this.isConfigured() && !!config.voice.exotelAlertFlowUrl;
  }

  /** Calls `from` first, then joins `to`. Both see the ExoPhone, not each other's number. */
  async connectTwoNumbers(from: string, to: string, timeLimitSeconds = 900): Promise<VoiceResult> {
    if (!this.isConfigured()) return { ok: false, error: 'not_configured' };
    return this.post({ From: from, To: to, CallerId: config.voice.exotelCallerId, TimeLimit: String(timeLimitSeconds) });
  }

  /** Calls `to` and plays the alert flow. `customField` comes back to our webhook so we know which donor answered. */
  async callWithAlertFlow(to: string, customField: string): Promise<VoiceResult> {
    if (!this.canPlaceAlertCalls()) return { ok: false, error: 'not_configured' };
    return this.post({ From: to, CallerId: config.voice.exotelCallerId, Url: config.voice.exotelAlertFlowUrl, CustomField: customField });
  }

  private async post(fields: Record<string, string>): Promise<VoiceResult> {
    const v = config.voice;
    try {
      const res = await fetch(`https://${v.exotelSubdomain}/v1/Accounts/${encodeURIComponent(v.exotelSid)}/Calls/connect.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${v.exotelApiKey}:${v.exotelApiToken}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body: new URLSearchParams(fields).toString(),
      });
      const text = await res.text();
      if (!res.ok) {
        logger.error(`Voice call failed (${res.status}): ${text.slice(0, 300)}`);
        return { ok: false, error: `http_${res.status}` };
      }
      let callId: string | undefined;
      try {
        callId = JSON.parse(text)?.Call?.Sid;
      } catch {
        /* non-JSON answer: the call was still accepted */
      }
      return { ok: true, callId };
    } catch (err: any) {
      logger.error(`Voice call failed: ${err?.message}`);
      return { ok: false, error: 'network' };
    }
  }
}

export const voiceService = new VoiceService();
