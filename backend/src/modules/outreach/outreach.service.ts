/**
 * Reaching donors outside the app, and calls that keep numbers private.
 *
 * - SMS alert with a one-tap link (/q/<token>): the donor can answer "I can donate" / "Not this time" without signing in.
 *   Needs a DLT-approved SMS template (MSG91_ALERT_TEMPLATE_ID); without it, alerts stay in-app only.
 * - Automatic alert call for CRITICAL requests (press 1 = I can donate, 2 = not this time), only for donors who turned it on.
 * - Masked calls: donor <-> family through the BloodBridge number, so neither sees the other's number.
 * - Donor's choices: SMS on/off, calls on/off, quiet hours (India time), and whether critical requests may still come through.
 * Voice is OFF until a provider is configured (see voice.service.ts).
 */
import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import { config } from '../../config/index.js';
import { AppError } from '../../shared/types.js';
import { formatPhone } from '../../shared/location.js';
import { smsService } from '../../shared/sms.service.js';
import { logger } from '../../shared/logger.js';
import { voiceService } from './voice.service.js';

const LIVE = ['submitted', 'open', 'donors_notified', 'donor_found', 'in_progress', 'partially_fulfilled'];
const MAX_MASKED_CALLS_PER_HOUR = 3;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const firstName = (name?: string | null) => (name || 'A donor').trim().split(/\s+/)[0];

