import React, { useState, useEffect } from 'react';
import { maxAdultDob } from '../../utils/age';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Heart, ShieldAlert, ShieldCheck, ArrowRight, ArrowLeft, Info } from 'lucide-react';
import { donorRegistrationSchema, type DonorRegistrationFormData, type DonorRegistrationFormInput } from '../../schemas/donorSchemas';
import { BLOOD_GROUPS } from '../../constants/bloodGroups';
import { getPreferredCountryCode } from '../../constants/countries';
import { LocationFields, PhoneField, type LocationValue } from '../../components/forms/LocationFields';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Checkbox } from '../../components/ui/Checkbox';
import { Card, CardContent } from '../../components/ui/Card';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

export const DonorRegistrationPage: React.FC = () => {
  const { referralCode = 'SAVIOR-MV2026' } = useParams<{ referralCode: string }>();
  const navigate = useNavigate();

  // Load existing draft if returning from review
  const savedDraft = sessionStorage.getItem(`bftd_reg_draft_${referralCode}`);
  const initialData: Partial<DonorRegistrationFormInput> = savedDraft
    ? JSON.parse(savedDraft)
    : {
        fullName: '',
        phone: '',
        email: '',
        bloodGroup: 'O+',
        country: getPreferredCountryCode(),
        state: '',
        district: '',
        city: '',
        postalCode: '',
        willingness: 'regular',
        contactSharingConsent: false, // MUST NOT BE PRESELECTED per prompt requirement
        privacyAcknowledged: false,
        termsAccepted: false,
        referralCode,
      };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DonorRegistrationFormInput, unknown, DonorRegistrationFormData>({
    resolver: zodResolver(donorRegistrationSchema),
    defaultValues: {
      ...initialData,
      referralCode,
    },
  });

  // Problems found by the server on the review step (e.g. mobile number already registered)
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  useEffect(() => {
    const key = `bftd_reg_errors_${referralCode}`;
    const saved = sessionStorage.getItem(key);
    if (!saved) return;
    sessionStorage.removeItem(key);
    try {
      const { message, fieldErrors } = JSON.parse(saved) as { message: string; fieldErrors: Record<string, string> };
      setServerMessage(message);
      Object.entries(fieldErrors).forEach(([field, msg], i) => {
        setError(field as keyof DonorRegistrationFormInput, { type: 'server', message: msg }, { shouldFocus: i === 0 });
      });
    } catch {
      /* ignore a damaged entry */
    }
  }, [referralCode, setError]);

  const location: LocationValue = {
    country: watch('country'),
    state: watch('state'),
    district: watch('district'),
    city: watch('city'),
    postalCode: watch('postalCode'),
  };

  const handleLocationChange = (changes: Partial<LocationValue>) => {
    (Object.keys(changes) as (keyof LocationValue)[]).forEach((key) => {
      setValue(key, changes[key] ?? '', { shouldValidate: Boolean(errors[key]) });
    });
  };

  const onSubmit = (data: DonorRegistrationFormData) => {
    setServerMessage(null);
    // Save draft for review step
    sessionStorage.setItem(`bftd_reg_draft_${referralCode}`, JSON.stringify(data));
    navigate(`/join/${referralCode}/review`);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 sm:py-12 px-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          to={`/join/${referralCode}`}
          className="text-xs font-semibold text-ink-secondary hover:text-brand-500 inline-flex items-center min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Invitation
        </Link>
        <span className="text-xs font-mono font-bold bg-brand-50 text-brand-700 px-2.5 py-1 rounded-md">
          Code: {referralCode}
        </span>
      </div>

      <Card className="shadow-lg border-line-border">
        <div className="p-6 bg-gradient-to-r from-brand-500 to-brand-600 text-white flex items-center justify-between rounded-t-xl">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Savior Donor Registration</h1>
            <p className="text-xs text-white/90 mt-0.5">Step 1 of 2: Personal &amp; Medical Matching Profile</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Heart className="w-5 h-5 fill-current text-white" />
          </div>
        </div>

        <CardContent className="p-6 sm:p-8 space-y-6">
          {serverMessage && (
            <ErrorBanner title="Please update your details" message={`${serverMessage} Fix the highlighted field below and continue.`} />
          )}

          <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Identity & Contact */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-ink-main border-b border-line-border pb-1.5">
                1. Basic Information
              </h2>

              <Input
                label="Full Legal or Preferred Name"
                placeholder="e.g. Priya Sharma"
                required
                error={errors.fullName?.message}
                {...register('fullName')}
              />

              <Input
                label="Date of Birth"
                type="date"
                required
                max={maxAdultDob()}
                helperText="You must be 18 or older to join BloodNation."
                error={errors.dateOfBirth?.message}
                {...register('dateOfBirth')}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PhoneField
                  label="Primary Mobile Number"
                  countryCode={location.country}
                  required
                  helperText="Primary number for emergency alerts."
                  error={errors.phone?.message}
                  {...register('phone')}
                />

                <Input
                  label="Email Address"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="priya@example.com"
                  helperText="We'll send a 6-digit code here to confirm your BloodNation account."
                  error={errors.email?.message}
                  {...register('email')}
                />
              </div>
            </div>

            {/* Blood Type & Willingness */}
            <div className="space-y-4 pt-2">
              <h2 className="text-sm font-bold text-ink-main border-b border-line-border pb-1.5">
                2. Blood Type &amp; Availability Readiness
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Blood Group"
                  required
                  options={BLOOD_GROUPS.map((g) => ({
                    value: g.value,
                    label: `${g.label} ${g.isUniversalDonor ? '★ Universal Donor' : ''}`,
                  }))}
                  error={errors.bloodGroup?.message}
                  {...register('bloodGroup')}
                />

                <Select
                  label="Donation Willingness Preference"
                  options={[
                    { value: 'regular', label: 'Regular Scheduled Donor (Every 3 Months)' },
                    { value: 'emergency_only', label: 'Emergency Alerts Only (Trauma / Critical)' },
                    { value: 'plasma_only', label: 'Platelets & Plasma Only' },
                    { value: 'undecided', label: 'Undecided / Open to Coordination' },
                  ]}
                  error={errors.willingness?.message}
                  {...register('willingness')}
                />
              </div>
            </div>

            {/* Location Details */}
            <div className="space-y-4 pt-2">
              <h2 className="text-sm font-bold text-ink-main border-b border-line-border pb-1.5">
                3. Primary Matching Location
              </h2>

              <LocationFields
                idPrefix="reg"
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

            {/* Critical Explicit Consent Section */}
            <div className="pt-3 space-y-4 bg-brand-50/50 p-5 rounded-xl border border-brand-200">
              <div className="flex items-start space-x-2.5">
                <ShieldCheck className="w-5 h-5 text-brand-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-brand-900">
                    Scope of Emergency Contact Sharing
                  </h3>
                  <p className="text-xs text-brand-800 leading-relaxed mt-1">
                    By granting contact consent below, you permit <strong>verified emergency healthcare dispatchers</strong> and BloodNation hospital partners to view your direct phone number <em>only</em> when a patient requires a matching {watch('bloodGroup')} transfusion within your region. Your number is never sold or made visible to public web searches.
                  </p>
                </div>
              </div>

              {/* Not preselected as per strict prompt rule */}
              <div className="pt-2 border-t border-brand-200/60">
                <Checkbox
                  label="I explicitly consent to sharing my phone number with verified emergency medical coordinators for blood dispatch alerts."
                  description="Required to enable active emergency outreach. You can revoke this anytime in settings."
                  error={errors.contactSharingConsent?.message}
                  {...register('contactSharingConsent')}
                />
              </div>
            </div>

            {/* Terms and Privacy */}
            <div className="pt-2 space-y-3">
              <Checkbox
                label={
                  <span>
                    I have reviewed and acknowledge the{' '}
                    <Link to="/privacy" target="_blank" className="text-brand-600 underline font-semibold">
                      BloodNation Privacy Charter
                    </Link>
                    .
                  </span>
                }
                error={errors.privacyAcknowledged?.message}
                {...register('privacyAcknowledged')}
              />

              <Checkbox
                label={
                  <span>
                    I accept the{' '}
                    <Link to="/terms" target="_blank" className="text-brand-600 underline font-semibold">
                      Savior Participation Terms
                    </Link>{' '}
                    and confirm I meet voluntary donor eligibility guidelines.
                  </span>
                }
                error={errors.termsAccepted?.message}
                {...register('termsAccepted')}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="w-5 h-5" />}
              className="w-full justify-center shadow-md text-base"
            >
              Review Registration Details
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
