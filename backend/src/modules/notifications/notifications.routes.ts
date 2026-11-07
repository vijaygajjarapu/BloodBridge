import { Router } from 'express';
import { notificationController } from './notifications.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', requireAuth, notificationController.getNotifications);
router.patch('/:id/read', requireAuth, notificationController.markAsRead);
router.post('/mark-all-read', requireAuth, notificationController.markAllAsRead);

export default router;
