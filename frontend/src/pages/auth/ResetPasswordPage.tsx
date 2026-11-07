import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Lock, CheckCircle2, ShieldCheck, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { resetPasswordSchema, type ResetPasswordFormData } from '../../schemas/authSchemas';
import { authService } from '../../services';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenParam = searchParams.get('token') || '';

  const [token, setToken] = useState<string>(tokenParam);
  const [isValidating, setIsValidating] = useState<boolean>(Boolean(tokenParam));
  const [isTokenValid, setIsTokenValid] = useState<boolean | null>(tokenParam ? null : true);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Validate token on component mount if token query param exists
  useEffect(() => {
    let isMounted = true;

    async function validateToken() {
      if (!tokenParam) {
        setIsValidating(false);
        return;
      }

      setIsValidating(true);
      setTokenError(null);

      try {
        const result = await authService.verifyResetToken(tokenParam);
        if (isMounted) {
          setIsTokenValid(result.valid);
          if (result.email) {
            setAccountEmail(result.email);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setIsTokenValid(false);
          setTokenError(
            (err as { message?: string })?.message ||
              'This password reset link is invalid or has expired. Please request a new one.'
          );
        }
      } finally {
        if (isMounted) {
          setIsValidating(false);
        }
      }
    }

    validateToken();

    return () => {
      isMounted = false;
    };
  }, [tokenParam]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: tokenParam,
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setSubmitError(null);
    const activeToken = tokenParam || token || data.token;

    if (!activeToken) {
      setSubmitError('A valid password reset token is required.');
      return;
    }

    try {
      await authService.resetPassword({
        token: activeToken,
        newPassword: data.newPassword,
      });
      setIsSuccess(true);
    } catch (err: unknown) {
      setSubmitError(
        (err as { message?: string })?.message ||
          'Failed to reset password. Please ensure your token has not expired.'
      );
    }
  };

  return (
    <Card className="shadow-lg border-line-border">
      <CardContent className="p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 mx-auto flex items-center justify-center mb-2 shadow-sm">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-ink-main tracking-tight">Set New Password</h1>
          {accountEmail ? (
            <p className="text-xs text-ink-secondary">
              Resetting password for account: <strong className="text-ink-main font-semibold">{accountEmail}</strong>
            </p>
          ) : (
            <p className="text-xs text-ink-secondary">
              Enter your new secure password below to regain account access.
            </p>
          )}
        </div>

        {/* Token Validation Loading State */}
        {isValidating && (
          <div className="py-8 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-brand-600 animate-spin mx-auto" />
            <p className="text-xs text-ink-secondary">Validating your security reset token...</p>
          </div>
        )}

        {/* Invalid or Expired Token State */}
        {!isValidating && isTokenValid === false && (
          <div className="py-4 space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center space-y-2">
              <AlertTriangle className="w-8 h-8 text-status-danger mx-auto" />
              <h3 className="text-sm font-bold text-red-900">Reset Link Expired or Invalid</h3>
              <p className="text-xs text-red-700 leading-relaxed">
                {tokenError ||
                  'This password reset link has expired or has already been used. Password reset links are valid for 15 minutes.'}
              </p>
            </div>

            <Button
              variant="primary"
              className="w-full justify-center shadow-sm"
              onClick={() => navigate('/auth/forgot-password')}
            >
              Request a New Reset Link
            </Button>
          </div>
        )}

        {/* Success State */}
        {!isValidating && isSuccess && (
          <div className="text-center py-6 space-y-4 animate-in fade-in">
            <div className="w-14 h-14 bg-green-50 text-status-success rounded-full flex items-center justify-center mx-auto border border-green-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-ink-main">Password Successfully Changed!</h3>
              <p className="text-xs text-ink-secondary max-w-sm mx-auto leading-relaxed">
                Your BloodBridge account password has been updated. All previous sessions have been securely terminated.
              </p>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                size="lg"
                className="w-full justify-center shadow-sm"
                onClick={() => navigate('/auth/login')}
              >
                Sign In with New Password
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Password Reset Form State */}
        {!isValidating && isTokenValid !== false && !isSuccess && (
          <>
            {submitError && <ErrorBanner message={submitError} onRetry={() => setSubmitError(null)} />}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {!tokenParam && (
                <Input
                  label="Password Reset Token"
                  placeholder="Paste token from reset email"
                  required
                  error={errors.token?.message}
                  {...register('token', {
                    onChange: (e) => setToken(e.target.value),
                  })}
                />
              )}

              <Input
                label="New Password"
                type="password"
                placeholder="Minimum 8 characters"
                required
                autoComplete="new-password"
                error={errors.newPassword?.message}
                {...register('newPassword')}
              />

              <Input
                label="Confirm New Password"
                type="password"
                placeholder="Re-type new password"
                required
                autoComplete="new-password"
                error={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />

              <div className="bg-gray-50 p-3 rounded-lg border border-line-border text-xs text-ink-secondary space-y-1">
                <span className="font-semibold text-ink-main block">Password Security Standards:</span>
                <div className="flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-status-success" />
                  <span>At least 8 characters long</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-status-success" />
                  <span>Cryptographically hashed using scrypt with unique salt</span>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                className="w-full justify-center shadow-sm mt-2"
              >
                Reset Password
              </Button>
            </form>
          </>
        )}

        <div className="pt-2 text-center text-xs text-ink-secondary border-t border-line-border">
          <Link to="/auth/login" className="font-semibold text-brand-600 hover:text-brand-700 underline">
            Cancel &amp; Return to Sign In
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
