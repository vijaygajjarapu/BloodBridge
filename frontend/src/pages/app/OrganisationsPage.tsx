import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Briefcase, ShieldCheck, Megaphone, KeyRound, Building, CheckCircle2, Clock } from 'lucide-react';
import { orgApi } from '../../services/orgApi';
import type { MyOrganisation, OrgAnnouncement, OrgType } from '../../types/organisation';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n/I18nProvider';
import { getPreferredCountryCode, countryOrDefault } from '../../constants/countries';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { LocationFields, type LocationValue } from '../../components/forms/LocationFields';
import { errorMessage } from '../../utils/formErrors';

const TYPES: { value: OrgType; label: string }[] = [
  { value: 'company', label: 'Company' },
  { value: 'college', label: 'College / university' },
  { value: 'ngo', label: 'NGO / foundation' },
  { value: 'hospital_group', label: 'Hospital group' },
  { value: 'other', label: 'Other' },
];

/**
 * Employee side: link my company to my personal account. The company decides who is eligible: we match the
 * employee list HR shared (employee ID + date of birth), or send a code to the work email on that list.
 * Anyone can ask BloodNation to bring their company on; that is only a request, it makes nobody an admin.
 */
export const OrganisationsPage: React.FC = () => {
  const t = useT();
  const { user } = useAuth();
  const [mine, setMine] = useState<MyOrganisation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [news, setNews] = useState<Record<string, OrgAnnouncement[]>>({});

  // Join (the invite link from HR fills in the code)
  const [params] = useSearchParams();
  const [code, setCode] = useState((params.get('code') || '').toUpperCase());
  const [method, setMethod] = useState<'employee_id' | 'work_email'>('employee_id');
  const [workEmail, setWorkEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [dob, setDob] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  // Code from the work email, per organisation
  const [otp, setOtp] = useState<Record<string, string>>({});
  // Ask BloodNation to bring my company on
  const [showRequest, setShowRequest] = useState(false);
  const [reg, setReg] = useState({ name: '', type: 'company' as OrgType, contactName: '', contactEmail: '', contactPhone: '' });
  const [loc, setLoc] = useState<LocationValue>({ country: countryOrDefault(user?.country || getPreferredCountryCode()).code, state: '', district: '', city: '', postalCode: '' });

  const load = () =>
    orgApi
      .mine()
      .then((rows) => {
        setMine(rows);
        rows.filter((o) => o.membership.status === 'active').forEach((o) =>
          orgApi.announcements(o.id).then((a) => setNews((n) => ({ ...n, [o.id]: a }))).catch(() => undefined),
        );
      })
      .catch((e) => setError(errorMessage(e, 'Could not load your organisations.')));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (key: string, fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
      after?.();
      await load();
    } catch (e) {
      setError(errorMessage(e, 'Something went wrong. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-main tracking-tight flex items-center gap-2">
          <Briefcase className="w-7 h-7 text-brand-600" /> {t('org.title')}
        </h1>
        <p className="text-xs sm:text-sm text-ink-secondary">{t('org.intro')}</p>
      </div>
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-ink-secondary flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-status-success shrink-0" /> {t('org.privacy')}
      </div>
      {error && <ErrorBanner message={error} />}
      {notice && <p className="text-sm text-status-success font-semibold" role="status">{notice}</p>}

      {mine?.map((o) => (
        <Card key={o.id}>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold text-ink-main flex items-center gap-2">
                  <Building className="w-4 h-4" /> {o.name}
                </p>
                <p className="text-[11px] text-ink-muted">
                  {[`${o.city}, ${o.state}`, o.membership.employeeId, o.membership.workEmail].filter(Boolean).join(' · ')}
                </p>
              </div>
              {o.membership.status === 'active' ? (
                <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {o.membership.role === 'admin' ? 'Admin' : 'Member'}</span>
              ) : (
                <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> …</span>
              )}
            </div>

            {!o.verified && <p className="text-xs text-amber-700">{t('org.waitingVerify', { name: o.name })}</p>}

            {o.membership.status === 'pending_email' ? (
              <div className="space-y-2">
                <p className="text-sm text-ink-main">{t('org.codeSent', { email: o.membership.workEmail })}</p>
                <div className="flex flex-wrap items-end gap-2">
                  <Input id={`otp-${o.id}`} label={t('org.code')} value={otp[o.id] || ''} inputMode="numeric" maxLength={8}
                    onChange={(e) => setOtp((x) => ({ ...x, [o.id]: e.target.value }))} />
                  <Button variant="primary" isLoading={busy === `v-${o.id}`} onClick={() => run(`v-${o.id}`, () => orgApi.verifyEmail(o.id, otp[o.id] || ''))}>
                    {t('org.verify')}
                  </Button>
                  <Button variant="ghost" isLoading={busy === `r-${o.id}`} onClick={() => run(`r-${o.id}`, () => orgApi.resendCode(o.id))}>
                    {t('org.resend')}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <label className="flex items-start gap-3 text-sm text-ink-main cursor-pointer min-h-[44px]">
                  <input type="checkbox" className="mt-0.5 w-4 h-4 accent-brand-600" checked={o.membership.countInImpact} disabled={busy !== null}
                    onChange={(e) => run(`i-${o.id}`, () => orgApi.setCountInImpact(o.id, e.target.checked))} />
                  {t('org.countImpact')}
                </label>
                {(news[o.id] || []).length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-ink-secondary flex items-center gap-1.5"><Megaphone className="w-3.5 h-3.5" /> {t('org.announcements')}</p>
                    {news[o.id].slice(0, 5).map((a) => (
                      <div key={a.id} className="rounded-lg bg-gray-50 border border-line-border p-2.5">
                        <p className="text-sm font-semibold text-ink-main">{a.title}</p>
                        <p className="text-xs text-ink-secondary">{a.body}</p>
                        {(a.place || a.campDate) && (
                          <p className="text-[11px] text-ink-muted">{[a.place, a.campDate ? new Date(a.campDate).toDateString() : ''].filter(Boolean).join(' · ')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {o.membership.role === 'admin' && o.membership.status === 'active' && (
                <>
                  <Link to={`/app/organisations/${o.id}/admin`}>
                    <Button size="sm" variant="primary">{t('org.adminLink')}</Button>
                  </Link>
                  {o.inviteCode && <span className="text-xs text-ink-secondary self-center">{t('org.yourCode', { code: o.inviteCode })}</span>}
                </>
              )}
              <Button size="sm" variant="ghost" isLoading={busy === `l-${o.id}`} onClick={() => run(`l-${o.id}`, () => orgApi.leave(o.id))}>
                {t('org.leave')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="p-5 space-y-3" id="link-company">
          <h2 className="text-base font-bold text-ink-main flex items-center gap-2"><KeyRound className="w-4 h-4" /> {t('org.linkTitle')}</h2>
          <p className="text-xs text-ink-secondary">{t('org.linkHint')}</p>
          <Input id="org-code" label={t('org.inviteCode')} value={code} maxLength={20} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <div className="flex flex-wrap gap-4 text-sm" role="radiogroup" aria-label={t('org.linkTitle')}>
            {(['employee_id', 'work_email'] as const).map((m) => (
              <label key={m} className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                <input type="radio" name="link-method" className="w-4 h-4 accent-brand-600" checked={method === m} onChange={() => setMethod(m)} />
                {m === 'employee_id' ? t('org.methodId') : t('org.methodEmail')}
              </label>
            ))}
          </div>
          {method === 'employee_id' ? (
            <div className="grid sm:grid-cols-2 gap-3">
              <Input id="org-empid" label={t('org.employeeIdReq')} value={employeeId} maxLength={40} onChange={(e) => setEmployeeId(e.target.value)} />
              <Input id="org-dob" type="date" label={t('org.dob')} value={dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDob(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-1">
              <Input id="org-email" type="email" label={t('org.workEmail')} value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} />
              <p className="text-[11px] text-ink-muted">{t('org.workEmailOnlyCheck')}</p>
            </div>
          )}
          <Button variant="primary" isLoading={busy === 'link'}
            disabled={!code.trim() || (method === 'employee_id' ? !employeeId.trim() || !dob : !workEmail.trim())}
            onClick={() =>
              run(
                'link',
                () =>
                  orgApi.link(
                    method === 'employee_id'
                      ? { inviteCode: code, method, employeeId, dateOfBirth: dob }
                      : { inviteCode: code, method, workEmail },
                  ),
                () => { setCode(''); setEmployeeId(''); setDob(''); setWorkEmail(''); },
              )
            }>
            {method === 'employee_id' ? t('org.linkTitle') : t('org.sendCode')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-3" id="request-company">
          <button type="button" className="text-base font-bold text-ink-main flex items-center gap-2" onClick={() => setShowRequest((v) => !v)} aria-expanded={showRequest}>
            <Building className="w-4 h-4" /> {t('org.requestTitle')}
          </button>
          <p className="text-xs text-ink-secondary">{t('org.requestHint')}</p>
          {showRequest && (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <Input id="reg-name" label={t('org.name')} value={reg.name} maxLength={100} onChange={(e) => setReg({ ...reg, name: e.target.value })} />
                <Select id="reg-type" label={t('org.type')} value={reg.type} onChange={(e) => setReg({ ...reg, type: e.target.value as OrgType })} options={TYPES} />
                <Input id="reg-contact" label={t('org.contactName')} value={reg.contactName} maxLength={80} onChange={(e) => setReg({ ...reg, contactName: e.target.value })} />
                <Input id="reg-email" type="email" label={t('org.contactEmail')} value={reg.contactEmail} onChange={(e) => setReg({ ...reg, contactEmail: e.target.value })} />
                <Input id="reg-phone" type="tel" label={t('org.contactPhone')} value={reg.contactPhone} maxLength={20} onChange={(e) => setReg({ ...reg, contactPhone: e.target.value })} />
              </div>
              <LocationFields idPrefix="reg" value={loc} onChange={(c) => setLoc((l) => ({ ...l, ...c }))} showCountry={false} showPostalCode={false} />
              <Button variant="primary" isLoading={busy === 'request'} disabled={!reg.name.trim() || !reg.contactName.trim() || !reg.contactEmail.trim()}
                onClick={() =>
                  run(
                    'request',
                    () =>
                      orgApi.requestCompany({
                        name: reg.name,
                        type: reg.type,
                        contactName: reg.contactName,
                        contactEmail: reg.contactEmail,
                        contactPhone: reg.contactPhone || undefined,
                        country: loc.country,
                        state: loc.state,
                        district: loc.district,
                        city: loc.city || '',
                      }),
                    () => {
                      setNotice(t('org.requestSent', { name: reg.name.trim() }));
                      setShowRequest(false);
                      setReg({ name: '', type: 'company', contactName: '', contactEmail: '', contactPhone: '' });
                    },
                  )
                }>
                {t('org.sendRequest')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
