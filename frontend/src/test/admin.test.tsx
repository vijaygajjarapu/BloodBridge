import { describe, it, expect } from 'vitest';
import { adminService } from '../services';

describe('Administrator Dashboard & Operations', () => {
  it('retrieves comprehensive platform overview metrics', async () => {
    const metrics = await adminService.getOverviewMetrics();
    expect(metrics.totalDonors).toBeGreaterThan(0);
    expect(metrics.totalUsers).toBeGreaterThan(0);
    expect(metrics.consentGrantedRate).toBeGreaterThan(0);
    expect(metrics.registrationTrends.length).toBeGreaterThan(0);
    expect(metrics.bloodGroupDistribution.length).toBe(8);
  });

  it('filters users by search and status', async () => {
    const result = await adminService.listUsers({ search: 'Marcus' });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].name).toContain('Marcus');
  });

  it('updates a user account status and appends to the immutable audit log', async () => {
    const updatedUser = await adminService.updateUserStatus('usr_demo_1120', 'active');
    expect(updatedUser.status).toBe('active');

    const auditLogs = await adminService.listAuditLogs({ entityType: 'user' });
    const match = auditLogs.data.find((log) => log.entityId === 'usr_demo_1120');
    expect(match).toBeDefined();
    expect(match?.action).toBe('USER_STATUS_CHANGE');
  });

  it('toggles referral code active permissions', async () => {
    const toggled = await adminService.toggleReferralCode('ref_01', false);
    expect(toggled.isActive).toBe(false);

    const reenabled = await adminService.toggleReferralCode('ref_01', true);
    expect(reenabled.isActive).toBe(true);
  });
});
