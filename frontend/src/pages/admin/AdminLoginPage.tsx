import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Mail, Lock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { errorMessage } from '../../utils/formErrors';

const adminLoginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'Enter your admin email or mobile number.')
    .refine(
      (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) || /^[\d\s+\-()]{7,20}$/.test(val),
      'Enter a valid email address or mobile number.',
    ),
  password: z.string().min(1, 'Enter your password.'),
});
type AdminLoginForm = z.infer<typeof adminLoginSchema>;

/** Admin sign-in: email or mobile number + password */
export const AdminLoginPage: React.FC = () => {
  const { login, loginAsDemoAdmin, logout, isDemo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authError, setAuthError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
  const target = from && from.startsWith('/admin') ? from : '/admin/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdminLoginForm>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const onSubmit = async (data: AdminLoginForm) => {
    setAuthError(null);
    try {
      const session = await login({ identifier: data.identifier.trim(), password: data.password });
      if (session.user.role !== 'admin') {
        // Signed in as a regular member: don't keep that session on the admin page
        await logout().catch(() => undefined);
        setAuthError('This account is not an admin account. Please use the member sign-in page.');
        return;
      }
      navigate(target, { replace: true });
    } catch (err: unknown) {
      setAuthError(errorMessage(err, 'Sign-in failed. Please check your email / mobile number and password.'));
    }
  };

  const handleDemoAdmin = async () => {
    setAuthError(null);
    await loginAsDemoAdmin();
    navigate('/admin/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center ring-2 ring-amber-500/40">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">BloodNation Admin</h1>
          <p className="text-xs text-slate-400">Sign in to manage requests, donors and safety reviews</p>
        </div>

        <Card className="shadow-2xl">
          <CardContent className="p-6 sm:p-8 space-y-5">
            {authError && <ErrorBanner title="Could not sign in" message={authError} />}

            <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                id="admin-identifier"
                label="Email or mobile number"
                placeholder="admin@bloodbridge.org"
                autoComplete="username"
                inputMode="email"
                required
                leftIcon={<Mail className="w-4 h-4" />}
                error={errors.identifier?.message}
                {...register('identifier')}
              />

              <Input
                id="admin-password"
                label="Password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                leftIcon={<Lock className="w-4 h-4" />}
                error={errors.password?.message}
                {...register('password')}
              />

              <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting} className="w-full justify-center font-bold">
                Sign in
              </Button>
            </form>

            {/* Demo mode only (sample data, no real backend) */}
            {isDemo && (
              <div className="pt-4 border-t border-line-border">
                <Button variant="outline" size="sm" onClick={handleDemoAdmin} className="w-full justify-center text-xs">
                  Demo: sign in as the sample admin
                </Button>
              </div>
            )}

            <div className="text-center pt-2 border-t border-line-border">
              <Link to="/auth/login" className="text-xs text-ink-secondary hover:text-ink-main inline-flex items-center min-h-[44px]">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Back to member sign-in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
