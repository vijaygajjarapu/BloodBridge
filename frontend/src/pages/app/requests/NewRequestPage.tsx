import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Siren, ShieldCheck, Phone } from 'lucide-react';
import { requestApi } from '../../../services/requestApi';
import type { BloodComponent, CreateRequestInput, Urgency } from '../../../types/request';
import { URGENCY_LABELS, COMPONENT_LABELS } from '../../../types/request';
import type { BloodGroup } from '../../../types/donor';
import { BLOOD_GROUPS } from '../../../constants/bloodGroups';
import { useAuth } from '../../../hooks/useAuth';
import { getPreferredCountryCode, countryOrDefault } from '../../../constants/countries';
import { Card, CardContent } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { ErrorBanner } from '../../../components/ui/ErrorBanner';
import { LocationFields, type LocationValue } from '../../../components/forms/LocationFields';
import { HospitalPicker } from '../../../components/requests/HospitalPicker';
import { NearbyCommunities } from '../../../components/requests/NearbyCommunities';
import { getFieldErrors, errorMessage, errorTitle } from '../../../utils/formErrors';

type Errors = Partial<Record<keyof CreateRequestInput, string>>;

export const NewRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    patientName: '',
    bloodGroup: '' as BloodGroup | '',
    component: 'whole_blood' as BloodComponent,
    unitsNeeded: '1',
    hospitalName: '',
    hospitalArea: '',
    urgency: 'urgent' as Urgency,
    neededBy: '',
    notes: '',
  });
  const [location, setLocation] = useState<LocationValue>({
    country: countryOrDefault(user?.country || getPreferredCountryCode()).code,
    state: '',
    district: '',
    city: '',
    postalCode: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<{ title?: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  // Optional patient document, uploaded right after the request is created
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | undefined>(undefined);
  // Communities near the hospital to alert too (ticked by default for critical requests)
  const [alertCommunityIds, setAlertCommunityIds] = useState<string[]>([]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (form.patientName.trim().length < 2) e.patientName = 'Enter the patient’s name (at least 2 letters).';
    if (!form.bloodGroup) e.bloodGroup = 'Choose the blood group needed.';
    const units = Number(form.unitsNeeded);
    if (!Number.isInteger(units) || units < 1) e.unitsNeeded = 'Enter how many units are needed (1 or more).';
    else if (units > 20) e.unitsNeeded = 'For more than 20 units, please contact the blood bank directly.';
    if (form.hospitalName.trim().length < 3) e.hospitalName = 'Enter the hospital name.';
    if (location.postalCode && !/^[1-9]\d{5}$/.test(location.postalCode)) e.hospitalPinCode = 'Please enter a valid 6-digit PIN code.';
    if (!location.state) e.state = 'Please choose the state.';
    if (!location.district) e.district = 'Please choose the district.';
    if ((location.city || '').trim().length < 2) e.city = 'Enter the city or town.';
    if (form.neededBy && new Date(form.neededBy).getTime() < Date.now() - 60 * 60 * 1000) e.neededBy = '"Needed by" cannot be in the past.';
    return e;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      setBanner({ title: 'Please check the form', message: 'Some details are missing or need a fix. See the messages below each field.' });
      return;
    }
    setSaving(true);
    try {
      const created = await requestApi.create({
        patientName: form.patientName.trim(),
        bloodGroup: form.bloodGroup as BloodGroup,
        component: form.component,
        unitsNeeded: Number(form.unitsNeeded),
        hospitalName: form.hospitalName.trim(),
        hospitalArea: form.hospitalArea.trim() || undefined,
        hospitalPinCode: location.postalCode || undefined,
        country: location.country,
        state: location.state,
        district: location.district,
        city: (location.city || '').trim(),
        urgency: form.urgency,
        neededBy: form.neededBy ? new Date(form.neededBy).toISOString() : null,
        notes: form.notes.trim() || undefined,
        alertCommunityIds: alertCommunityIds.length ? alertCommunityIds : undefined,
      });
      let docUploadFailed = false;
      if (docFile) {
        await requestApi.uploadDocument(created.id, docFile).catch(() => {
          docUploadFailed = true;
        });
      }
      navigate(`/app/requests/${created.id}`, { replace: true, state: { justCreated: true, savedDonorsAlerted: created.savedDonorsAlerted || 0, docUploadFailed } });
    } catch (err) {
      const fe = getFieldErrors(err) as Errors;
      setErrors(fe);
      setBanner({ title: errorTitle(err), message: errorMessage(err, 'Could not post the request. Please try again.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link to="/app/requests" className="inline-flex items-center text-xs font-semibold text-ink-secondary hover:text-ink-main min-h-[44px]">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to requests
      </Link>
      <div>
        <h1 className="text-2xl font-extrabold text-ink-main flex items-center gap-2">
          <Siren className="w-6 h-6 text-brand-600" /> Request blood
        </h1>
        <p className="text-xs sm:text-sm text-ink-secondary">
          Free for everyone. Matching donors near the hospital are alerted as soon as you post. With the Family Circle, your family’s own donors are alerted too.
        </p>
      </div>

      {banner && <ErrorBanner title={banner.title} message={banner.message} />}

      <Card>
        <CardContent className="p-5 sm:p-6">
          <form noValidate onSubmit={submit} className="space-y-4">
            <Input id="req-patient" label="Patient name" required value={form.patientName} onChange={set('patientName')} error={errors.patientName}
              helperText="Shown only to you and our team, never on the public page." />
            <div className="grid sm:grid-cols-3 gap-4">
              <Select
                id="req-blood-group"
                label="Blood group needed"
                required
                value={form.bloodGroup}
                onChange={set('bloodGroup')}
                error={errors.bloodGroup}
                options={[{ value: '', label: 'Select', disabled: true }, ...BLOOD_GROUPS.map((g) => ({ value: g.value, label: g.value }))]}
              />
              <Select
                id="req-component"
                label="Component"
                value={form.component}
                onChange={set('component')}
                options={Object.entries(COMPONENT_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <Input id="req-units" label="Units needed" type="number" min={1} max={20} required value={form.unitsNeeded} onChange={set('unitsNeeded')} error={errors.unitsNeeded} />
            </div>
            <LocationFields
              idPrefix="req"
              value={location}
              onChange={(c) => {
                setLocation((l) => ({ ...l, ...c }));
                setErrors((er) => ({
                  ...er,
                  ...Object.fromEntries(Object.keys(c).map((k) => [k === 'postalCode' ? 'hospitalPinCode' : k, undefined])),
                }));
              }}
              errors={{ state: errors.state, district: errors.district, city: errors.city, postalCode: errors.hospitalPinCode }}
              showCountry={false}
              postalCodeLabel="Hospital PIN code"
              postalCodeRequired={false}
              postalCodeHelper="Donors living in this PIN code are alerted too."
            />
            <HospitalPicker
              country={location.country}
              state={location.state}
              district={location.district}
              pinCode={location.postalCode || ''}
              name={form.hospitalName}
              area={form.hospitalArea}
              errors={{ name: errors.hospitalName, area: errors.hospitalArea }}
              onChange={(c) => {
                setForm((f) => ({
                  ...f,
                  ...(c.name !== undefined ? { hospitalName: c.name } : {}),
                  ...(c.area !== undefined ? { hospitalArea: c.area } : {}),
                }));
                if (c.pinCode || (c.city && !location.city)) {
                  setLocation((l) => ({ ...l, ...(c.pinCode ? { postalCode: c.pinCode } : {}), ...(c.city && !l.city ? { city: c.city } : {}) }));
                }
                setErrors((er) => ({ ...er, hospitalName: undefined }));
              }}
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <Select
                id="req-urgency"
                label="How urgent?"
                value={form.urgency}
                onChange={set('urgency')}
                options={Object.entries(URGENCY_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <Input id="req-needed-by" label="Needed by (optional)" type="datetime-local" value={form.neededBy} onChange={set('neededBy')} error={errors.neededBy} />
            </div>
            <NearbyCommunities
              country={location.country}
              state={location.state}
              district={location.district}
              pinCode={location.postalCode || undefined}
              bloodGroup={form.bloodGroup || undefined}
              selected={alertCommunityIds}
              onChange={setAlertCommunityIds}
              selectAllByDefault={form.urgency === 'critical'}
            />
            <div>
              <label htmlFor="req-notes" className="block text-xs font-semibold text-ink-secondary mb-1">Notes for donors (optional)</label>
              <textarea
                id="req-notes"
                rows={3}
                maxLength={500}
                value={form.notes}
                onChange={set('notes')}
                className="w-full text-sm p-3 rounded-lg border border-line-border focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                placeholder="e.g. Ask for Blood Bank, 2nd floor. Bring an ID."
              />
            </div>

            <div>
              <label htmlFor="req-document" className="block text-xs font-semibold text-ink-secondary mb-1">
                Patient document {form.urgency === 'critical' ? '(recommended for critical requests)' : '(optional)'}
              </label>
              <input
                id="req-document"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setDocError(undefined);
                  if (f && !['image/jpeg', 'image/png', 'application/pdf'].includes(f.type)) {
                    setDocError('Please choose a photo (JPG or PNG) or a PDF.');
                    setDocFile(null);
                    e.target.value = '';
                    return;
                  }
                  if (f && f.size > 5 * 1024 * 1024) {
                    setDocError('The file is larger than 5 MB. Please choose a smaller photo.');
                    setDocFile(null);
                    e.target.value = '';
                    return;
                  }
                  setDocFile(f);
                }}
                className="block w-full text-sm text-ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-brand-700 file:font-semibold"
              />
              <p className="mt-1 text-xs text-ink-muted">
                Blood requisition form or doctor’s note (photo or PDF, up to 5 MB). We check it automatically; only you and our team can see it.
              </p>
              {docError && <p className="mt-1 text-xs text-status-error font-medium" role="alert">{docError}</p>}
            </div>

            <div className="rounded-xl bg-gray-50 border border-line-border p-3 text-xs text-ink-secondary space-y-1.5">
              <p className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-brand-600 shrink-0" />
                Donors who accept will see your mobile number{user?.phone ? ` (${user.phone})` : ''} so they can call you. Nobody else sees it.
              </p>
              <p className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-status-success shrink-0" />
                Donors’ numbers stay hidden unless a donor chooses to share theirs.
              </p>
            </div>

            <Button type="submit" variant="primary" size="lg" isLoading={saving} className="w-full justify-center font-bold">
              Post request & alert donors
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
