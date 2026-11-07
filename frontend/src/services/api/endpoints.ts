export const ENDPOINTS = {
  // BloodConnect Auth
  SIGNIN: '/auth/signin',
  SIGNUP: '/auth/signup',
  SIGNUP_REFERRAL: '/auth/signup-referral',
  VERIFY_EMAIL: '/auth/verify-email',
  RESEND_VERIFICATION: '/auth/resend-verification',
  VERIFY_LOGIN_OTP: '/auth/verify-login-otp',
  RESEND_LOGIN_OTP: '/auth/resend-login-otp',
  PHONE_LOGIN_REQUEST: '/auth/phone-login/request',
  PHONE_LOGIN_VERIFY: '/auth/phone-login/verify',
  SESSION_REFRESH: '/auth/session/refresh',

  // Backwards-Compatible Aliases
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  VERIFY_OTP: '/auth/verify-otp',
  REQUEST_OTP: '/auth/request-otp',
  FORGOT_PASSWORD: '/auth/forgot-password',
  VERIFY_RESET_TOKEN: (token: string) => `/auth/verify-reset-token?token=${encodeURIComponent(token)}`,
  RESET_PASSWORD: '/auth/reset-password',
  CHANGE_PASSWORD: '/auth/change-password',
  GOOGLE_AUTH: '/auth/google',
  ME: '/auth/me',
  LOGOUT: '/auth/logout',

  // Donors
  MY_DONORS: '/donors/my-referrals',
  DONOR_BY_ID: (id: string) => `/donors/${id}`,
  REGISTER_DONOR: '/donors/register',
  REPORT_DONOR: (id: string) => `/donors/${id}/report`,

  // Referrals
  VALIDATE_CODE: (code: string) => `/referrals/validate/${code}`,
  REFERRAL_STATS: '/referrals/stats',
  SHARE_REFERRAL: '/referrals/share',

  // Notifications
  NOTIFICATIONS: '/notifications',
  MARK_READ: (id: string) => `/notifications/${id}/read`,
  MARK_ALL_READ: '/notifications/mark-all-read',

  // Profile & Privacy
  PROFILE: '/profile',
  CONSENT_PREFERENCES: '/profile/consent',
  DATA_EXPORT: '/profile/export',
  DELETE_ACCOUNT: '/profile/delete',

  // Support
  SUPPORT_INQUIRY: '/support/inquire',
  FAQS: '/support/faqs',

  // Admin
  ADMIN_METRICS: '/admin/metrics',
  ADMIN_USERS: '/admin/users',
  ADMIN_USER_STATUS: (id: string) => `/admin/users/${id}/status`,
  ADMIN_DONORS: '/admin/donors',
  ADMIN_DONOR_UPDATE: (id: string) => `/admin/donors/${id}`,
  ADMIN_REFERRALS: '/admin/referrals',
  ADMIN_REFERRAL_TOGGLE: (id: string) => `/admin/referrals/${id}/toggle`,
  ADMIN_CONSENTS: '/admin/consents',
  ADMIN_AUDIT_LOGS: '/admin/audit-logs',
  ADMIN_SETTINGS: '/admin/settings',
} as const;
