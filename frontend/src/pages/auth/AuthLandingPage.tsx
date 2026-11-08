import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Heart,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Mail,
  Lock,
  User,
  Calendar,
  CheckCircle2,
  RotateCw,
  AlertCircle,
  KeyRound,
  UserCheck,
  Share2,
  Clipboard,
  Gift,
  Sparkles,
  Phone,
  Droplet,
} from 'lucide-react';
import { signInSchema, signUpSchema, type SignInFormData, type SignUpFormData, type SignUpFormInput } from '../../schemas/authSchemas';
import { useAuth } from '../../hooks/useAuth';
import { IDLE_LOGOUT_FLAG } from '../../hooks/useIdleSession';
import { appConfig } from '../../constants/config';
import { referralService } from '../../services';
import type { ReferralCodeValidation } from '../../types/referral';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Checkbox } from '../../components/ui/Checkbox';
import { Card, CardContent } from '../../components/ui/Card';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Select } from '../../components/ui/Select';
import { LocationFields, PhoneField, type LocationValue } from '../../components/forms/LocationFields';
import { GoogleButton } from '../../components/forms/GoogleButton';
import { applyFieldErrors, getFieldErrors, errorMessage, errorTitle } from '../../utils/formErrors';
import {
  countryOrDefault,
  getEnabledCountries,
  getPreferredCountryCode,
  setPreferredCountryCode,
  normalizePhone,
} from '../../constants/countries';

interface AuthLandingPageProps {
  initialTab?: 'signin' | 'signup' | 'referral';
}

/**
 * Extracts clean referral code from raw input (supports full URLs, paths, or raw codes)
 * e.g. "http://localhost:5173/join/SAVIOR-MV2026?ref=1" -> "SAVIOR-MV2026"
 * e.g. "/join/SAVIOR-MV2026" -> "SAVIOR-MV2026"
 * e.g. "SAVIOR-MV2026" -> "SAVIOR-MV2026"
 */
