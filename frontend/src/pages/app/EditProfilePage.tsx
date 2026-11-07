import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, CheckCircle2 } from 'lucide-react';
import { updateDonorProfileSchema, type UpdateDonorProfileFormData } from '../../schemas/donorSchemas';
import type { BloodGroup } from '../../types/donor';
import { profileService } from '../../services';
import { useAuth } from '../../hooks/useAuth';
import { BLOOD_GROUPS } from '../../constants/bloodGroups';
import { getPreferredCountryCode, normalizePhone, formatPhone } from '../../constants/countries';
import { LocationFields, PhoneField, type LocationValue } from '../../components/forms/LocationFields';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Checkbox } from '../../components/ui/Checkbox';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { applyFieldErrors, errorMessage, errorTitle } from '../../utils/formErrors';

export const EditProfilePage: React.FC = () => {
  const { user, refreshSession } = useAuth();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const mustComplete = searchParams.get('complete') === '1';
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorHeading, setErrorHeading] = useState<string | undefined>(undefined);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateDonorProfileFormData>({
    resolver: zodResolver(updateDonorProfileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: '',
      bloodGroup: 'O+',
      country: user?.country || getPreferredCountryCode(),
      state: '',
      district: '',
      city: '',
      postalCode: '',
      willingness: 'regular',
      emergencyAvailability: true,
      contactSharingConsent: true,
    },
  });

  // Load the saved profile so the form starts with the person's real details
  useEffect(() => {
    let active = true;
    profileService
      .getProfile()
      .then((p) => {
        if (!active || !p) return;
        const willingness = ['emergency_only', 'regular', 'plasma_only', 'undecided'].includes(p.donationWillingness || '')
          ? (p.donationWillingness as UpdateDonorProfileFormData['willingness'])
          : 'regular';
        reset({
          name: p.name || user?.name || '',
          email: p.email || user?.email || '',
          // Shown as the 10-digit number; the +91 prefix sits in front of the field
          phone: p.phone ? formatPhone(p.phone, p.country).replace(/^\+\d+\s*/, '') : '',
          bloodGroup: (p.bloodGroup as UpdateDonorProfileFormData['bloodGroup']) || 'O+',
          country: p.country || user?.country || getPreferredCountryCode(),
          state: p.state || '',
          district: p.district || '',
          city: p.city || '',
          postalCode: p.postalCode || '',
          willingness,
          emergencyAvailability: p.isAvailable ?? true,
          contactSharingConsent: true,
        });
      })
      .catch(() => {
        /* keep the empty form; the person can still fill it in */
      });
    return () => {
      active = false;
    };
  }, [reset, user?.name, user?.email, user?.country]);

  const location: LocationValue = {
    country: watch('country'),
    state: watch('state'),
    district: watch('district'),
    city: watch('city'),
    postalCode: watch('postalCode'),
  };

  const handleLocationChange = (changes: Partial<LocationValue>) => {
    (Object.keys(changes) as (keyof LocationValue)[]).forEach((key) => {
      setValue(key, changes[key] ?? '', { shouldDirty: true, shouldValidate: Boolean(errors[key]) });
    });
  };

  const onSubmit = async (data: UpdateDonorProfileFormData) => {
    setErrorMsg(null);
    setSaveSuccess(false);
    try {
      await profileService.updateProfile({
        name: data.name,
        email: data.email,
        phone: normalizePhone(data.country, data.phone) || data.phone,
        bloodGroup: data.bloodGroup as BloodGroup,
        location: {
          country: data.country,
          state: data.state,
          district: data.district,
          city: data.city,
          postalCode: data.postalCode,
        },
        willingness: data.willingness,
        emergencyAvailability: data.emergencyAvailability,
        contactSharingConsent: data.contactSharingConsent,
      });

      await refreshSession();
      setSaveSuccess(true);
      setTimeout(() => {
        navigate('/app/profile');
      }, 1500);
    } catch (err: unknown) {
      const shown = applyFieldErrors(err, setError, [
        'name',
        'email',
        'phone',
        'bloodGroup',
        'country',
        'state',
        'district',
        'city',
        'postalCode',
      ] as const);
      setErrorHeading(errorTitle(err));
      setErrorMsg(shown ? 'Please fix the highlighted field and save again.' : errorMessage(err, 'Could not save your profile. Please try again.'));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/app/profile"
          className="text-xs font-semibold text-ink-secondary hover:text-brand-500 inline-flex items-center min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Cancel &amp; Return to Profile
        </Link>
        {isDirty && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-medium">
            Unsaved Changes
          </span>
        )}
      </div>

      <Card className="shadow-lg border-line-border">
        <CardHeader>
          <div>
            <h1 className="text-lg font-bold text-ink-main">Edit Savior Profile</h1>
            <p className="text-xs text-ink-secondary">
              Update personal details, blood group, and emergency dispatch location
            </p>
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8 space-y-6">
          {mustComplete && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <strong>Welcome! Please complete your profile.</strong> Add your mobile number, blood group and location so we
              can match you with people who need blood near you.
            </div>
          )}

          {errorMsg && <ErrorBanner title={errorHeading} message={errorMsg} />}

          {saveSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-status-success font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>Profile updated successfully! Returning to profile page...</span>
            </div>
          )}

          <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="Full Name"
              required
              error={errors.name?.message}
              {...register('name')}
            />

            <Input
              label="Email Address"
              type="email"
              error={errors.email?.message}
              {...register('email')}
            />

            <PhoneField
              id="profile-phone"
              label="Mobile Number"
              countryCode={watch('country')}
              required
              helperText="You can sign in with this number or your email."
              error={errors.phone?.message}
              {...register('phone')}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Blood Group"
                required
                options={BLOOD_GROUPS.map((g) => ({
                  value: g.value,
                  label: `${g.label} ${g.isUniversalDonor ? '(Universal Donor)' : ''}`,
                }))}
                error={errors.bloodGroup?.message}
                {...register('bloodGroup')}
              />

              <Select
                label="Donation Willingness Mode"
                options={[
                  { value: 'regular', label: 'Regular Scheduled Donor' },
                  { value: 'emergency_only', label: 'Emergency Alerts Only' },
                  { value: 'plasma_only', label: 'Plasma / Platelets Only' },
                  { value: 'undecided', label: 'Undecided' },
                ]}
                error={errors.willingness?.message}
                {...register('willingness')}
              />
            </div>

            {/* Matching Location */}
            <div className="pt-2">
              <LocationFields
                idPrefix="profile"
                value={location}
                onChange={handleLocationChange}
                errors={{
                  country: errors.country?.message,
                  state: errors.state?.message,
                  district: errors.district?.message,
                  city: errors.city?.message,
                  postalCode: errors.postalCode?.message,
                }}
              />
            </div>

            <div className="pt-3 border-t border-line-border space-y-3">
              <Checkbox
                label="Immediate Emergency Dispatch Ready"
                description="Keep me listed for real-time mobile push and SMS alerts when urgent trauma shortages occur in my locality."
                {...register('emergencyAvailability')}
              />

              <Checkbox
                label="Contact-Sharing Consent"
                description="Allow verified coordinators to view my contact number for active matching."
                {...register('contactSharingConsent')}
              />
            </div>

            <div className="pt-4 border-t border-line-border flex items-center justify-end space-x-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/app/profile')}
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Save Profile Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
