import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { subscriptionService } from './subscriptions.service.js';

const router = Router();

const verifySchema = z.object({
  orderId: z.string().min(1).optional(),
  subscriptionId: z.string().min(1).optional(),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});

/** Plan details (public): price, period, whether payments are set up */
router.get('/plan', (req, res) => res.json(subscriptionService.getPlan()));

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    res.json(await subscriptionService.getMine(req.user!.userId));
  } catch (e) {
    next(e);
  }
});

router.post('/order', requireAuth, async (req, res, next) => {
  try {
    res.status(201).json(await subscriptionService.createOrder(req.user!.userId));
  } catch (e) {
    next(e);
  }
});

router.post('/verify', requireAuth, validate(verifySchema), async (req, res, next) => {
  try {
    res.json(await subscriptionService.verifyPayment(req.user!.userId, req.body));
  } catch (e) {
    next(e);
  }
});

router.post('/dev-simulate', requireAuth, async (req, res, next) => {
  try {
    res.json(await subscriptionService.simulate(req.user!.userId));
  } catch (e) {
    next(e);
  }
});

// Automatic yearly renewal on / off
router.post('/auto-renew', requireAuth, validate(z.object({ enabled: z.boolean() })), async (req, res, next) => {
  try {
    res.json(await subscriptionService.setAutoRenew(req.user!.userId, req.body.enabled));
  } catch (e) {
    next(e);
  }
});

// Razorpay webhook (renewal charges / cancellations). Signed with RAZORPAY_WEBHOOK_SECRET.
router.post('/webhook', async (req, res, next) => {
  try {
    res.json(await subscriptionService.handleWebhook((req as any).rawBody, req.header('x-razorpay-signature') || undefined));
  } catch (e) {
    next(e);
  }
});

// Local testing only: pretend my simulated plan ended and run the renewal job
router.post('/dev-expire', requireAuth, async (req, res, next) => {
  try {
    res.json(await subscriptionService.devExpireAndRenew(req.user!.userId));
  } catch (e) {
    next(e);
  }
});

export default router;