function extractReferralCode(raw: string): string {
  if (!raw) return '';
  let str = raw.trim();
  if (str.includes('/join/')) {
    const parts = str.split('/join/');
    str = parts[1] || '';
  }
  // Remove query params or trailing path segments
  str = str.split(/[/?#]/)[0] || '';
  return str.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
}

export const AuthLandingPage: React.FC<AuthLandingPageProps> = ({ initialTab = 'signin' }) => {
  const {
    signin,
    signup,
    signupWithReferral,
    verifyLoginOtp,
    resendLoginOtp,
    requestPhoneLoginOtp,
    verifyPhoneLoginOtp,
    verifyEmail,
    resendVerification,
    loginAsDemoUser,
    loginAsDemoAdmin,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  // Determine initial tab from props or query param ?tab=signup / ?tab=signin / ?tab=referral
  const queryParams = new URLSearchParams(location.search);
  const rawTab = queryParams.get('tab');
  const codeFromQuery = queryParams.get('referral') || queryParams.get('ref') || queryParams.get('code') || '';
  
  const tabFromQuery = rawTab === 'signup' 
    ? 'signup' 
    : rawTab === 'referral' || Boolean(codeFromQuery)
    ? 'referral' 
    : rawTab === 'signin' 
    ? 'signin' 
    : initialTab;

  const [activeTab, setActiveTab] = useState<'signin' | 'signup' | 'referral'>(tabFromQuery);
  const [authStep, setAuthStep] = useState<'form' | 'login_otp' | 'email_verification' | 'phone_otp'>('form');
  // Sign-in method: email/phone + password, or "Login with mobile number" (one-time code)
  const [loginMethod, setLoginMethod] = useState<'password' | 'mobile'>('password');
  const [mobileLoginNumber, setMobileLoginNumber] = useState<string>('');
  const [mobileLoginError, setMobileLoginError] = useState<string | undefined>(undefined);
  const [isSendingMobileCode, setIsSendingMobileCode] = useState<boolean>(false);
  const [challengePhone, setChallengePhone] = useState<string>('');
  const [challengeDestination, setChallengeDestination] = useState<string>('');
  const [challengeEmail, setChallengeEmail] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [authError, setAuthErrorText] = useState<string | null>(null);
  const [authErrorTitle, setAuthErrorTitle] = useState<string | undefined>(undefined);
  const setAuthError = (message: string | null, title?: string) => {
    setAuthErrorText(message);
    setAuthErrorTitle(title);
  };
  // Field-level messages for the Referral tab (it does not use react-hook-form)
  const [referralErrors, setReferralErrors] = useState<Record<string, string>>({});
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [calculatedAge, setCalculatedAge] = useState<number | null>(null);

  // Referral states - Basic details without OTP
  const [referralInput, setReferralInput] = useState<string>(codeFromQuery || '');
  const [referralFullName, setReferralFullName] = useState<string>('');
  const [referralPhone, setReferralPhone] = useState<string>('');
  const [referralBloodGroup, setReferralBloodGroup] = useState<string>('O+');
  const [referralLocation, setReferralLocation] = useState<LocationValue>({
    country: getPreferredCountryCode(),
    state: '',
    district: '',
  });
  const [isJoiningWithReferral, setIsJoiningWithReferral] = useState<boolean>(false);
  const [isValidatingReferral, setIsValidatingReferral] = useState<boolean>(false);
  const [validatedReferral, setValidatedReferral] = useState<ReferralCodeValidation | null>(null);
  const [appliedReferralCode, setAppliedReferralCode] = useState<string>(extractReferralCode(codeFromQuery || ''));

  // Where to go after signing in: the page they came from (also after an idle sign-out)
  const fromQuery = queryParams.get('from') || '';
  const safeFromQuery = fromQuery.startsWith('/') && !fromQuery.startsWith('//') && !fromQuery.startsWith('/auth') ? fromQuery : '';
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || safeFromQuery || '/app/dashboard';
  const goAfterSignIn = (role?: string) => {
    const target = role === 'admin' && !from.startsWith('/admin') ? '/admin/dashboard' : role !== 'admin' && from.startsWith('/admin') ? '/app/dashboard' : from;
    navigate(target, { replace: true });
  };

  // Signed out after 5 minutes without activity: say so once
  // Shown only once, right after the automatic sign-out (not again on refresh)
  useEffect(() => {
    if (queryParams.get('reason') !== 'idle') return;
    let justSignedOut = false;
    try {
      justSignedOut = sessionStorage.getItem(IDLE_LOGOUT_FLAG) === '1';
      sessionStorage.removeItem(IDLE_LOGOUT_FLAG);
    } catch {
      /* storage unavailable */
    }
    if (justSignedOut) {
      setSuccessNotice(null);
      setAuthError('For your safety you were signed out after 5 minutes of inactivity. Please sign in again.', 'Session ended');
    }
    // Remove ?reason=idle from the address bar (keep ?from=) so a refresh doesn't bring the message back
    const params = new URLSearchParams(location.search);
    params.delete('reason');
    const qs = params.toString();
    window.history.replaceState(window.history.state, '', `${location.pathname}${qs ? `?${qs}` : ''}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cooldown timer
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Sign In Form
  const {
    register: registerSignIn,
    handleSubmit: handleSignInSubmit,
    setValue: setSignInValue,
    formState: { errors: signInErrors, isSubmitting: isSignInSubmitting },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  // Sign Up Form
  const {
    register: registerSignUp,
    handleSubmit: handleSignUpSubmit,
    watch: watchSignUp,
    setValue: setSignUpValue,
    setError: setSignUpError,
    formState: { errors: signUpErrors, isSubmitting: isSignUpSubmitting },
  } = useForm<SignUpFormInput, unknown, SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      username: '',
      dateOfBirth: '2000-01-15',
      email: '',
      password: '',
      confirmPassword: '',
      referralCode: appliedReferralCode,
      termsAccepted: true,
      country: getPreferredCountryCode(),
      phone: '',
    },
  });

  // Watch DOB to calculate age live
  const dobValue = watchSignUp('dateOfBirth');
  useEffect(() => {
    if (dobValue) {
      const birth = new Date(dobValue);
      if (!isNaN(birth.getTime())) {
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
        setCalculatedAge(age >= 0 ? age : null);
      } else {
        setCalculatedAge(null);
      }
    }
  }, [dobValue]);

  // If query had referral code, validate on mount
  useEffect(() => {
    if (codeFromQuery) {
      runValidateReferral(codeFromQuery);
    }
  }, [codeFromQuery]);

  // 1. Handle Sign In
  const onSignIn = async (data: SignInFormData) => {
    setAuthError(null);
    setSuccessNotice(null);
    try {
      const identifier = data.identifier.trim();
      const result = await signin({
        identifier,
        password: data.password,
      });

      // The code is always emailed; when someone signs in with a phone number we show a masked address
      setChallengeEmail(result.email || identifier);

      if (result.requiresEmailVerification) {
        setAuthStep('email_verification');
        setResendCooldown(60);
        setSuccessNotice('Account not yet verified. An activation code has been dispatched to your email.');
      } else if (result.requiresOtp) {
        setAuthStep('login_otp');
        setResendCooldown(60);
        setSuccessNotice(
          result.maskedEmail && !identifier.includes('@')
            ? `Verification code sent to ${result.maskedEmail}. Please check your inbox.`
            : 'Verification code dispatched. Please check your inbox.',
        );
      } else {
        goAfterSignIn(result.user?.role);
      }
    } catch (err: unknown) {
      setAuthError(errorMessage(err, 'Sign-in failed. Please check your email / mobile number and password.'), errorTitle(err));
    }
  };

  // 1b. "Login with mobile number": send a one-time code
  const sendMobileLoginCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setAuthError(null);
    setSuccessNotice(null);
    setMobileLoginError(undefined);
    const country = countryOrDefault(getPreferredCountryCode());
    const phone = normalizePhone(country.code, mobileLoginNumber);
    if (!mobileLoginNumber.trim()) {
      setMobileLoginError('Enter your mobile number.');
      return;
    }
    if (!phone) {
      setMobileLoginError(`Enter a valid ${country.phoneHint} (e.g. ${country.phoneExample}).`);
      return;
    }
    setIsSendingMobileCode(true);
    try {
      const res = await requestPhoneLoginOtp({ phone });
      setChallengePhone(phone);
      setChallengeDestination(
        res.deliveredVia === 'sms' ? res.maskedPhone || phone : `${res.maskedEmail || 'your registered email'} (SMS coming soon)`,
      );
      setOtpCode('');
      setAuthStep('phone_otp');
      setResendCooldown(res.resendCooldownSeconds || 60);
      setSuccessNotice(res.message);
    } catch (err: unknown) {
      const fieldErr = getFieldErrors(err).phone;
      if (fieldErr) setMobileLoginError(fieldErr);
      else setAuthError(errorMessage(err, 'Could not send the code. Please try again.'), errorTitle(err));
    } finally {
      setIsSendingMobileCode(false);
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setAuthError('Please enter the 6-digit code.');
      return;
    }
    setAuthError(null);
    setIsVerifyingOtp(true);
    try {
      const session = await verifyPhoneLoginOtp({ phone: challengePhone, code: otpCode.trim() });
      setSuccessNotice('Signed in! Taking you to your dashboard...');
      goAfterSignIn(session.user.role);
    } catch (err: unknown) {
      setAuthError(errorMessage(err, 'That code is not valid or has expired. Please try again.'), 'Code not accepted');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // 2. Handle Sign Up
  const onSignUp = async (data: SignUpFormData) => {
    setAuthError(null);
    setSuccessNotice(null);
    try {
      const result = await signup({
        username: data.username.trim(),
        dateOfBirth: data.dateOfBirth,
        email: data.email.trim(),
        password: data.password,
        confirmPassword: data.confirmPassword,
        referralCode: data.referralCode || appliedReferralCode || undefined,
        termsAccepted: data.termsAccepted,
        country: data.country,
        phone: normalizePhone(data.country, data.phone) || data.phone,
      });

      setChallengeEmail(result.email || data.email.trim());
      setAuthStep('email_verification');
      setResendCooldown(60);
      setSuccessNotice(result.message || 'Account created! Verification code sent to your email.');
    } catch (err: unknown) {
      // Show the message under the field to fix (e.g. "This mobile number is already registered")
      const shown = applyFieldErrors(err, setSignUpError, [
        'username',
        'dateOfBirth',
        'email',
        'country',
        'phone',
        'password',
        'confirmPassword',
        'referralCode',
      ] as const);
      setAuthError(
        shown ? 'Please fix the highlighted field and try again.' : errorMessage(err, 'Sign-up failed. Please check your details.'),
        errorTitle(err),
      );
    }
  };

  // 3. Handle Verify Login OTP
  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setAuthError('Please enter the 6-digit numeric verification code.');
      return;
    }
    setAuthError(null);
    setIsVerifyingOtp(true);
    try {
      const session = await verifyLoginOtp({
        email: challengeEmail,
        code: otpCode.trim(),
      });
      setSuccessNotice('Login verified! Redirecting to BloodConnect dashboard...');
      setTimeout(() => {
        if (session.user.role === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      }, 1000);
    } catch (err: unknown) {
      setAuthError(errorMessage(err, 'That code is not valid or has expired. Please try again.'), 'Code not accepted');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // 4. Handle Verify Email Registration OTP
  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setAuthError('Please enter the 6-digit numeric verification code.');
      return;
    }
    setAuthError(null);
    setIsVerifyingOtp(true);
    try {
      const session = await verifyEmail({
        email: challengeEmail,
        code: otpCode.trim(),
      });
      setSuccessNotice('Email verified successfully! Welcome to BloodConnect.');
      setTimeout(() => {
        if (session.user.role === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/app/dashboard', { replace: true });
        }
      }, 1000);
    } catch (err: unknown) {
      setAuthError(errorMessage(err, 'That code is not valid or has expired. Please try again.'), 'Code not accepted');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;
    setAuthError(null);
    setIsResending(true);
    try {
      if (authStep === 'phone_otp') {
        const res = await requestPhoneLoginOtp({ phone: challengePhone });
        setSuccessNotice(res.message);
      } else if (authStep === 'login_otp') {
        const res = await resendLoginOtp({ email: challengeEmail });
        setSuccessNotice(res.message || 'A fresh login OTP has been sent to your email.');
      } else {
        const res = await resendVerification({ email: challengeEmail });
        setSuccessNotice(res.message || 'A fresh account verification code has been sent.');
      }
      setResendCooldown(60);
    } catch (err: unknown) {
      setAuthError(errorMessage(err, 'Could not resend the code. Please wait a minute and try again.'), 'Could not resend');
    } finally {
      setIsResending(false);
    }
  };

  // 5. Validate Referral Code / Invitation Link
  const runValidateReferral = async (inputStr: string) => {
    const cleanCode = extractReferralCode(inputStr);
    if (!cleanCode) {
      setAuthError('Please paste a valid referral invitation link or enter a referral code.');
      return;
    }

    setAuthError(null);
    setIsValidatingReferral(true);
    setValidatedReferral(null);

    try {
      const result = await referralService.validateReferralCode(cleanCode);
      if (result.isValid) {
        setValidatedReferral(result);
        setAppliedReferralCode(cleanCode);
        setSignUpValue('referralCode', cleanCode);
        setSuccessNotice(`Valid invitation from ${result.referrerName || 'Community Savior'}!`);
      } else {
        setAuthError(result.message || 'This referral code is invalid or has expired.');
      }
    } catch {
      setAuthError('Unable to validate invitation code. Please check the link and try again.');
    } finally {
      setIsValidatingReferral(false);
    }
  };

  const handleReferralSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runValidateReferral(referralInput);
  };

  // Paste from clipboard handler
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setReferralInput(text);
        runValidateReferral(text);
      }
    } catch {
      // Clipboard API might be restricted by browser policy; user can manually paste
    }
  };

  // Referral join: live app continues on the full registration form (email code required); demo joins directly
  const handleDirectReferralJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = extractReferralCode(referralInput || appliedReferralCode || (validatedReferral?.code || ''));
    const referralCountry = countryOrDefault(referralLocation.country);
    const normalizedReferralPhone = normalizePhone(referralCountry.code, referralPhone);

    // Check every required field and show each message under its field
    const problems: Record<string, string> = {};
    if (!code) problems.referralCode = 'Enter your referral code or paste the invitation link.';
    if (referralFullName.trim().length < 2) problems.fullName = 'Enter your full name (at least 2 letters).';
    if (!referralPhone.trim()) problems.phone = 'Enter your mobile number.';
    else if (!normalizedReferralPhone) {
      problems.phone = `Enter a valid ${referralCountry.phoneHint} (e.g. ${referralCountry.phoneExample}).`;
    }
    if (!referralLocation.state) problems.state = `Choose your ${referralCountry.regionLabel.toLowerCase()}.`;
    if (!referralLocation.district.trim()) problems.district = `Choose your ${referralCountry.districtLabel.toLowerCase()}.`;
    setReferralErrors(problems);
    if (Object.keys(problems).length) {
      setAuthError(null);
      return;
    }

    setAuthError(null);

    // Live app: every new account must confirm an emailed code, so continue on the full registration form
    if (appConfig.isApi) {
      sessionStorage.setItem(
        `bftd_reg_draft_${code}`,
        JSON.stringify({
          fullName: referralFullName.trim(),
          phone: referralPhone.trim(),
          email: '',
          bloodGroup: referralBloodGroup,
          country: referralCountry.code,
          state: referralLocation.state,
          district: referralLocation.district.trim(),
          city: '',
          postalCode: '',
          willingness: 'regular',
          contactSharingConsent: false,
          privacyAcknowledged: false,
          termsAccepted: false,
          referralCode: code,
        }),
      );
      navigate(`/join/${code}/register`);
      return;
    }

    setIsJoiningWithReferral(true);
    try {
      const session = await signupWithReferral({
        referralCode: code,
        fullName: referralFullName.trim(),
        name: referralFullName.trim(),
        phone: normalizedReferralPhone ?? undefined,
        phoneNumber: normalizedReferralPhone ?? undefined,
        bloodGroup: referralBloodGroup,
        country: referralCountry.code,
        state: referralLocation.state,
        district: referralLocation.district.trim(),
      });

      setSuccessNotice(`Welcome, ${session.user.name || 'Savior'}! Joined directly through invitation (No OTP required).`);
      setTimeout(() => {
        if (session.user.role === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      }, 700);
    } catch (err: unknown) {
      const fieldErrors = getFieldErrors(err);
      setReferralErrors(fieldErrors);
      setAuthError(
        Object.keys(fieldErrors).length
          ? errorMessage(err)
          : errorMessage(err, 'Could not join with this invitation. Please check your referral code.'),
        errorTitle(err),
      );
    } finally {
      setIsJoiningWithReferral(false);
    }
  };

  // 1-Tap Quick Demo Donor
  const handleQuickDemoDonor = () => {
    setSignInValue('identifier', 'marcus.vance@example.org');
    setSignInValue('password', 'Password123!');
  };

  // 1-Tap Quick Demo Admin
  const handleQuickDemoAdmin = () => {
    setSignInValue('identifier', 'admin@bloodbridge.org');
    setSignInValue('password', 'AdminPassword2026!');
  };

  return (
    <Card className="shadow-xl border-line-border overflow-hidden bg-white">
      {/* Brand Header */}
      <div className="bg-gradient-to-r from-brand-600 via-brand-500 to-rose-600 p-6 text-white text-center relative">
        <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm mx-auto flex items-center justify-center mb-3 shadow-inner ring-1 ring-white/30">
          <Heart className="w-6 h-6 fill-white text-white animate-pulse" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white">BloodConnect</h1>
        <p className="text-xs text-rose-100 font-medium mt-1">
          Secure Savior &amp; Donor Authentication
        </p>
      </div>

      <CardContent className="p-6 sm:p-8 space-y-6">
        {/* Step: OTP Verification (Login or Account Activation) */}
        {authStep !== 'form' ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 mx-auto flex items-center justify-center shadow-sm">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-ink-main tracking-tight">
                {authStep === 'phone_otp' ? 'Login with Mobile Number' : authStep === 'login_otp' ? 'Two-Factor Authentication' : 'Verify Your Email'}
              </h2>
              <p className="text-xs text-ink-secondary leading-relaxed max-w-xs mx-auto">
                {authStep === 'phone_otp'
                  ? 'Enter the 6-digit sign-in code sent to:'
                  : authStep === 'login_otp'
                  ? 'To protect savior records, enter the single-use 6-digit code sent to:'
                  : 'Enter the 6-digit account activation code sent to:'}
                <br />
                <strong className="text-ink-main font-semibold">
                  {authStep === 'phone_otp' ? challengeDestination : challengeEmail}
                </strong>
              </p>
            </div>

            {authError && <ErrorBanner title={authErrorTitle} message={authError} />}

            {successNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successNotice}</span>
              </div>
            )}

            <form
              onSubmit={
                authStep === 'phone_otp' ? handleVerifyPhoneOtp : authStep === 'login_otp' ? handleVerifyLoginOtp : handleVerifyEmailOtp
              }
              className="space-y-5"
            >
              <div>
                <label htmlFor="otp-code-input" className="block text-xs font-semibold text-ink-secondary uppercase tracking-wider text-center mb-2">
                  6-Digit Verification Code
                </label>
                <input
                  id="otp-code-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="------"
                  className="w-full text-center text-3xl tracking-[0.5em] font-mono font-black py-3 px-4 border-2 border-line-border rounded-xl focus:border-brand-500 focus:ring-4 focus:ring-brand-100 transition-all text-ink-main"
                  autoFocus
                />
                <p className="text-[11px] text-ink-muted text-center mt-2">
                  Code expires in 5 minutes &bull; Maximum 5 verification attempts
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isVerifyingOtp}
                className="w-full justify-center shadow-md font-bold"
              >
                {authStep === 'phone_otp' ? 'Verify & Sign In' : authStep === 'login_otp' ? 'Verify & Access Dashboard' : 'Activate Account & Continue'}
              </Button>

              <div className="flex items-center justify-between text-xs text-ink-secondary pt-2">
                <span>Didn&apos;t receive code?</span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isResending}
                  className="font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-40 disabled:pointer-events-none inline-flex items-center min-h-[44px] px-2 rounded"
                >
                  <RotateCw className={`w-3.5 h-3.5 mr-1 ${isResending ? 'animate-spin' : ''}`} />
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>

              <div className="text-center pt-2 border-t border-line-border">
                <button
                  type="button"
                  onClick={() => {
                    setAuthStep('form');
                    setOtpCode('');
                    setAuthError(null);
                    setSuccessNotice(null);
                  }}
                  className="text-xs text-ink-secondary hover:text-brand-600 font-semibold"
                >
                  &larr; Return to {activeTab === 'signin' ? 'Sign In' : activeTab === 'signup' ? 'Sign Up' : 'Referral Option'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Step: Form Selection (Sign In, Sign Up, or Referral Invitation) */
          <>
            {/* 3 Options Tab Selector */}
            <div className="flex rounded-xl bg-gray-100 p-1 text-xs sm:text-sm font-semibold shadow-inner gap-1">
              <button
                type="button"
                id="auth-tab-signin"
                onClick={() => {
                  setActiveTab('signin');
                  setAuthError(null);
                  setSuccessNotice(null);
                }}
                className={`flex-1 py-2 px-1 text-center rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'signin'
                    ? 'bg-white text-brand-600 shadow-sm font-bold ring-1 ring-black/5'
                    : 'text-ink-secondary hover:text-ink-main'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Sign In
              </button>

              <button
                type="button"
                id="auth-tab-signup"
                onClick={() => {
                  setActiveTab('signup');
                  setAuthError(null);
                  setSuccessNotice(null);
                }}
                className={`flex-1 py-2 px-1 text-center rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'signup'
                    ? 'bg-white text-brand-600 shadow-sm font-bold ring-1 ring-black/5'
                    : 'text-ink-secondary hover:text-ink-main'
                }`}
              >
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Sign Up
              </button>

              <button
                type="button"
                id="auth-tab-referral"
                onClick={() => {
                  setActiveTab('referral');
                  setAuthError(null);
                  setSuccessNotice(null);
                }}
                className={`flex-1 py-2 px-1 text-center rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'referral'
                    ? 'bg-white text-brand-600 shadow-sm font-bold ring-1 ring-black/5'
                    : 'text-ink-secondary hover:text-ink-main'
                }`}
              >
                <Gift className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                Referral
              </button>
            </div>

            {authError && <ErrorBanner title={authErrorTitle} message={authError} />}

            {successNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successNotice}</span>
              </div>
            )}

            {/* TAB 1: SIGN IN */}
            {activeTab === 'signin' && loginMethod === 'mobile' && (
              <form noValidate onSubmit={sendMobileLoginCode} className="space-y-4">
                <GoogleButton label="Sign in with Google" onError={setAuthError} />

                <PhoneField
                  id="mobile-login-number"
                  countryCode={getPreferredCountryCode()}
                  autoComplete="tel-national"
                  required
                  value={mobileLoginNumber}
                  onChange={(e) => {
                    setMobileLoginNumber(e.target.value);
                    setMobileLoginError(undefined);
                  }}
                  error={mobileLoginError}
                  helperText="We'll send a 6-digit code to sign you in. No password needed."
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isSendingMobileCode}
                  className="w-full justify-center mt-2 shadow-md font-bold"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Send Code
                </Button>

                <button
                  type="button"
                  id="use-password-login"
                  onClick={() => {
                    setLoginMethod('password');
                    setAuthError(null);
                    setMobileLoginError(undefined);
                  }}
                  className="w-full text-center text-xs font-semibold text-brand-600 hover:text-brand-700 min-h-[44px]"
                >
                  &larr; Sign in with email / mobile and password instead
                </button>
              </form>
            )}

            {activeTab === 'signin' && loginMethod === 'password' && (
              <form noValidate onSubmit={handleSignInSubmit(onSignIn)} className="space-y-4">
                <GoogleButton label="Sign in with Google" onError={setAuthError} />

                <Input
                  id="signin-identifier"
                  label="Email or Mobile Number"
                  type="text"
                  inputMode="email"
                  placeholder="e.g. priya@gmail.com or 98765 43210"
                  autoComplete="username"
                  required
                  leftIcon={<Mail className="w-4 h-4" />}
                  helperText="Use the email or mobile number on your account."
                  error={signInErrors.identifier?.message}
                  {...registerSignIn('identifier')}
                />

                <div className="space-y-1">
                  <Input
                    label="Password"
                    type="password"
                    placeholder="Enter your account password"
                    autoComplete="current-password"
                    required
                    leftIcon={<Lock className="w-4 h-4" />}
                    error={signInErrors.password?.message}
                    {...registerSignIn('password')}
                  />
                  <div className="flex justify-end pt-1">
                    <Link
                      to="/auth/forgot-password"
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700 focus:outline-none"
                    >
                      Forgot password?
                    </Link>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isSignInSubmitting}
                  className="w-full justify-center mt-2 shadow-md font-bold"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Sign In
                </Button>

                <div className="flex items-center gap-3 text-[11px] text-ink-muted uppercase tracking-wider">
                  <span className="h-px flex-1 bg-line-border" />
                  or
                  <span className="h-px flex-1 bg-line-border" />
                </div>

                <Button
                  type="button"
                  id="mobile-login-button"
                  variant="secondary"
                  size="lg"
                  className="w-full justify-center font-bold"
                  leftIcon={<Phone className="w-4 h-4" />}
                  onClick={() => {
                    setLoginMethod('mobile');
                    setAuthError(null);
                    setSuccessNotice(null);
                  }}
                >
                  Login with Mobile Number (OTP)
                </Button>

                {/* Quick Invitation Referral Callout */}
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
                  <div className="flex items-center space-x-2">
                    <Gift className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Have an invitation link or referral code?</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('referral');
                      setAuthError(null);
                    }}
                    className="font-bold text-amber-800 hover:text-amber-900 underline ml-2"
                  >
                    Paste Here &rarr;
                  </button>
                </div>

                {/* 1-Tap Credentials Pill for Convenience */}
                <div className="pt-3 border-t border-line-border space-y-2.5">
                  <div className="flex items-center text-[11px] text-ink-secondary font-semibold uppercase tracking-wider text-amber-800">
                    <ShieldAlert className="w-3.5 h-3.5 mr-1 text-amber-600" />
                    Quick Test Credentials (1-Tap):
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleQuickDemoDonor}
                      className="p-2.5 rounded-lg border border-brand-200 bg-brand-50/70 hover:bg-brand-100 text-left transition-colors text-xs"
                    >
                      <div className="font-bold text-brand-700">Marcus Vance</div>
                      <div className="text-[10px] text-ink-secondary">Donor (O+ Universal)</div>
                      <div className="text-[9px] text-brand-600 font-mono mt-0.5">Password123!</div>
                    </button>

                    <button
                      type="button"
                      onClick={handleQuickDemoAdmin}
                      className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/70 hover:bg-amber-100 text-left transition-colors text-xs"
                    >
                      <div className="font-bold text-amber-800">Dr. Evelyn Reed</div>
                      <div className="text-[10px] text-ink-secondary">Operations Lead (Admin)</div>
                      <div className="text-[9px] text-amber-700 font-mono mt-0.5">AdminPassword2026!</div>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* TAB 2: SIGN UP */}
            {activeTab === 'signup' && (
              <form noValidate onSubmit={handleSignUpSubmit(onSignUp)} className="space-y-4">
                <GoogleButton label="Sign up with Google" country={watchSignUp('country')} onError={setAuthError} />

                {/* Active referral badge if applied */}
                {appliedReferralCode && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Invitation Attached: <strong className="font-mono">{appliedReferralCode}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedReferralCode('');
                        setValidatedReferral(null);
                        setSignUpValue('referralCode', '');
                      }}
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 underline font-medium"
                    >
                      Clear
                    </button>
                  </div>
                )}

                <Input
                  label="Username"
                  placeholder="e.g. jordan_savior"
                  required
                  leftIcon={<User className="w-4 h-4" />}
                  helperText="Choose a unique savior handle (letters, numbers, _.-)"
                  error={signUpErrors.username?.message}
                  {...registerSignUp('username')}
                />

                <div>
                  <Input
                    label="Date of Birth"
                    type="date"
                    required
                    leftIcon={<Calendar className="w-4 h-4" />}
                    error={signUpErrors.dateOfBirth?.message}
                    {...registerSignUp('dateOfBirth')}
                  />
                  {calculatedAge !== null && (
                    <div className="mt-1.5 flex items-center text-xs">
                      {calculatedAge >= 18 ? (
                        <span className="inline-flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-medium border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          Age {calculatedAge} &bull; Eligible for voluntary blood donation
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium border border-amber-200">
                          <AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                          Age {calculatedAge} &bull; Youth Advocate (Voluntary donation unlocks at age 18)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <Input
                  label="Email Address"
                  type="email"
                  placeholder="e.g. priya@example.com"
                  required
                  leftIcon={<Mail className="w-4 h-4" />}
                  helperText="A single-use 6-digit verification code will be sent to this email."
                  error={signUpErrors.email?.message}
                  {...registerSignUp('email')}
                />

                <Select
                  id="signup-country"
                  label="Country"
                  required
                  options={getEnabledCountries().map((c) => ({ value: c.code, label: c.name }))}
                  helperText={getEnabledCountries().length === 1 ? 'India only for now. More countries coming soon.' : 'Your donor network and searches are for this country.'}
                  error={signUpErrors.country?.message}
                  {...registerSignUp('country', { onChange: (e) => setPreferredCountryCode(e.target.value) })}
                />

                <PhoneField
                  id="signup-phone"
                  label="Mobile Number"
                  countryCode={watchSignUp('country')}
                  required
                  helperText="You can sign in with this number or your email."
                  error={signUpErrors.phone?.message}
                  {...registerSignUp('phone')}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Password"
                    type="password"
                    placeholder="Min 8 characters"
                    required
                    leftIcon={<Lock className="w-4 h-4" />}
                    error={signUpErrors.password?.message}
                    {...registerSignUp('password')}
                  />

                  <Input
                    label="Confirm Password"
                    type="password"
                    placeholder="Re-type password"
                    required
                    leftIcon={<Lock className="w-4 h-4" />}
                    error={signUpErrors.confirmPassword?.message}
                    {...registerSignUp('confirmPassword')}
                  />
                </div>

                {/* Optional Referral Code Input Field */}
                {!appliedReferralCode && (
                  <Input
                    label="Invitation / Referral Code (Optional)"
                    placeholder="e.g. SAVIOR-AB12 or paste invite link"
                    leftIcon={<Share2 className="w-4 h-4" />}
                    helperText="Paste code or link if you were referred by an existing savior."
                    error={signUpErrors.referralCode?.message}
                    {...registerSignUp('referralCode')}
                  />
                )}

                <div className="pt-2">
                  <Checkbox
                    label={
                      <span className="text-xs text-ink-secondary">
                        I agree to the{' '}
                        <Link to="/terms" target="_blank" className="text-brand-600 underline font-semibold">
                          Terms of Participation
                        </Link>{' '}
                        and{' '}
                        <Link to="/privacy" target="_blank" className="text-brand-600 underline font-semibold">
                          Privacy Policy
                        </Link>
                        .
                      </span>
                    }
                    {...registerSignUp('termsAccepted')}
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isSignUpSubmitting}
                  className="w-full justify-center mt-2 shadow-md font-bold"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Create Account &amp; Send OTP
                </Button>
              </form>
            )}

            {/* TAB 3: JOIN VIA REFERRAL INVITATION (NO OTP - BASIC DETAILS ONLY) */}
            {activeTab === 'referral' && (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 mx-auto flex items-center justify-center shadow-inner">
                    <Gift className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-bold text-ink-main">Join Through Referral Invitation</h2>
                  <p className="text-xs text-ink-secondary max-w-sm mx-auto">
                    Invited by a verified savior? Provide your basic details to activate your account immediately—<strong>no email OTP challenge required</strong>.
                  </p>
                </div>

                {/* Instant Verification Banner */}
                <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-medium flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-800">Quick start:</span> Fill in these details, then finish on the next page and confirm the 6-digit code we email you.
                  </div>
                </div>

                <form noValidate onSubmit={handleDirectReferralJoin} className="space-y-3.5">
                  {/* Referral Code Field */}
                  <div className="space-y-1">
                    <label htmlFor="referral-input" className="block text-xs font-semibold text-ink-main">
                      Referral Code or Invitation Link
                    </label>
                    <div className="relative">
                      <input
                        id="referral-input"
                        type="text"
                        value={referralInput}
                        onChange={(e) => {
                          setReferralInput(e.target.value);
                          setValidatedReferral(null);
                        }}
                        placeholder="e.g. SAVIOR-AB12 or paste invite link"
                        className="block w-full rounded-lg border border-line-border bg-white px-3.5 py-2.5 pr-20 text-xs sm:text-sm text-ink-main placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                        required
                      />
                      <div className="absolute inset-y-1 right-1 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handlePasteClipboard}
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-ink-secondary text-[11px] rounded font-medium flex items-center gap-1 transition-colors"
                          title="Paste from clipboard"
                        >
                          <Clipboard className="w-3 h-3" />
                          Paste
                        </button>
                        <button
                          type="button"
                          onClick={() => runValidateReferral(referralInput)}
                          disabled={isValidatingReferral || !referralInput.trim()}
                          className="px-2 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 text-[11px] rounded font-semibold transition-colors disabled:opacity-50"
                        >
                          {isValidatingReferral ? 'Checking...' : 'Check'}
                        </button>
                      </div>
                    </div>
                    {referralErrors.referralCode && (
                      <p className="mt-1.5 text-xs text-status-error font-medium" role="alert">
                        {referralErrors.referralCode}
                      </p>
                    )}
                  </div>

                  {/* Validated Referral Info Banner if available */}
                  {validatedReferral && validatedReferral.isValid && (
                    <div className="p-2.5 rounded-lg border border-emerald-300 bg-emerald-50 text-xs flex items-center justify-between text-emerald-800">
                      <div className="flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          Invited by: <strong>{validatedReferral.referrerName || 'Community Savior'}</strong> ({validatedReferral.code})
                        </span>
                      </div>
                      <span className="text-[10px] bg-emerald-200/70 text-emerald-900 px-1.5 py-0.5 rounded font-mono font-bold">
                        VERIFIED
                      </span>
                    </div>
                  )}

                  {/* Basic Details: Name */}
                  <Input
                    label="Full Name"
                    placeholder="e.g. Varsha Medha"
                    value={referralFullName}
                    onChange={(e) => setReferralFullName(e.target.value)}
                    error={referralErrors.fullName || referralErrors.name}
                    required
                    leftIcon={<User className="w-4 h-4" />}
                    helperText="Your name as it should appear in your savior donor profile."
                  />

                  {/* Basic Details: Country and Phone Number */}
                  <PhoneField
                    id="referral-phone"
                    label="Mobile Number"
                    countryCode={referralLocation.country}
                    value={referralPhone}
                    onChange={(e) => setReferralPhone(e.target.value)}
                    error={referralErrors.phone}
                    required
                    helperText="Required for emergency blood shortage alerts."
                  />

                  {/* Basic Details: Location (no city or PIN here; added later in profile) */}
                  <LocationFields
                    idPrefix="referral"
                    value={referralLocation}
                    onChange={(changes) => setReferralLocation((prev) => ({ ...prev, ...changes }))}
                    errors={{ state: referralErrors.state, district: referralErrors.district }}
                    showCity={false}
                    showPostalCode={false}
                  />

                  {/* Basic Details: Blood Group */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-ink-main">
                      Blood Group
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as const).map((bg) => (
                        <button
                          key={bg}
                          type="button"
                          onClick={() => setReferralBloodGroup(bg)}
                          className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all text-center ${
                            referralBloodGroup === bg
                              ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                              : 'bg-white text-ink-main border-line-border hover:border-brand-300 hover:bg-brand-50/50'
                          }`}
                        >
                          {bg}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submit Button - NO OTP NEEDED */}
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={isJoiningWithReferral}
                    className="w-full justify-center shadow-md font-bold text-sm mt-2"
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Continue Registration &rarr;
                  </Button>
                </form>

                {/* Demo Quick Test Pill (demo mode only, never on the live site) */}
                {appConfig.isDemo && (
                <div className="pt-3 border-t border-line-border text-center space-y-1.5">
                  <span className="text-[11px] text-ink-secondary block">
                    Need a test code? Join Marcus Vance&apos;s active circle:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setReferralInput('SAVIOR-MV2026');
                      setAppliedReferralCode('SAVIOR-MV2026');
                      runValidateReferral('SAVIOR-MV2026');
                      if (!referralFullName) setReferralFullName('Varsha Medha');
                      if (!referralPhone) setReferralPhone('90000 00301');
                    }}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg border border-brand-200 bg-brand-50 hover:bg-brand-100 text-xs font-mono font-bold text-brand-700 transition-colors gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                    Auto-Fill Test Referral (SAVIOR-MV2026)
                  </button>
                </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
