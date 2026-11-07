import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/types.js';
import { logger } from '../shared/logger.js';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`;

  // Log error
  logger.error(`[${req.method} ${req.path}] Error:`, err.message || err);

  // 1. Zod Validation Error: one plain message per field, e.g. "Mobile number is required."
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) {
      const field = issue.path.join('.') || 'form';
      if (fieldErrors[field]) continue;
      const missing = issue.code === 'invalid_type' && (issue as any).received === 'undefined';
      fieldErrors[field] = missing ? `${fieldLabel(field)} is required.` : friendlyIssue(field, issue.message);
    }
    const messages = Object.values(fieldErrors);
    return res.status(400).json({
      code: 'VALIDATION_FAILED',
      message: messages.length === 1 ? messages[0] : 'Please check the highlighted details and try again.',
      fieldErrors,
      requestId,
    });
  }

  // 2. Custom AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      fieldErrors: err.fieldErrors,
      requestId,
    });
  }

  // 3. Prisma Unique Constraint Error (P2002), e.g. a mobile number already used by another account
  if (err?.code === 'P2002') {
    const targets: string[] = Array.isArray(err.meta?.target) ? err.meta.target : [String(err.meta?.target || 'field')];
    const fieldErrors: Record<string, string> = {};
    for (const t of targets) fieldErrors[t] = `This ${fieldLabel(t).toLowerCase()} is already registered.`;
    return res.status(409).json({
      code: 'CONFLICT',
      message: Object.values(fieldErrors)[0],
      fieldErrors,
      requestId,
    });
  }

  // 4. Default 500 Internal Error
  return res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected server error occurred.' : err.message || 'Internal error',
    requestId,
  });
}

const FIELD_LABELS: Record<string, string> = {
  phone: 'Mobile number',
  phoneNumber: 'Mobile number',
  mobileNumber: 'Mobile number',
  email: 'Email address',
  identifier: 'Email or mobile number',
  username: 'Username',
  dateOfBirth: 'Date of birth',
  password: 'Password',
  confirmPassword: 'Confirm password',
  newPassword: 'New password',
  fullName: 'Full name',
  name: 'Full name',
  bloodGroup: 'Blood group',
  country: 'Country',
  state: 'State / union territory',
  district: 'District',
  city: 'City / town',
  postalCode: 'PIN code',
  referralCode: 'Referral code',
  code: 'Verification code',
  reason: 'Reason',
};

function fieldLabel(field: string): string {
  const key = field.split('.').pop() || field;
  return FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

/** Turns library wording ("Required", "Invalid enum value...") into plain sentences */
function friendlyIssue(field: string, message: string): string {
  if (/^required$/i.test(message.trim())) return `${fieldLabel(field)} is required.`;
  if (/invalid enum value|invalid option/i.test(message)) return `Please choose a valid ${fieldLabel(field).toLowerCase()}.`;
  if (/^invalid input/i.test(message) || /^expected /i.test(message)) return `Please enter a valid ${fieldLabel(field).toLowerCase()}.`;
  return /[.!?]$/.test(message) ? message : `${message}.`;
}
