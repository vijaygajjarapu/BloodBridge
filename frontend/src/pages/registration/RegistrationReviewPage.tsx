import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, ArrowLeft, ArrowRight, ShieldCheck, Edit3, Heart, Lock, KeyRound, RotateCw } from 'lucide-react';
import type { DonorRegistrationFormData } from '../../schemas/donorSchemas';
import type { BloodGroup } from '../../types/donor';
import { donorService } from '../../services';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { BloodGroupBadge } from '../../components/ui/Badge';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { countryOrDefault, normalizePhone, formatPhone } from '../../constants/countries';
import { getFieldErrors, errorMessage, errorTitle } from '../../utils/formErrors';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { appConfig } from '../../constants/config';

export const RegistrationReviewPage: React.FC = () => {
  const { referralCode = 'SAVIOR-MV2026' } = useParams<{ referralCode: string }>();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorHeading, setErrorHeading] = useState<string | undefined>(undefined);

  // A real account is created: the donor picks a password, then confirms the code emailed to them
  const { verifyEmail, resendVerification } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwErrors, setPwErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [verifyEmailAddress, setVerifyEmailAddress] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | undefined>(undefined);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const rawDraft = sessionStorage.getItem(`bftd_reg_draft_${referralCode}`);
  const data: DonorRegistrationFormData | null = rawDraft ? JSON.parse(rawDraft) : null;

  if (!data) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <Card className="p-8 space-y-4">
          <h2 className="text-lg font-bold text-ink-main">No Registration Data Found</h2>
          <p className="text-xs text-ink-secondary">
            Please start the registration process from the invitation page.
          </p>
          <Link to={`/join/${referralCode}/register`}>
            <Button variant="primary">Start Registration</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const checkPassword = () => {
    const errs: { password?: string; confirmPassword?: string } = {};
    if (!password) errs.password = 'Please create a password.';
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters.';
    else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) errs.password = 'Use at least one letter and one number.';
    if (!confirmPassword) errs.confirmPassword = 'Please type your password again.';
    else if (password && confirmPassword !== password) errs.confirmPassword = 'Passwords do not match.';
    setPwErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setCodeError('Please enter the 6-digit code.');
      return;
    }
    setCodeError(undefined);
    setErrorMsg(null);
    setVerifying(true);
    try {
      await verifyEmail({ email: verifyEmailAddress!, code: code.trim() });
      sessionStorage.removeItem(`bftd_reg_draft_${referralCode}`);
      navigate('/app/dashboard', { replace: true, state: { welcome: data?.fullName } });
    } catch (err: unknown) {
      setCodeError(errorMessage(err, 'That code is not valid or has expired. Please try again.'));
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0 || !verifyEmailAddress) return;
    try {
      const res = await resendVerification({ email: verifyEmailAddress });
      setNotice(res.message || 'A new code has been sent to your email.');
      setCooldown(60);
    } catch (err: unknown) {
      setErrorHeading(errorTitle(err));
      setErrorMsg(errorMessage(err, 'Could not resend the code. Please wait a minute and try again.'));
    }
  };

  const handleConfirmRegistration = async () => {
    if (appConfig.isApi && !checkPassword()) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const result = await donorService.registerDonor({
        ...data,
        // Stored in one standard form, e.g. +919876543210
        phone: normalizePhone(data.country, data.phone) || data.phone,
        bloodGroup: data.bloodGroup as BloodGroup,
        password,
      });
      // New account: confirm the emailed code, then sign in and go to the dashboard
      if (result.requiresVerification) {
        setVerifyEmailAddress(result.email || data.email || '');
        setNotice(result.message);
        setCooldown(60);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      // Clean up draft and pass result
      sessionStorage.removeItem(`bftd_reg_draft_${referralCode}`);
      navigate('/join/success', {
        state: {
          result,
          registeredName: data.fullName,
          bloodGroup: data.bloodGroup,
          referralCodeUsed: referralCode,
        },
      });
    } catch (err: unknown) {
      const fieldErrors = getFieldErrors(err);
      if (fieldErrors.password) {
        setPwErrors({ password: fieldErrors.password });
        return;
      }
      if (Object.keys(fieldErrors).length) {
        // Send the person back to the form with the message shown under the field to fix
        sessionStorage.setItem(
          `bftd_reg_errors_${referralCode}`,
          JSON.stringify({ message: errorMessage(err), fieldErrors }),
        );
        navigate(`/join/${referralCode}/register`);
        return;
      }
      setErrorHeading(errorTitle(err));
      setErrorMsg(errorMessage(err, 'We could not complete your registration. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (verifyEmailAddress) {
    return (
      <div className="max-w-md mx-auto py-10 px-4">
        <Card className="shadow-lg border-line-border">
          <CardContent className="p-6 sm:p-8 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 mx-auto flex items-center justify-center">
                <KeyRound className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold text-ink-main">Confirm your email</h1>
              <p className="text-xs text-ink-secondary">
                Enter the 6-digit code we sent to
                <br />
                <strong className="text-ink-main">{verifyEmailAddress}</strong>
              </p>
            </div>

            {notice && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{notice}</span>
              </div>
            )}
            {errorMsg && <ErrorBanner title={errorHeading} message={errorMsg} />}

            <form noValidate onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label htmlFor="reg-otp-code" className="block text-xs font-semibold text-ink-secondary uppercase tracking-wider text-center mb-2">
                  6-digit code
                </label>
                <input
                  id="reg-otp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ''));
                    setCodeError(undefined);
                  }}
                  placeholder="------"
                  aria-invalid={Boolean(codeError)}
                  className={`w-full text-center text-3xl tracking-[0.5em] font-mono font-black py-3 px-4 border-2 rounded-xl focus:border-brand-500 focus:ring-4 focus:ring-brand-100 ${
                    codeError ? 'border-status-error' : 'border-line-border'
                  }`}
                  autoFocus
                />
                {codeError && (
                  <p className="mt-1.5 text-xs text-status-error font-medium text-center" role="alert">
                    {codeError}
                  </p>
                )}
              </div>
              <Button type="submit" variant="primary" size="lg" isLoading={verifying} className="w-full justify-center font-bold">
                Activate account &amp; go to dashboard
              </Button>
              <div className="flex items-center justify-between text-xs text-ink-secondary">
                <span>Didn&apos;t get the code? Check spam too.</span>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={cooldown > 0}
                  className="font-semibold text-brand-600 disabled:opacity-40 inline-flex items-center min-h-[44px] px-2"
                >
                  <RotateCw className="w-3.5 h-3.5 mr-1" />
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 sm:py-12 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(`/join/${referralCode}/register`)}
          className="text-xs font-semibold text-ink-secondary hover:text-brand-500 inline-flex items-center min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Edit Registration Info
        </button>
        <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2.5 py-1 rounded-md">
          Step 2 of 2: Final Confirmation
        </span>
      </div>

      <Card className="shadow-lg border-line-border overflow-hidden">
        <div className="p-6 bg-brand-500 text-white flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Review Donor Information</h1>
            <p className="text-xs text-white/90 mt-0.5">
              Confirm your details before activating your savior profile
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
        </div>

        <CardContent className="p-6 sm:p-8 space-y-6">
          {errorMsg && <ErrorBanner title={errorHeading} message={errorMsg} onRetry={handleConfirmRegistration} />}

          {/* Details Table */}
          <div className="bg-gray-50 rounded-xl border border-line-border divide-y divide-line-border text-sm">
            <div className="p-4 flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-secondary">Full Name</span>
              <span className="font-bold text-ink-main">{data.fullName}</span>
            </div>

            <div className="p-4 flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-secondary">Date of Birth</span>
              <span className="font-bold text-ink-main">{data.dateOfBirth || 'Not given: go back and add it'}</span>
            </div>

            <div className="p-4 flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-secondary">Blood Group</span>
              <div className="flex items-center space-x-2">
                <BloodGroupBadge group={data.bloodGroup as BloodGroup} />
                <span className="text-xs text-ink-secondary font-medium">Verified Blood Type</span>
              </div>
            </div>

            <div className="p-4 flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-secondary">Mobile Number</span>
              <span className="font-mono text-ink-main font-semibold">
                {formatPhone(normalizePhone(data.country, data.phone), data.country) || data.phone}
              </span>
            </div>

            {data.email && (
              <div className="p-4 flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-secondary">Email</span>
                <span className="text-ink-main">{data.email}</span>
              </div>
            )}

            <div className="p-4 flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-secondary">Matching Location</span>
              <span className="text-ink-main font-medium">
                {data.city}, {data.district}, {data.state}
                {data.postalCode ? ` ${data.postalCode}` : ''}, {countryOrDefault(data.country).name}
              </span>
            </div>

            <div className="p-4 flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-secondary">Willingness Mode</span>
              <span className="capitalize text-ink-main font-medium">
                {data.willingness?.replace('_', ' ')}
              </span>
            </div>

            <div className="p-4 flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-secondary">Inviting Referral Code</span>
              <span className="font-mono font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                {referralCode}
              </span>
            </div>

            <div className="p-4 flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-secondary">Emergency Contact Consent</span>
              <span className="inline-flex items-center text-xs font-bold text-status-success">
                <ShieldCheck className="w-4 h-4 mr-1" />
                Explicitly Authorized
              </span>
            </div>
          </div>

          {appConfig.isApi && (
            <div className="space-y-3 rounded-xl border border-line-border p-4">
              <div>
                <h2 className="text-sm font-bold text-ink-main">Create your BloodBridge account</h2>
                <p className="text-xs text-ink-secondary">
                  You&apos;ll sign in with {data.email || 'your email'} or your mobile number and this password.
                </p>
              </div>
              <Input
                id="reg-password"
                label="Password"
                type="password"
                autoComplete="new-password"
                required
                leftIcon={<Lock className="w-4 h-4" />}
                helperText="At least 8 characters, with a letter and a number."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPwErrors((p) => ({ ...p, password: undefined }));
                }}
                error={pwErrors.password}
              />
              <Input
                id="reg-confirm-password"
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                required
                leftIcon={<Lock className="w-4 h-4" />}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPwErrors((p) => ({ ...p, confirmPassword: undefined }));
                }}
                error={pwErrors.confirmPassword}
              />
            </div>
          )}

          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
            <span className="font-bold block mb-1">Voluntary Commitment:</span>
            By completing registration, you confirm readiness to be contacted for emergency transfusion shortages in your designated locality.
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => navigate(`/join/${referralCode}/register`)}
              leftIcon={<Edit3 className="w-4 h-4" />}
              className="w-full sm:w-1/3 justify-center"
              disabled={submitting}
            >
              Edit Details
            </Button>

            <Button
              variant="primary"
              size="lg"
              isLoading={submitting}
              onClick={handleConfirmRegistration}
              rightIcon={<ArrowRight className="w-5 h-5" />}
              className="w-full sm:w-2/3 justify-center shadow-md font-bold text-base"
            >
              {appConfig.isApi ? 'Create Account & Send Code' : 'Confirm & Join BloodBridge'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
