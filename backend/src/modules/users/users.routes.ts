import { Router } from 'express';
import { usersController } from './users.controller.js';
import { consentController } from '../consent/consent.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', requireAuth, usersController.getProfile);
router.put('/', requireAuth, usersController.updateProfile);
router.put('/settings', requireAuth, usersController.updateProfile);
router.get('/consent', requireAuth, consentController.getPreferences);
router.patch('/consent', requireAuth, consentController.updateConsent);
router.post('/export', requireAuth, usersController.exportData);
router.post('/delete', requireAuth, usersController.deleteAccount);
router.delete('/', requireAuth, usersController.deleteAccount);

export default router;
