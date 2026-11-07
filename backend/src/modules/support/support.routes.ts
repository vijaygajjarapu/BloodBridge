import { Router } from 'express';
import { supportController } from './support.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/faqs', supportController.getFaqs);
router.post('/inquire', authenticate, supportController.submitInquiry);
router.post('/tickets', authenticate, supportController.submitInquiry);

export default router;
