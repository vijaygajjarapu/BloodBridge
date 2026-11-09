import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { outreachService } from './outreach.service.js';

const router = Router();

const wrap =
  (fn: (req: Request) => Promise<unknown> | unknown, status = 200) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(status).json(await fn(req));
    } catch (e) {
      next(e);
    }
  };

// One-tap links work without signing in, so they get a tighter limit per address
const quickLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many tries. Please wait a minute.' },
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a time like 22:00.').nullable().optional();
const prefsSchema = z.object({
  alertBySms: z.boolean().optional(),
  alertByCall: z.boolean().optional(),
  quietHoursStart: time,
  quietHoursEnd: time,
  quietAllowCritical: z.boolean().optional(),
});
const quickSchema = z.object({ action: z.enum(['accept', 'decline']) });

/** Which outside channels are switched on (SMS alerts, masked calls, alert calls) */
router.get('/status', wrap(() => outreachService.status()));

// Donor: how to reach me
router.get('/me', requireAuth, wrap((req) => outreachService.getPrefs(req.user!.userId)));
router.put('/me', requireAuth, validate(prefsSchema), wrap((req) => outreachService.updatePrefs(req.user!.userId, req.body)));

// One-tap link from an SMS / call: answer without signing in
router.get('/quick/:token', quickLimiter, wrap((req) => outreachService.quickView(req.params.token)));
router.post('/quick/:token', quickLimiter, validate(quickSchema), wrap((req) => outreachService.quickRespond(req.params.token, req.body.action)));

// Masked calls: numbers stay hidden from both sides
router.post('/requests/:id/call-family', requireAuth, wrap((req) => outreachService.donorCallsFamily(req.user!.userId, req.params.id)));
router.post(
  '/requests/:id/responses/:responseId/call',
  requireAuth,
  wrap((req) => outreachService.familyCallsDonor(req.user!.userId, req.params.id, req.params.responseId)),
);

// Call-flow webhook: the donor pressed 1 (I can donate) or 2 (not this time). Accepts GET or POST.
const keypress = wrap((req) => {
  const src = { ...(req.query as Record<string, string>), ...(req.body || {}) };
  return outreachService.handleKeypress({ secret: src.secret, token: src.token || src.CustomField, digits: src.digits });
});
router.get('/voice/keypress', keypress);
router.post('/voice/keypress', keypress);

export default router;
