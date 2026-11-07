import { Router } from 'express';
import { adminController } from './admin.controller.js';
import { requireAdmin } from '../../middleware/auth.middleware.js';

const router = Router();

// All /api/v1/admin/* routes are strictly protected by requireAdmin middleware
router.use(requireAdmin);

router.get('/metrics', adminController.getMetrics);
router.get('/dashboard', adminController.getMetrics);
router.get('/users', adminController.listUsers);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.put('/users/:id/status', adminController.updateUserStatus);
router.get('/donors', adminController.listDonors);
router.patch('/donors/:id', adminController.updateDonorRecord);
router.get('/referrals', adminController.listReferrals);
router.patch('/referrals/:id/toggle', adminController.toggleReferral);
router.get('/consents', adminController.listConsents);
router.get('/audit-logs', adminController.listAuditLogs);
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

export default router;
