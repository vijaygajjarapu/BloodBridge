import React, { useEffect, useState } from 'react';
import { Building2, ShieldCheck, Plus, LogOut, BellOff, Bell, MapPin, CheckCircle2, Search, Link2, Copy, MessageCircle } from 'lucide-react';
import { communityApi } from '../../services/communityApi';
import type { CommunitySearchResult, CommunityType, MyCommunity, GroupInvite } from '../../types/community';
import { COMMUNITY_TYPE_LABELS } from '../../types/community';
import { useAuth } from '../../hooks/useAuth';
import { getPreferredCountryCode, countryOrDefault } from '../../constants/countries';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { LocationFields, type LocationValue } from '../../components/forms/LocationFields';
import { errorMessage, getFieldErrors } from '../../utils/formErrors';

const MAX = 5;

const Toggle: React.FC<{ id: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string; hint?: string }> = ({
  id, checked, disabled, onChange, label, hint,
}) => (
  <label htmlFor={id} className={`flex items-start gap-3 min-h-[44px] ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
    <input id={id} type="checkbox" className="mt-0.5 w-4 h-4 accent-brand-600" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    <span>
      <span className="block text-sm text-ink-main">{label}</span>
      {hint && <span className="block text-[11px] text-ink-muted">{hint}</span>}
    </span>
  </label>
);

export const CommunitiesPage: React.FC = () => {
  const { user } = useAuth();
  const [mine, setMine] = useState<MyCommunity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Add a community
  const [loc, setLoc] = useState<LocationValue>({ country: countryOrDefault(user?.country || getPreferredCountryCode()).code, state: '', district: '', city: '', postalCode: '' });
  const [name, setName] = useState('');
  const [type, setType] = useState<CommunityType>('gated');
  const [locality, setLocality] = useState('');
  const [matches, setMatches] = useState<CommunitySearchResult[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  // Invite links (for WhatsApp groups, associations, clubs), per community
  const [invites, setInvites] = useState<Record<string, GroupInvite>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const getInvite = async (id: string) => {
    setBusy(`invite-${id}`);
    setError(null);
    try {
      const inv = await communityApi.invite(id);
      setInvites((x) => ({ ...x, [id]: inv }));
    } catch (e) {
      setError(errorMessage(e, 'Could not create the invite link.'));
    } finally {
      setBusy(null);
    }
  };

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Copy did not work here. Select the link and copy it.');
    }
  };

  useEffect(() => {
    communityApi.mine().then(setMine).catch((e) => setError(errorMessage(e, 'Could not load your communities.')));
  }, []);

  // Suggest communities others already added, so the same place is not added twice
  useEffect(() => {
    if (!loc.district || name.trim().length < 3) {
      setMatches([]);
      return;
    }
    const t = setTimeout(() => {
      communityApi
        .search({ q: name.trim(), country: loc.country, state: loc.state, district: loc.district })
        .then(setMatches)
        .catch(() => setMatches([]));
    }, 300);
    return () => clearTimeout(t);
  }, [name, loc.country, loc.state, loc.district]);

  const run = async (key: string, fn: () => Promise<MyCommunity[]>) => {
    setBusy(key);
    setError(null);
    try {
      setMine(await fn());
    } catch (e) {
      setError(errorMessage(e, 'Could not save. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  const joinExisting = async (c: CommunitySearchResult) => {
    await run(`join-${c.id}`, () => communityApi.join(c.id));
    setDone(`You joined ${c.name}.`);
    setName('');
    setMatches([]);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setDone(null);
    const errs: Record<string, string> = {};
    if (name.trim().length < 3) errs.name = 'Enter the full name (at least 3 letters).';
    if (!loc.state) errs.state = 'Choose the state.';
    if (!loc.district) errs.district = 'Choose the district.';
    if ((loc.city || '').trim().length < 2) errs.city = 'Enter the city or town.';
    if (loc.postalCode && !/^[1-9]\d{5}$/.test(loc.postalCode)) errs.pinCode = 'Please enter a valid 6-digit PIN code.';
    setFormErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setError(null);
    try {
      const c = await communityApi.create({
        name: name.trim(),
        type,
        country: loc.country,
        state: loc.state,
        district: loc.district,
        city: (loc.city || '').trim(),
        locality: locality.trim() || undefined,
        pinCode: loc.postalCode || undefined,
      });
      setMine(await communityApi.mine());
      setDone(`You joined ${c.name}.`);
      setName('');
      setLocality('');
      setMatches([]);
    } catch (err) {
      setFormErrors(getFieldErrors(err) as Record<string, string>);
      setError(errorMessage(err, 'Could not add the community. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const full = (mine?.length || 0) >= MAX;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-main tracking-tight flex items-center gap-2">
          <Building2 className="w-7 h-7 text-brand-600" /> Communities
        </h1>
        <p className="text-xs sm:text-sm text-ink-secondary">
          Free for everyone. Add the places and groups you belong to (your gated community, apartment, college, office, place of worship, club,
          association or family WhatsApp group) so the people who know you can reach you fast in an emergency.
        </p>
      </div>

      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-ink-secondary flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-status-success shrink-0" />
        <span>
          Your communities are <strong>never shown</strong> to anyone. Requesters only see how many donors in a community could help, and any number
          below 3 shows as “fewer than 3”. Adding one is optional and you can remove it any time.
        </span>
      </div>

      {error && <ErrorBanner message={error} />}
      {done && (
        <p className="text-sm text-status-success font-semibold flex items-center gap-1.5" role="status">
          <CheckCircle2 className="w-4 h-4" /> {done}
        </p>
      )}

      {/* "Still at X?" */}
      {mine?.filter((m) => m.membership.needsConfirm).map((m) => (
        <Card key={`confirm-${m.id}`}>
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-ink-main">
              <strong>Still at {m.name}?</strong>{' '}
              <span className="text-ink-secondary">
                {m.membership.status === 'stale' ? 'Alerts from this community are paused until you confirm.' : 'Please confirm so we only alert people who are really there.'}
              </span>
            </p>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="primary" isLoading={busy === `yes-${m.id}`} onClick={() => run(`yes-${m.id}`, () => communityApi.confirm(m.id, true))}>
                Yes, still here
              </Button>
              <Button size="sm" variant="outline" isLoading={busy === `no-${m.id}`} onClick={() => run(`no-${m.id}`, () => communityApi.confirm(m.id, false))}>
                I’ve moved
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="p-5 space-y-4">
          <h2 className="text-base font-bold text-ink-main">My communities {mine ? `(${mine.length}/${MAX})` : ''}</h2>
          {!mine && <p className="text-sm text-ink-muted">Loading…</p>}
          {mine && mine.length === 0 && <p className="text-sm text-ink-secondary">You haven’t added a community yet. Add one below.</p>}
          {mine?.map((m) => {
            const p = m.membership;
            return (
              <div key={m.id} className="rounded-xl border border-line-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink-main truncate">{m.name}</p>
                    <p className="text-[11px] text-ink-muted flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {COMMUNITY_TYPE_LABELS[m.type]} · {m.locality ? `${m.locality}, ` : ''}{m.city}, {m.district}
                      {p.isAlumni ? ' · moved away' : ''}{p.muted ? ' · muted' : ''}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Invite people to ${m.name}`}
                      isLoading={busy === `invite-${m.id}`}
                      onClick={() => getInvite(m.id)}
                      leftIcon={<Link2 className="w-4 h-4" />}
                    >
                      Invite
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={p.muted ? `Unmute ${m.name}` : `Mute ${m.name}`}
                      isLoading={busy === `mute-${m.id}`}
                      onClick={() => run(`mute-${m.id}`, () => communityApi.updatePrefs(m.id, { muted: !p.muted }))}
                      leftIcon={p.muted ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                    >
                      {p.muted ? 'Unmute' : 'Mute'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Leave ${m.name}`}
                      isLoading={busy === `leave-${m.id}`}
                      onClick={() => run(`leave-${m.id}`, () => communityApi.leave(m.id))}
                      leftIcon={<LogOut className="w-4 h-4" />}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                {invites[m.id] && (
                  <div className="rounded-lg bg-gray-50 border border-line-border p-3 space-y-2" id={`invite-${m.id}`}>
                    <p className="text-xs text-ink-secondary">
                      Share this link in your WhatsApp group or notice board. Anyone who opens it can join in one tap; they choose whether to get alerts.
                    </p>
                    <p className="text-xs font-mono break-all text-ink-main">{invites[m.id].url}</p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={invites[m.id].whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold px-3 py-2"
                      >
                        <MessageCircle className="w-4 h-4" /> Share on WhatsApp
                      </a>
                      <Button size="sm" variant="outline" onClick={() => copy(m.id, invites[m.id].message)} leftIcon={<Copy className="w-4 h-4" />}>
                        {copied === m.id ? 'Copied' : 'Copy message'}
                      </Button>
                    </div>
                  </div>
                )}
                <Toggle
                  id={`near-${m.id}`}
                  checked={p.alertNearby && !p.isAlumni}
                  disabled={p.muted || p.isAlumni || busy !== null}
                  onChange={(v) => run(`near-${m.id}`, () => communityApi.updatePrefs(m.id, { alertNearby: v }))}
                  label="Alert me when someone near this community needs my blood group"
                  hint="Only when the requester chooses to alert this community."
                />
                <Toggle
                  id={`members-${m.id}`}
                  checked={p.alertFromMembers}
                  disabled={p.muted || busy !== null}
                  onChange={(v) => run(`members-${m.id}`, () => communityApi.updatePrefs(m.id, { alertFromMembers: v }))}
                  label="Alert me when a fellow member needs blood, at any hospital"
                  hint="Off by default for places; on for WhatsApp groups and associations you join by link."
                />
                <Toggle
                  id={`alumni-${m.id}`}
                  checked={p.isAlumni}
                  disabled={busy !== null}
                  onChange={(v) => run(`alumni-${m.id}`, () => communityApi.updatePrefs(m.id, { isAlumni: v, ...(v ? { alertNearby: false } : { alertNearby: true }) }))}
                  label="I’ve moved away / graduated (alumni)"
                  hint="You stay in the group but get no “nearby” alerts. Your alerts follow your current address."
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <form noValidate onSubmit={create} className="space-y-4">
            <h2 className="text-base font-bold text-ink-main flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add a community
            </h2>
            {full && <p className="text-xs text-status-error">You can be in up to {MAX} communities. Remove one to add another.</p>}
            <LocationFields
              idPrefix="com"
              value={loc}
              onChange={(c) => {
                setLoc((l) => ({ ...l, ...c }));
                setFormErrors((x) => ({ ...x, state: undefined, district: undefined, city: undefined, pinCode: undefined }));
              }}
              errors={{ state: formErrors.state, district: formErrors.district, city: formErrors.city, postalCode: formErrors.pinCode }}
              showCountry={false}
              postalCodeLabel="PIN code (optional)"
              postalCodeRequired={false}
              postalCodeHelper="Helps match requests at hospitals close by."
            />
            <Input
              id="com-name"
              label="Community name"
              required
              value={name}
              onChange={(e) => { setName(e.target.value); setFormErrors((x) => ({ ...x, name: undefined })); setDone(null); }}
              error={formErrors.name}
              helperText="e.g. Green Meadows Gated Community, JNTU Hyderabad, Infosys Gachibowli"
            />
            {matches.length > 0 && (
              <div className="rounded-xl border border-line-border p-3 space-y-2">
                <p className="text-xs font-semibold text-ink-secondary flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" /> Already added by others. Is it one of these?
                </p>
                {matches.map((c) => {
                  const joined = mine?.some((m) => m.id === c.id);
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink-main truncate">{c.name}</span>
                        <span className="block text-[11px] text-ink-muted">
                          {COMMUNITY_TYPE_LABELS[c.type]} · {c.locality ? `${c.locality}, ` : ''}{c.city} · {c.members.label} members
                        </span>
                      </span>
                      <Button size="sm" variant="outline" disabled={joined || full} isLoading={busy === `join-${c.id}`} onClick={() => joinExisting(c)}>
                        {joined ? 'Joined' : 'Join'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <Select
                id="com-type"
                label="Type"
                value={type}
                onChange={(e) => setType(e.target.value as CommunityType)}
                options={Object.entries(COMMUNITY_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <Input id="com-locality" label="Area / locality (optional)" value={locality} onChange={(e) => setLocality(e.target.value)} />
            </div>
            <p className="text-[11px] text-ink-muted">
              Not sure it’s safe to name your apartment? Only counts are ever shown, never who lives there. You can also pick a broader group, such as
              your area’s residents’ association.
            </p>
            <Button type="submit" variant="primary" isLoading={saving} disabled={full} leftIcon={<Plus className="w-4 h-4" />}>
              Add and join
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
