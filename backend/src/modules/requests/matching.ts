/**
 * Smart matching: which donors to contact first for a blood request, and when to contact more.
 * Donors must already pass blood-group compatibility, availability and the eligibility rules;
 * this file only decides the ORDER and the WAVES.
 */

export interface DonorSignals {
  /** Donor lives in the hospital's PIN code area */
  samePin: boolean;
  /** Donor lives in the hospital's city/town */
  sameCity: boolean;
  /** Donor pledged to this family (Donor Circle) */
  isFamily: boolean;
  /** Donor invited the requester, or was invited by them */
  knowsRequester: boolean;
  /** Same community as the requester, or a community the requester chose to alert */
  community?: boolean;
  /** Works at the same organisation as the requester (requester chose to alert colleagues) */
  colleague?: boolean;
  /** How many blood request alerts this donor received before */
  alertsReceived: number;
  /** How many of those they accepted (or donated) */
  accepted: number;
  totalDonations: number;
  lastActiveAt: Date | null;
  /** Marked "on call" right now */
  onCall?: boolean;
  /** Blood group confirmed by a blood bank / admin */
  verified?: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

/** Higher score = contacted earlier. Reasons are short, plain-language labels (kept for admins and debugging). */
export function scoreDonor(s: DonorSignals, now = new Date()): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(reason);
  };

  if (s.isFamily) add(40, 'Pledged to help this person');
  if (s.onCall) add(30, 'On call now');
  if (s.samePin) add(30, 'Lives in the hospital PIN area');
  else if (s.sameCity) add(15, 'Same city as the hospital');
  if (s.colleague) add(20, 'Works with the family member');
  else if (s.community) add(20, 'Same community');
  if (s.knowsRequester) add(15, 'Knows the family');
  if (s.verified) add(10, 'Blood group verified');

  // Reliability: how often they said yes before (new donors get a fair middle score)
  if (s.alertsReceived >= 2) {
    const rate = Math.min(1, s.accepted / s.alertsReceived);
    add(Math.round(rate * 25), `Responds to ${Math.round(rate * 100)}% of requests`);
  } else {
    add(8, 'New to requests');
  }

  if (s.totalDonations > 0) add(Math.min(s.totalDonations, 5) * 2, 'Has donated before');

  if (s.lastActiveAt) {
    const days = (now.getTime() - s.lastActiveAt.getTime()) / DAY;
    if (days <= 2) add(15, 'Active in the last 2 days');
    else if (days <= 14) add(8, 'Active in the last 2 weeks');
    else if (days <= 60) add(3, 'Active in the last 2 months');
  }

  return { score, reasons };
}

/** How many donors each wave contacts (family donors are always in the first wave on top of this) */
export function waveSize(wave: number) {
  if (wave <= 1) return 5;
  if (wave === 2) return 10;
  return 20;
}

/** Minutes to wait for answers before contacting the next group */
export function waveIntervalMinutes(urgency: string) {
  if (urgency === 'critical') return 10;
  if (urgency === 'urgent') return 20;
  return 60;
}

/** Requester's "Alert more donors now" button can be used at most this often */
export const MANUAL_WAVE_COOLDOWN_MINUTES = 2;
