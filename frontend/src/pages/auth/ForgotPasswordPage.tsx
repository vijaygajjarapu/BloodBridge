import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '../../schemas/authSchemas';
import { authService } from '../../services';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      identifier: 'marcus.vance@example.org',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setErrorMsg(null);
    try {
      const res = await authService.forgotPassword(data);
      setSuccessInfo(res.message);
    } catch (err: unknown) {
      setErrorMsg((err as { message?: string })?.message || 'Failed to process request. Please try again.');
    }
  };

  return (
    <Card className="shadow-lg border-line-border">
      <CardContent className="p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 mx-auto flex items-center justify-center mb-2 shadow-sm">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-ink-main tracking-tight">Forgot Password</h1>
          <p className="text-xs sm:text-sm text-ink-secondary">
            Enter your registered email address to receive secure password recovery instructions.
          </p>
        </div>

        {errorMsg && <ErrorBanner message={errorMsg} onRetry={() => setErrorMsg(null)} />}

        {successInfo ? (
          <div className="space-y-4 text-center py-4">
            <CheckCircle2 className="w-12 h-12 text-status-success mx-auto" />
            <h3 className="text-base font-bold text-ink-main">Recovery Link Dispatched</h3>
            <p className="text-xs text-ink-secondary bg-gray-50 p-4 rounded-lg border border-line-border leading-relaxed">
              {successInfo}
            </p>
            <p className="text-xs text-ink-secondary">
              Check your email inbox or spam folder for the secure reset link. The link expires in 15 minutes.
            </p>
            <div className="pt-2">
              <Button
                variant="secondary"
                className="w-full justify-center"
                onClick={() => navigate('/auth/login')}
              >
                Return to Sign In
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Registered Mobile or Email"
              placeholder="e.g. marcus.vance@example.org"
              required
              error={errors.identifier?.message}
              {...register('identifier')}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              className="w-full justify-center shadow-sm mt-2"
            >
              Send Recovery Instructions
            </Button>
          </form>
        )}

        <div className="pt-2 text-center text-xs text-ink-secondary border-t border-line-border">
          <Link to="/auth/login" className="inline-flex items-center font-semibold text-brand-600 hover:text-brand-700 min-h-[44px]">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Return to Sign In
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
