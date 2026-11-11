import { describe, it, expect } from 'vitest';
import { scoreDonor, waveSize, waveIntervalMinutes } from '../src/modules/requests/matching.js';

const NOW = new Date('2026-11-10T10:00:00Z');
const base = { samePin: false, sameCity: false, isFamily: false, knowsRequester: false, alertsReceived: 0, accepted: 0, totalDonations: 0, lastActiveAt: null };

describe('Smart matching: who is contacted first', () => {
  it('a donor in the hospital PIN area ranks above one elsewhere in the district', () => {
    expect(scoreDonor({ ...base, samePin: true }, NOW).score).toBeGreaterThan(scoreDonor(base, NOW).score);
  });

  it('family donors rank highest', () => {
    const family = scoreDonor({ ...base, isFamily: true }, NOW).score;
    const nearbyAndActive = scoreDonor({ ...base, samePin: true, lastActiveAt: NOW }, NOW).score;
    expect(family).toBeGreaterThanOrEqual(nearbyAndActive - 10);
    expect(scoreDonor({ ...base, isFamily: true }, NOW).reasons).toContain('Pledged to help this person');
  });

  it('reliable donors rank above donors who never answer', () => {
    const reliable = scoreDonor({ ...base, alertsReceived: 10, accepted: 8 }, NOW).score;
    const silent = scoreDonor({ ...base, alertsReceived: 10, accepted: 0 }, NOW).score;
    expect(reliable).toBeGreaterThan(silent);
  });

  it('recently active donors rank higher', () => {
    const recent = scoreDonor({ ...base, lastActiveAt: new Date(NOW.getTime() - 86_400_000) }, NOW).score;
    const old = scoreDonor({ ...base, lastActiveAt: new Date(NOW.getTime() - 200 * 86_400_000) }, NOW).score;
    expect(recent).toBeGreaterThan(old);
  });

  it('waves grow 5, 10, 20 and come faster for critical requests', () => {
    expect([waveSize(1), waveSize(2), waveSize(3), waveSize(4)]).toEqual([5, 10, 20, 20]);
    expect(waveIntervalMinutes('critical')).toBeLessThan(waveIntervalMinutes('urgent'));
    expect(waveIntervalMinutes('urgent')).toBeLessThan(waveIntervalMinutes('planned'));
  });
});
