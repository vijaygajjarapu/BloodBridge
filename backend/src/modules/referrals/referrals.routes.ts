import { Router } from 'express';
import { referralController } from './referrals.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { shareInvitationSchema } from './referrals.schemas.js';

const router = Router();

// Public referral code validation (used when a potential donor opens /join/:code)
router.get('/validate/:code', referralController.validateCode);

// Authenticated user referral metrics & share links
router.get('/stats', requireAuth, referralController.getStats);
router.get('/my-code', requireAuth, referralController.getStats);
router.post('/share', requireAuth, validate(shareInvitationSchema), referralController.share);

export default router;
