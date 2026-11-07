import { Router } from 'express';
import { oauthController } from './oauth.controller.js';

const router = Router();

router.get('/google', oauthController.getGoogleUrl);
router.get('/google/callback', oauthController.googleCallback);

export default router;
