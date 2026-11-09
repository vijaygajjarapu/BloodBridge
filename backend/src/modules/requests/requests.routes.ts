import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, authenticate, requireAdmin } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requestService, BLOOD_GROUPS, COMPONENTS, URGENCIES, BLOOD_REQUEST_STATUSES } from './requests.service.js';
import { addDocument, listDocuments, documentFile, reportRequest, REPORT_REASONS } from './fraud.service.js';
import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/types.js';

const router = Router();

const wrap =
  (fn: (req: Request) => Promise<unknown>, status = 200) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(status).json(await fn(req));
    } catch (e) {
      next(e);
    }
  };

const createSchema = z.object({
  patientName: z.string({ required_error: 'Patient name is required.' }).trim().min(2, 'Enter the patient’s name (at least 2 letters).').max(80),
  bloodGroup: z.enum(BLOOD_GROUPS, { errorMap: () => ({ message: 'Choose the blood group needed.' }) }),
  component: z.enum(COMPONENTS).optional(),
  unitsNeeded: z.coerce
    .number({ invalid_type_error: 'Enter how many units are needed.' })
    .int('Units must be a whole number.')
    .min(1, 'At least 1 unit.')
    .max(20, 'For more than 20 units, please contact the blood bank directly.'),
  hospitalName: z.string({ required_error: 'Hospital name is required.' }).trim().min(3, 'Enter the hospital name.').max(120),
  hospitalArea: z.string().trim().max(160).optional(),
  hospitalPinCode: z.string().trim().max(10).optional(),
  country: z.string().length(2).optional(),
  state: z.string({ required_error: 'Please choose the state.' }).min(1, 'Please choose the state.'),
  district: z.string({ required_error: 'Please choose the district.' }).min(1, 'Please choose the district.'),
  city: z.string({ required_error: 'Enter the city or town.' }).trim().min(2, 'Enter the city or town.').max(80),
  urgency: z.enum(URGENCIES, { errorMap: () => ({ message: 'Choose how urgent this is.' }) }),
  neededBy: z.string().optional().nullable(),
  notes: z.string().trim().max(500, 'Notes can be at most 500 characters.').optional(),
  /** Communities near the hospital to alert too (from GET /communities/near) */
  alertCommunityIds: z.array(z.string().max(64)).max(10).optional(),
});

const respondSchema = z.object({
  action: z.enum(['accept', 'decline', 'withdraw']),
  shareDirectNumber: z.boolean().optional(),
});

const statusSchema = z.object({ status: z.enum(BLOOD_REQUEST_STATUSES) });

const countsSchema = z.object({
  bloodGroup: z.enum(BLOOD_GROUPS, { errorMap: () => ({ message: 'Choose a blood group.' }) }),
  country: z.string().length(2).optional(),
  state: z.string({ required_error: 'Please choose a state.' }).min(1, 'Please choose a state.'),
  district: z.string().optional(),
});

// Public, information-only page (signed-in viewers also learn whether they can respond)
router.get('/public/:code', authenticate, wrap((req) => requestService.getPublic(req.params.code, req.user?.userId)));

// Find Donors: counts only, never individual donors
router.get('/donor-counts', requireAuth, wrap(async (req) => {
  const q = countsSchema.parse(req.query);
  return requestService.donorCounts(q);
}));

// Hospital suggestions for the request form
router.get('/hospitals', requireAuth, wrap(async (req) => {
  const q = z
    .object({
      country: z.string().length(2).optional(),
      state: z.string().min(1),
      district: z.string().optional(),
      pinCode: z.string().optional(),
      search: z.string().max(80).optional(),
    })
    .parse(req.query);
  return requestService.hospitals(q);
}));

router.post('/', requireAuth, validate(createSchema), wrap((req) => requestService.create(req.user!.userId, req.body), 201));
router.get('/mine', requireAuth, wrap((req) => requestService.listMine(req.user!.userId)));
router.get('/for-me', requireAuth, wrap((req) => requestService.listForDonor(req.user!.userId)));

// Admin: verification track + hold
router.get('/admin/all', requireAdmin, wrap((req) => requestService.adminList(req.query as any)));
router.patch(
  '/admin/:id/verification',
  requireAdmin,
  validate(z.object({ verificationStatus: z.enum(['unverified', 'pending_review', 'verified', 'rejected']), note: z.string().max(300).optional() })),
  wrap((req) => requestService.adminSetVerification(req.user!.userId, req.params.id, req.body)),
);
router.patch(
  '/admin/:id/hold',
  requireAdmin,
  validate(z.object({ onHold: z.boolean(), reason: z.string().max(300).optional() })),
  wrap((req) => requestService.adminSetHold(req.user!.userId, req.params.id, req.body)),
);

router.get(
  '/admin/:id/documents',
  requireAdmin,
  wrap((req) => listDocuments(req.params.id)),
);

router.get('/:id', requireAuth, wrap((req) => requestService.getById(req.user!.userId, req.params.id)));

// Patient documents (requester uploads; requester and admins can see the checks and the file)
router.post(
  '/:id/documents',
  requireAuth,
  validate(
    z.object({
      fileName: z.string().min(1).max(200),
      mimeType: z.string().min(1),
      dataBase64: z.string().min(10, 'Please choose a file.'),
    }),
  ),
  wrap(async (req) => {
    await addDocument(req.user!.userId, req.params.id, req.body);
    return listDocuments(req.params.id);
  }, 201),
);
router.get(
  '/:id/documents',
  requireAuth,
  wrap(async (req) => {
    const r = await prisma.bloodRequest.findUnique({ where: { id: req.params.id }, select: { requesterUserId: true } });
    if (!r || (r.requesterUserId !== req.user!.userId && req.user!.role !== 'admin')) throw new AppError('Request not found.', 404, 'NOT_FOUND');
    return listDocuments(req.params.id);
  }),
);
router.get('/:id/documents/:docId/file', requireAuth, async (req, res, next) => {
  try {
    const f = await documentFile(req.user!.userId, req.user!.role, req.params.id, req.params.docId);
    res.setHeader('Content-Type', f.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(f.fileName)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(f.path);
  } catch (e) {
    next(e);
  }
});

// Donors report a suspicious request (3 reports pause it)
router.post(
  '/:id/report',
  requireAuth,
  validate(z.object({ reason: z.enum(REPORT_REASONS, { errorMap: () => ({ message: 'Choose what went wrong.' }) }), details: z.string().max(500).optional() })),
  wrap((req) => reportRequest(req.user!.userId, req.params.id, req.body)),
);
// Requester: contact the next group of ranked donors now instead of waiting for the timer
router.post('/:id/alert-more', requireAuth, wrap((req) => requestService.alertMoreNow(req.user!.userId, req.params.id)));
router.post('/:id/respond', requireAuth, validate(respondSchema), wrap((req) => requestService.respond(req.user!.userId, req.params.id, req.body)));
router.patch('/:id/status', requireAuth, validate(statusSchema), wrap((req) => requestService.updateStatus(req.user!.userId, req.params.id, req.body.status)));
router.post('/:id/responses/:responseId/donated', requireAuth, wrap((req) => requestService.markDonated(req.user!.userId, req.params.id, req.params.responseId)));

export default router;
