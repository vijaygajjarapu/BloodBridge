import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Sliders,
  Building2,
  Phone,
  Mail,
  ShieldCheck,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { adminService } from '../../services';
import type { OrganizationSettings } from '../../types/admin';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Checkbox } from '../../components/ui/Checkbox';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

export const AdminSettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OrganizationSettings>();

  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const data = await adminService.getSettings();
        if (isMounted) {
          reset(data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setErrorMsg((err as { message?: string })?.message || 'Failed to load organization settings.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, [reset]);

  const onSubmit = async (data: OrganizationSettings) => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessNotice(false);
    try {
      const updated = await adminService.updateSettings(data);
      reset(updated);
      setSuccessNotice(true);
      setTimeout(() => setSuccessNotice(false), 3000);
    } catch (err: unknown) {
      setErrorMsg((err as { message?: string })?.message || 'Failed to persist organization settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-ink-main tracking-tight">
          Platform Organization &amp; Dispatch Settings
        </h2>
        <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
          Configure emergency helpline routing, support points of contact, and registration policies.
        </p>
      </div>

      {errorMsg && <ErrorBanner message={errorMsg} />}

      {successNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-status-success font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>Organization settings saved and recorded in audit log.</span>
        </div>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-brand-500" />
            <h3 className="text-sm font-bold text-ink-main">Community Organization Profile</h3>
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="Organization Entity Name"
              required
              error={errors.orgName?.message}
              {...register('orgName', { required: 'Organization name is required' })}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Public Support Email"
                type="email"
                required
                error={errors.supportEmail?.message}
                {...register('supportEmail', { required: 'Support email is required' })}
              />

              <Input
                label="Support Helpline"
                type="tel"
                required
                error={errors.supportPhone?.message}
                {...register('supportPhone', { required: 'Support phone is required' })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="24/7 Emergency Dispatch Line"
                type="tel"
                required
                helperText="Displayed during critical shortage notifications."
                error={errors.emergencyHelpline?.message}
                {...register('emergencyHelpline', { required: 'Emergency helpline is required' })}
              />

              <Input
                label="Active Data Privacy Policy Version"
                required
                helperText="Policy version stamped on all consent records."
                error={errors.policyVersion?.message}
                {...register('policyVersion', { required: 'Policy version is required' })}
              />
            </div>

            <div className="pt-3 border-t border-line-border space-y-3">
              <h4 className="text-xs font-bold text-ink-main uppercase tracking-wider">
                Registration Protocols
              </h4>

              <Checkbox
                label="Strict Referral Code Enforcement"
                description="Require a valid savior invitation code for all new donor signups. Prevents untrusted unverified registrations."
                {...register('requireReferralCode')}
              />

              <Checkbox
                label="Allow Public Community Onboarding"
                description="Display public invitation CTA on homepage landing banner."
                {...register('enablePublicRegistration')}
              />

              <Checkbox
                label="Maintenance Mode"
                description="Temporarily restrict new donor registrations for database maintenance."
                {...register('maintenanceMode')}
              />
            </div>

            <div className="pt-4 border-t border-line-border flex justify-end">
              <Button
                type="submit"
                variant="primary"
                isLoading={saving}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Save Settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
