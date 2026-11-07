import { Router } from 'express';
import { consentController } from './consent.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router = Router();

// User consent preferences
router.get('/status', requireAuth, consentController.getPreferences);
router.patch('/update', requireAuth, consentController.updateConsent);
router.post('/update', requireAuth, consentController.updateConsent);

export default router;