/** Minutes since midnight in India time */
export function indiaMinutes(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Is `now` inside quiet hours? Handles ranges past midnight (22:00 -> 07:00). */
export function inQuietHours(start: string | null | undefined, end: string | null | undefined, now = new Date()) {
  if (!start || !end || !TIME_RE.test(start) || !TIME_RE.test(end) || start === end) return false;
  const m = indiaMinutes(now);
  const s = toMinutes(start);
  const e = toMinutes(end);
  return s < e ? m >= s && m < e : m >= s || m < e;
}

export interface ReachPrefs {
  alertBySms: boolean;
  alertByCall: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietAllowCritical: boolean;
}

/** Which outside channels may be used for this donor right now */
export function allowedChannels(p: ReachPrefs, urgency: string, now = new Date()) {
  const quiet = inQuietHours(p.quietHoursStart, p.quietHoursEnd, now) && !(urgency === 'critical' && p.quietAllowCritical);
  return {
    quiet,
    sms: p.alertBySms && !quiet,
    // Automatic calls are only for critical requests
    call: p.alertByCall && urgency === 'critical' && !quiet,
  };
}

const newToken = () => crypto.randomBytes(18).toString('base64url');

async function log(requestId: string, donorUserId: string, kind: string, provider: string, status: string, providerCallId?: string) {
  await prisma.callAttempt
    .create({ data: { requestId, donorUserId, kind, provider, status, providerCallId: providerCallId ?? null } })
    .catch(() => undefined);
}

export class OutreachService {
  status() {
    return {
      smsAlerts: smsService.canSendAlerts(),
      maskedCalls: voiceService.isConfigured(),
      alertCalls: voiceService.canPlaceAlertCalls(),
    };
  }

  // ---------- Donor choices ----------

  async getPrefs(userId: string) {
    const p = await prisma.donorProfile.findUnique({ where: { userId } });
    if (!p) throw new AppError('Add your blood group to your profile first.', 400, 'NO_DONOR_PROFILE');
    return { ...this.prefsOf(p), available: this.status() };
  }

  async updatePrefs(userId: string, input: Partial<ReachPrefs>) {
    const p = await prisma.donorProfile.findUnique({ where: { userId } });
    if (!p) throw new AppError('Add your blood group to your profile first.', 400, 'NO_DONOR_PROFILE');
    const start = input.quietHoursStart === undefined ? p.quietHoursStart : input.quietHoursStart || null;
    const end = input.quietHoursEnd === undefined ? p.quietHoursEnd : input.quietHoursEnd || null;
    if ((start && !TIME_RE.test(start)) || (end && !TIME_RE.test(end))) {
      throw new AppError('Choose a time like 22:00.', 400, 'VALIDATION_FAILED');
    }
    if (Boolean(start) !== Boolean(end)) {
      throw new AppError('Choose both a start and an end time for quiet hours, or neither.', 400, 'VALIDATION_FAILED');
    }
    await prisma.donorProfile.update({
      where: { userId },
      data: {
        ...(typeof input.alertBySms === 'boolean' && { alertBySms: input.alertBySms }),
        ...(typeof input.alertByCall === 'boolean' && { alertByCall: input.alertByCall }),
        ...(typeof input.quietAllowCritical === 'boolean' && { quietAllowCritical: input.quietAllowCritical }),
        quietHoursStart: start,
        quietHoursEnd: end,
      },
    });
    return this.getPrefs(userId);
  }

  private prefsOf(p: ReachPrefs): ReachPrefs {
    return {
      alertBySms: p.alertBySms,
      alertByCall: p.alertByCall,
      quietHoursStart: p.quietHoursStart,
      quietHoursEnd: p.quietHoursEnd,
      quietAllowCritical: p.quietAllowCritical,
    };
  }

  // ---------- Alerts outside the app (called for each donor in a wave) ----------

  /** Makes sure the donor has a one-tap link for this request and returns it */
  async quickLinkFor(candidateId: string) {
    const c = await prisma.requestCandidate.findUnique({ where: { id: candidateId } });
    if (!c) return null;
    const token = c.quickToken || newToken();
    if (!c.quickToken) await prisma.requestCandidate.update({ where: { id: c.id }, data: { quickToken: token } });
    return { token, url: `${config.frontendUrl.replace(/\/$/, '')}/q/${token}` };
  }

  /** SMS and (critical only) automatic call, following the donor's choices and quiet hours */
  async alertOutsideApp(candidateId: string) {
    const smsReady = smsService.canSendAlerts();
    const callReady = voiceService.canPlaceAlertCalls();
    if (!smsReady && !callReady) return { sms: false, call: false };

    const c = await prisma.requestCandidate.findUnique({
      where: { id: candidateId },
      include: {
        request: true,
        donor: { select: { phone: true, status: true, donorProfile: true } },
      },
    });
    const p = c?.donor.donorProfile;
    if (!c || !p || !c.donor.phone || c.donor.status !== 'active') return { sms: false, call: false };
    const r = c.request;
    const channels = allowedChannels(p, r.urgency);
    const link = await this.quickLinkFor(c.id);
    if (!link) return { sms: false, call: false };

    let sms = false;
    let call = false;
    if (smsReady && p.alertBySms) {
      if (channels.sms) {
        sms = await smsService.sendAlert(c.donor.phone, {
          group: r.bloodGroup,
          place: [r.hospitalName, r.city].filter(Boolean).join(', ').slice(0, 60),
          link: link.url,
        });
        await log(r.id, c.donorUserId, 'alert_sms', 'msg91', sms ? 'sent' : 'failed');
      } else {
        await log(r.id, c.donorUserId, 'alert_sms', 'msg91', 'skipped_quiet_hours');
      }
    }
    if (callReady && p.alertByCall && r.urgency === 'critical') {
      if (channels.call) {
        const res = await voiceService.callWithAlertFlow(c.donor.phone, link.token);
        call = res.ok;
        await log(r.id, c.donorUserId, 'alert_call', 'exotel', res.ok ? 'sent' : 'failed', res.callId);
      } else {
        await log(r.id, c.donorUserId, 'alert_call', 'exotel', 'skipped_quiet_hours');
      }
    }
    return { sms, call };
  }

  // ---------- One-tap link (no sign-in) ----------

  private async byToken(token: string) {
    if (!token || token.length < 16) throw new AppError('This link is not valid.', 404, 'NOT_FOUND');
    const c = await prisma.requestCandidate.findFirst({
      where: { quickToken: token },
      include: {
        request: { include: { requester: { select: { fullName: true, username: true, country: true } } } },
        donor: { select: { fullName: true, username: true } },
      },
    });
    if (!c) throw new AppError('This link is not valid any more.', 404, 'NOT_FOUND');
    return c;
  }

  async quickView(token: string) {
    const c = await this.byToken(token);
    const r = c.request;
    if (c.status === 'alerted') {
      await prisma.requestCandidate.update({ where: { id: c.id }, data: { status: 'viewed', viewedAt: new Date() } });
    }
    const mine = await prisma.requestResponse.findUnique({ where: { requestId_donorUserId: { requestId: r.id, donorUserId: c.donorUserId } } });
    const accepted = mine?.status === 'accepted' || mine?.status === 'donated';
    const live = LIVE.includes(r.status) && !r.onHold && r.verificationStatus !== 'rejected';
    return {
      requestId: r.id,
      donorFirstName: firstName(c.donor.fullName || c.donor.username),
      requesterFirstName: firstName(r.requester.fullName || r.requester.username),
      bloodGroup: r.bloodGroup,
      component: r.component,
      unitsNeeded: r.unitsNeeded,
      hospitalName: r.hospitalName,
      hospitalArea: r.hospitalArea,
      city: r.city,
      urgency: r.urgency,
      neededBy: r.neededBy?.toISOString() ?? null,
      live,
      myResponse: mine?.status ?? null,
      // The family's number: after accepting, or before if the family chose to share it in alerts
      requesterPhone: accepted || (live && r.shareNumberInAlerts) ? formatPhone(r.contactPhone, r.requester.country) : null,
      maskedCallAvailable: accepted && voiceService.isConfigured(),
    };
  }

  async quickRespond(token: string, action: 'accept' | 'decline') {
    const c = await this.byToken(token);
    const { requestService } = await import('../requests/requests.service.js');
    await requestService.respond(c.donorUserId, c.requestId, { action });
    return this.quickView(token);
  }

  // ---------- Masked calls (numbers stay hidden) ----------

  private async checkCallLimit(requestId: string, donorUserId: string, kind: string) {
    const recent = await prisma.callAttempt.count({
      where: { requestId, donorUserId, kind, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recent >= MAX_MASKED_CALLS_PER_HOUR) {
      throw new AppError('Too many calls in the last hour. Please wait a little and try again.', 429, 'TOO_MANY_REQUESTS');
    }
  }

  private requireVoice() {
    if (!voiceService.isConfigured()) {
      throw new AppError('Calling through BloodBridge is not switched on yet. Please call directly.', 503, 'VOICE_NOT_CONFIGURED');
    }
  }

  /** Donor who accepted -> family. BloodBridge rings the donor first, then joins the family. */
  async donorCallsFamily(userId: string, requestId: string) {
    this.requireVoice();
    const r = await prisma.bloodRequest.findUnique({ where: { id: requestId } });
    if (!r) throw new AppError('Request not found.', 404, 'NOT_FOUND');
    const mine = await prisma.requestResponse.findUnique({ where: { requestId_donorUserId: { requestId, donorUserId: userId } } });
    if (!mine || !['accepted', 'donated'].includes(mine.status)) {
      throw new AppError('Accept the request first to call the family.', 403, 'FORBIDDEN');
    }
    const donor = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    if (!donor?.phone) throw new AppError('Add your mobile number to your profile first.', 400, 'PHONE_REQUIRED');
    await this.checkCallLimit(requestId, userId, 'donor_calls_family');
    const res = await voiceService.connectTwoNumbers(donor.phone, r.contactPhone);
    await log(requestId, userId, 'donor_calls_family', 'exotel', res.ok ? 'sent' : 'failed', res.callId);
    if (!res.ok) throw new AppError('The call could not be started. Please try again or call directly.', 502, 'CALL_FAILED');
    return { calling: true, message: 'Your phone will ring now. Pick up and we will connect you to the family.' };
  }

  /** Family -> a donor who accepted (even if the donor kept their number hidden). Rings the family first. */
  async familyCallsDonor(userId: string, requestId: string, responseId: string) {
    this.requireVoice();
    const r = await prisma.bloodRequest.findUnique({ where: { id: requestId } });
    if (!r) throw new AppError('Request not found.', 404, 'NOT_FOUND');
    if (r.requesterUserId !== userId) throw new AppError('Only the family who posted this request can do this.', 403, 'FORBIDDEN');
    const resp = await prisma.requestResponse.findUnique({ where: { id: responseId }, include: { donor: { select: { phone: true } } } });
    if (!resp || resp.requestId !== requestId || !['accepted', 'donated'].includes(resp.status)) {
      throw new AppError('This donor has not accepted the request.', 404, 'NOT_FOUND');
    }
    if (!resp.donor.phone) throw new AppError('This donor has no mobile number on file.', 400, 'PHONE_REQUIRED');
    await this.checkCallLimit(requestId, resp.donorUserId, 'family_calls_donor');
    const res = await voiceService.connectTwoNumbers(r.contactPhone, resp.donor.phone);
    await log(requestId, resp.donorUserId, 'family_calls_donor', 'exotel', res.ok ? 'sent' : 'failed', res.callId);
    if (!res.ok) throw new AppError('The call could not be started. Please try again.', 502, 'CALL_FAILED');
    return { calling: true, message: 'Your phone will ring now. Pick up and we will connect you to the donor.' };
  }

  // ---------- Automatic alert call: the donor pressed a key ----------

  /** Webhook from the call flow. 1 = I can donate, 2 = not this time. */
  async handleKeypress(input: { secret?: string; token?: string; digits?: string }) {
    if (!config.voice.webhookSecret || input.secret !== config.voice.webhookSecret) {
      throw new AppError('Not allowed.', 403, 'FORBIDDEN');
    }
    const digit = String(input.digits || '').replace(/\D/g, '').slice(0, 1);
    if (!input.token || !['1', '2'].includes(digit)) return { done: false };
    try {
      await this.quickRespond(input.token, digit === '1' ? 'accept' : 'decline');
      return { done: true, action: digit === '1' ? 'accept' : 'decline' };
    } catch (err: any) {
      logger.error(`Alert call answer not saved: ${err?.message}`);
      return { done: false };
    }
  }
}

export const outreachService = new OutreachService();
