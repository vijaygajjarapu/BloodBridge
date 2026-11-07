import { z } from 'zod';
import { countryOrDefault, normalizePhone, isValidPostalCode } from '../constants/countries';

/** Adds country-specific checks (mobile number and PIN / postal code) to a form schema */
function checkCountryFields(
  data: { country?: string; phone?: string; postalCode?: string },
  ctx: z.RefinementCtx,
  opts: { requirePhone: boolean; requirePostalCode: boolean },
) {
  const country = countryOrDefault(data.country);
  if (opts.requirePhone || data.phone) {
    if (!normalizePhone(country.code, data.phone)) {
      ctx.addIssue({
        code: 'custom',
        path: ['phone'],
        message: `Enter a valid ${country.phoneHint} (e.g. ${country.dialCode} ${country.phoneExample}).`,
      });
    }
  }
  const pc = (data.postalCode || '').trim();
  if (pc ? !isValidPostalCode(country.code, pc) : opts.requirePostalCode) {
    ctx.addIssue({
      code: 'custom',
      path: ['postalCode'],
      message: `Enter a valid ${country.postalCodeLabel} (e.g. ${country.postalCodeExample}).`,
    });
  }
}

export const donorRegistrationSchema = z
  .object({
    fullName: z.string().min(2, 'Full legal or preferred name must be at least 2 characters.'),
    country: z.string().min(2, 'Please choose your country.'),
    phone: z.string().min(1, 'Please enter your mobile number.'),
    email: z.string().trim().min(1, 'Please enter your email address. We send a code to it to confirm your account.').email('Please enter a valid email address.'),
    bloodGroup: z.enum(['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']),
    state: z.string().min(1, 'Please select your state.'),
    district: z.string().min(1, 'Please select your district.'),
    city: z.string().min(2, 'Please enter your city, town or village.'),
    postalCode: z.string().min(1, 'Please enter your PIN code.'),
    willingness: z.enum(['emergency_only', 'regular', 'plasma_only', 'undecided']).default('regular'),

    // Consent MUST NOT be preselected and must be actively checked
    contactSharingConsent: z.boolean().refine((val) => val === true, {
      message: 'Explicit contact-sharing consent is required so emergency coordinators can contact you.',
    }),
    privacyAcknowledged: z.boolean().refine((val) => val === true, {
      message: 'You must review and acknowledge the BloodBridge data privacy policy.',
    }),
    termsAccepted: z.boolean().refine((val) => val === true, {
      message: 'You must accept the Savior donor participation terms.',
    }),
    referralCode: z.string().min(3, 'A valid community referral code is required to register.'),
  })
  .superRefine((data, ctx) => checkCountryFields(data, ctx, { requirePhone: true, requirePostalCode: true }));

export type DonorRegistrationFormData = z.infer<typeof donorRegistrationSchema>;
/** What the form holds before validation (fields with defaults may be empty) */
export type DonorRegistrationFormInput = z.input<typeof donorRegistrationSchema>;

export const updateDonorProfileSchema = z
  .object({
    name: z.string().min(2, 'Full name must be at least 2 characters.'),
    email: z.string().email('Please enter a valid email address.').optional().or(z.literal('')),
    phone: z.string().min(1, 'Please enter your mobile number.'),
    bloodGroup: z.enum(['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']),
    country: z.string().min(2, 'Country is required.'),
    state: z.string().min(1, 'State is required.'),
    district: z.string().min(1, 'District is required.'),
    city: z.string().min(2, 'City is required.'),
    postalCode: z.string().optional(),
    willingness: z.enum(['emergency_only', 'regular', 'plasma_only', 'undecided']),
    emergencyAvailability: z.boolean(),
    contactSharingConsent: z.boolean(),
  })
  .superRefine((data, ctx) => checkCountryFields(data, ctx, { requirePhone: true, requirePostalCode: false }));

export type UpdateDonorProfileFormData = z.infer<typeof updateDonorProfileSchema>;
