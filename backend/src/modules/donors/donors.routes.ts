import { Router } from 'express';
import { donorController } from './donors.controller.js';
import { requireAuth, authenticate } from '../../middleware/auth.middleware.js';
import { validate, validateQuery } from '../../middleware/validate.middleware.js';
import {
  donorRegistrationSchema,
  updateDonorSchema,
  reportDonorSchema,
  donorListQuerySchema,
} from './donors.schemas.js';

const router = Router();

// My donors list (accessible by logged-in users to see donors registered through their referrals)
router.get('/my-referrals', requireAuth, validateQuery(donorListQuerySchema), donorController.listMyDonors);
router.get('/my-network', requireAuth, validateQuery(donorListQuerySchema), donorController.listMyDonors);

// Public donor registration via referral link
router.post('/register', validate(donorRegistrationSchema), donorController.registerDonor);

// Donor details by ID (with privacy contact masking)
router.get('/:id', authenticate, donorController.getDonorById);

// Update donor profile
router.put('/:id', requireAuth, validate(updateDonorSchema), donorController.updateDonor);

// Report inaccurate donor info
router.post('/:id/report', authenticate, validate(reportDonorSchema), donorController.reportIncorrectInfo);

export default router;
