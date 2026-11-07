import { z } from 'zod';
import { getEnabledCountries, normalizePhone } from '../constants/countries';

/** A mobile number valid in any supported country */
function normalizeAnyPhone(raw: string): string | null {
  for (const c of getEnabledCountries()) {
    const phone = normalizePhone(c.code, raw);
    if (phone) return phone;
  }
  return null;
}

// Email address OR mobile number
export const signInSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'Enter your email address or mobile number.')
    .refine(
      (val) => (val.includes('@') ? z.string().email().safeParse(val).success : Boolean(normalizeAnyPhone(val))),
      'Enter a valid email address or 10-digit mobile number.',
    ),
  password: z.string().min(1, 'Password is required.'),
});

export type SignInFormData = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters.')
      .max(30, 'Username must not exceed 30 characters.')
      .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens.'),
    dateOfBirth: z
      .string()
      .min(1, 'Date of birth is required.')
      .refine((val) => {
        const d = new Date(val);
        return !isNaN(d.getTime()) && d < new Date();
      }, 'Please enter a valid date of birth in the past.'),
    email: z.string().min(1, 'Email address is required.').email('Please enter a valid email address.'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long.')
      .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
      .regex(/[0-9]/, 'Password must contain at least one number.'),
    confirmPassword: z.string().min(8, 'Please confirm your password.'),
    referralCode: z.string().optional(),
    termsAccepted: z.boolean().optional().default(true),
    country: z.string().min(2, 'Please choose your country.'),
    phone: z.string().min(1, 'Please enter your mobile number.'),
  })
  .refine((data) => Boolean(normalizePhone(data.country, data.phone)), {
    message: 'Enter a valid 10-digit mobile number.',
    path: ['phone'],
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type SignUpFormData = z.infer<typeof signUpSchema>;
/** What the form holds before validation (fields with defaults may be empty) */
export type SignUpFormInput = z.input<typeof signUpSchema>;

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(3, 'Please enter a valid phone number or email address.')
    .refine((val) => {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
      const isPhone = /^[\d\s+\-()]{7,20}$/.test(val);
      return isEmail || isPhone;
    }, 'Enter a valid email address or mobile number (e.g. +91 98765 43210).'),
  password: z.string().min(6, 'Password must be at least 6 characters.').optional().or(z.literal('')),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z.string().min(2, 'Full name must be at least 2 characters.'),
    email: z.string().min(1, 'Please enter your email address.').email('Please enter a valid email address.'),
    phone: z
      .string()
      .min(7, 'Please enter a valid phone number.')
      .regex(/^[\d\s+\-()]{7,20}$/, 'Invalid phone number format.')
      .optional()
      .or(z.literal('')),
    password: z.string().min(8, 'Password must be at least 8 characters long.'),
    confirmPassword: z.string().min(8, 'Please confirm your password.'),
    termsAccepted: z.boolean().refine((val) => val === true, {
      message: 'You must accept the Terms of Service to join.',
    }),
    privacyAcknowledged: z.boolean().refine((val) => val === true, {
      message: 'You must acknowledge the Privacy Policy.',
    }),
    referralCode: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

export const verifyOtpSchema = z.object({
  code: z
    .string()
    .length(6, 'Verification code must be exactly 6 digits.')
    .regex(/^\d{6}$/, 'Code must contain numbers only.'),
});

export type VerifyOtpFormData = z.infer<typeof verifyOtpSchema>;

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(3, 'Please provide your registered phone or email.'),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required.').optional().or(z.literal('')),
    newPassword: z.string().min(8, 'New password must be at least 8 characters long.'),
    confirmPassword: z.string().min(8, 'Please confirm your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters long.'),
    confirmPassword: z.string().min(8, 'Please confirm your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
