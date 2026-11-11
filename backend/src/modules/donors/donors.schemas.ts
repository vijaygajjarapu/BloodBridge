import { z } from 'zod';

export const donorRegistrationSchema = z.object({
  referralCode: z.string().min(1, 'Referral code is required'),
  fullName: z.string().min(2, 'Full name is required'),
  // Adults only (checked again in the service): no accounts for under-18s
  dateOfBirth: z.string({ required_error: 'Date of birth is required.' }).min(1, 'Date of birth is required.'),
  mobileNumber: z.string().optional(),
  phone: z.string().optional(),
  // A real BloodNation account is created, so email (for the verification code) and a password are required
  email: z
    .string({ required_error: 'Email address is required.' })
    .trim()
    .min(1, 'Email address is required.')
    .email('Please enter a valid email address.')
    .transform((val) => val.toLowerCase()),
  password: z
    .string({ required_error: 'Please create a password.' })
    .min(8, 'Password must be at least 8 characters.')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.'),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  country: z.string().length(2).optional().default('IN'),
  state: z.string().min(1, 'State is required'),
  district: z.string().min(1, 'District is required'),
  city: z.string().min(1, 'City is required'),
  postalCode: z.string().optional(),
  donationWillingness: z.string().optional().default('regular'),
  willingness: z.string().optional(),
  contactConsent: z.boolean().optional(),
  contactSharingConsent: z.boolean().optional(),
  privacyAcknowledged: z.boolean().optional().default(true),
  termsAccepted: z.boolean().optional().default(true),
});

export const updateDonorSchema = z.object({
  fullName: z.string().optional(),
  country: z.string().length(2).optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  donationWillingness: z.enum(['regular', 'emergency_only', 'occasional']).optional(),
  isAvailable: z.boolean().optional(),
});

export const reportDonorSchema = z.object({
  reason: z.string().min(5, 'Please provide a clear reason for reporting'),
});

export const donorListQuerySchema = z.object({
  search: z.string().optional(),
  bloodGroup: z.string().optional(),
  status: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  district: z.string().optional(),
  page: z.string().regex(/^\d+$/).default('1').transform(Number),
  pageSize: z.string().regex(/^\d+$/).default('10').transform(Number),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type DonorRegistrationPayload = z.infer<typeof donorRegistrationSchema>;
export type UpdateDonorPayload = z.infer<typeof updateDonorSchema>;
export type ReportDonorPayload = z.infer<typeof reportDonorSchema>;
export type DonorListQueryParams = z.infer<typeof donorListQuerySchema>;
