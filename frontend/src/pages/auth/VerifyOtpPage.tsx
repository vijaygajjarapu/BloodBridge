import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Info, CheckCircle2, RotateCw } from 'lucide-react';
import { verifyOtpSchema, type VerifyOtpFormData } from '../../schemas/authSchemas';
import { authService } from '../../services';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

export const VerifyOtpPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const stateData = location.state as { email?: string; phone?: string; identifier?: string } | undefined;
  const email = stateData?.email || (stateData?.identifier?.includes('@') ? stateData.identifier : '');
  const phone = stateData?.phone || (!stateData?.identifier?.includes('@') ? stateData?.identifier : '');
  const displayIdentifier = email || phone || 'your registered contact';

  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(60);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<VerifyOtpFormData>({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: {
      code: '',
    },
  });

  const onSubmit = async (data: VerifyOtpFormData) => {
    setOtpError(null);
    try {
      await authService.verifyOtp({
        email: email || undefined,
        phone: phone || undefined,
        code: data.code,
      });
      setIsSuccess(true);
      setTimeout(() => {
        navigate('/app/dashboard');
      }, 1500);
    } catch (err: unknown) {
      setOtpError((err as { message?: string })?.message || 'Invalid verification code. Please check and retry.');
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setOtpError(null);
    try {
      const res = await authService.requestOtp(email || phone || displayIdentifier);
      setResendNotice(res.message);
      setResendCooldown(60);
    } catch (err: unknown) {
      setOtpError((err as { message?: string })?.message || 'Failed to dispatch verification code.');
    }
  };

  return (
    <Card className="shadow-lg border-line-border">
      <CardContent className="p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 mx-auto flex items-center justify-center mb-2 shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-ink-main tracking-tight">Verify Your Email</h1>
          <p className="text-xs text-ink-secondary">
            A 6-digit verification code was sent to <strong className="text-ink-main">{email || displayIdentifier}</strong>
          </p>
        </div>

        {/* Demo Helper Banner */}
        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Verification Code:</span> Check your inbox for the OTP. In Demo Mode, you can also enter <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold text-amber-800">123456</code> to verify immediately.
          </div>
        </div>

        {otpError && <ErrorBanner message={otpError} onRetry={() => setOtpError(null)} />}

        {resendNotice && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 font-medium">
            {resendNotice}
          </div>
        )}

        {isSuccess ? (
          <div className="py-6 text-center space-y-2 animate-in fade-in">
            <CheckCircle2 className="w-12 h-12 text-status-success mx-auto" />
            <h3 className="text-base font-bold text-ink-main">Email Verified Successfully!</h3>
            <p className="text-xs text-ink-secondary">Redirecting to your savior dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="6-Digit Verification Code"
              placeholder="123456"
              maxLength={6}
              autoComplete="one-time-code"
              required
              className="text-center text-xl tracking-[0.4em] font-mono font-bold"
              error={errors.code?.message}
              {...register('code')}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              className="w-full justify-center shadow-sm"
            >
              Verify Code &amp; Continue
            </Button>

            <div className="flex items-center justify-between text-xs text-ink-secondary pt-2">
              <span>Didn&apos;t receive email?</span>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-40 disabled:pointer-events-none inline-flex items-center min-h-[44px] px-2 rounded"
              >
                <RotateCw className="w-3 h-3 mr-1" />
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Email OTP'}
              </button>
            </div>
          </form>
        )}

        <div className="pt-2 text-center text-xs text-ink-secondary border-t border-line-border">
          Wrong email address?{' '}
          <Link to="/auth/register" className="font-semibold text-brand-600 hover:text-brand-700 underline">
            Edit Details
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
