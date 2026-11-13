import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Legal entity that owns and operates BloodNation (shown in email footers)
  companyLegalName: process.env.COMPANY_LEGAL_NAME || 'Manjusha Health Tech Pvt Ltd',
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bloodbridge?schema=public',

  // Authentication & JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'bloodbridge-default-jwt-secret-do-not-use-in-production',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  // SMTP Settings
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '', // set in backend/.env (never commit real values)
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
    fromName: process.env.SMTP_FROM_NAME || 'BloodNation',
  },

  // OTP Rules
  otp: {
    ttlSeconds: parseInt(process.env.EMAIL_OTP_TTL_SECONDS || '300', 10),
    maxAttempts: parseInt(process.env.EMAIL_OTP_MAX_ATTEMPTS || '5', 10),
    resendCooldownSeconds: parseInt(process.env.EMAIL_OTP_RESEND_COOLDOWN_SECONDS || '60', 10),
  },

  // Password Reset Rules
  passwordReset: {
    ttlSeconds: parseInt(process.env.PASSWORD_RESET_TTL_SECONDS || '900', 10),
  },

  // Signed-in sessions end after this many minutes without any clicks or typing
  session: {
    idleMinutes: Math.max(1, parseInt(process.env.SESSION_IDLE_MINUTES || '5', 10)),
  },

  // SMS for "Login with mobile number" (empty = send the code by email instead)
  sms: {
    provider: (process.env.SMS_PROVIDER || '').toLowerCase(),
    msg91AuthKey: process.env.MSG91_AUTH_KEY || '',
    msg91TemplateId: process.env.MSG91_TEMPLATE_ID || '',
    // DLT-approved template for emergency alerts with variables ##group##, ##place## and ##link## (empty = no alert SMS)
    msg91AlertTemplateId: process.env.MSG91_ALERT_TEMPLATE_ID || '',
  },

  // Voice calls (masked calling + automatic alert calls). Off until a provider is set up.
  voice: {
    provider: (process.env.VOICE_PROVIDER || '').toLowerCase(), // 'exotel' or empty
    exotelSid: process.env.EXOTEL_SID || '',
    exotelApiKey: process.env.EXOTEL_API_KEY || '',
    exotelApiToken: process.env.EXOTEL_API_TOKEN || '',
    exotelSubdomain: process.env.EXOTEL_SUBDOMAIN || 'api.in.exotel.com', // Mumbai region; api.exotel.com = Singapore
    exotelCallerId: process.env.EXOTEL_CALLER_ID || '', // your ExoPhone (virtual number people see)
    exotelAlertFlowUrl: process.env.EXOTEL_ALERT_FLOW_URL || '', // call flow that reads the alert and asks "press 1 / press 2"
    webhookSecret: process.env.VOICE_WEBHOOK_SECRET || '',
  },

  // Public address of the backend API (used in links sent to call flows)
  publicApiUrl: process.env.PUBLIC_API_URL || 'http://localhost:5000',

  // Family subscription (paid on the website only, never inside mobile apps)
  subscription: {
    amountInr: parseInt(process.env.SUBSCRIPTION_AMOUNT_INR || '200', 10),
    periodMonths: parseInt(process.env.SUBSCRIPTION_PERIOD_MONTHS || '12', 10),
    // Unlock after a company stopped paying, option 2: this amount + GST, ending on the next anniversary
    unlockAmountInr: parseInt(process.env.UNLOCK_AMOUNT_INR || '120', 10),
    gstPercent: parseFloat(process.env.GST_PERCENT || '18'),
  },

  // Razorpay payment gateway (test keys start with rzp_test_)
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    // Optional: a Razorpay Subscriptions plan (yearly, same price) to charge renewals automatically
    planId: process.env.RAZORPAY_PLAN_ID || '',
    // Optional: secret set on the Razorpay webhook (Dashboard -> Webhooks) for renewal events
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  // Google OAuth
  oauth: {
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/v1/auth/google/callback',
  },
};
