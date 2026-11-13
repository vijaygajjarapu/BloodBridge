import React, { useCallback, useEffect, useState } from 'react';
import { Users, UserPlus, Trash2, Share2, Copy, Check, MessageCircle, Smartphone, HeartHandshake, Pencil, X, Droplet, Lock } from 'lucide-react';
import { familyApi } from '../../services/familyApi';
import type { FamilyMember, FamilyMemberInput, FamilyInviteInfo, MyPledge, FamilyRelation } from '../../types/family';
import type { BloodGroup } from '../../types/donor';
import { BLOOD_GROUPS } from '../../constants/bloodGroups';
import { appConfig } from '../../constants/config';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Checkbox } from '../../components/ui/Checkbox';
import { useAuth } from '../../hooks/useAuth';
import { BloodGroupBadge } from '../../components/ui/Badge';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { FamilyCircleCard } from '../../components/family/FamilyCircleCard';
import { useSubscription } from '../../hooks/useSubscription';
import { SubscribeToShareNotice } from '../../components/subscription/SubscribeToShareNotice';
import { PartnerCodeCard } from '../../components/subscription/PartnerCodeCard';
import { RELATION_LABELS, RELATION_OPTIONS } from '../../components/family/relations';
import { PlanSections } from '../../components/subscription/PlanSections';
import { getFieldErrors, errorMessage, errorTitle } from '../../utils/formErrors';

const EMPTY: FamilyMemberInput = {
  name: '',
  relation: 'spouse',
  bloodGroup: 'O+',
  dateOfBirth: '',
  willingToDonate: false,
  useOwnerPhone: false,
  donorPhone: '',
  contactConsent: false,
};

const MIN_DONOR_AGE = 18;
const MAX_DONOR_AGE = 65;

function ageFrom(dob: string): number | null {
  const d = new Date(dob);
  if (!dob || isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

/** Shown next to the consent checkbox and stored on the server with the date it was given */
const consentWording = (name: string) =>
  `${name.trim() || 'This family member'} agrees that BloodNation may show their name and mobile number to a person whose blood request they match, and to families you have pledged to help (their Donor Circle), so they can call them about donating blood. They can withdraw this at any time.`;

export const FamilyPage: React.FC = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FamilyMemberInput>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ title?: string; message: string } | null>(null);

  const [invite, setInvite] = useState<FamilyInviteInfo | null>(null);
  // Sharing the family invite link is a subscriber feature
  const { subscribed: canShare, loading: subLoading } = useSubscription();
  const shareLocked = !subLoading && !canShare;
  const [copied, setCopied] = useState(false);
  const [pledges, setPledges] = useState<MyPledge[]>([]);
  const [circleKey, setCircleKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([familyApi.listMembers(), familyApi.myPledges()]);
      setMembers(m);
      setPledges(p);
    } catch (e) {
      setBanner({ title: errorTitle(e), message: errorMessage(e, 'Could not load your family.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!appConfig.isDemo) load();
    else setLoading(false);
  }, [load]);

  const neededGroups = [...new Set(members.map((m) => m.bloodGroup))];

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 2) errs.name = 'Enter the family member’s name (at least 2 letters).';
    if (!form.relation) errs.relation = 'Choose how this person is related to you.';
    if (!form.bloodGroup) errs.bloodGroup = 'Choose a blood group.';
    if (form.dateOfBirth && new Date(form.dateOfBirth) >= new Date()) errs.dateOfBirth = 'Enter a date of birth in the past.';
    if (form.willingToDonate) {
      const age = ageFrom(form.dateOfBirth || '');
      if (form.relation === 'self') errs.willingToDonate = 'You donate through your own donor profile. This option is for other family members.';
      if (age === null) errs.dateOfBirth = 'Enter their date of birth. Only people aged 18 or older can be donors.';
      else if (age < MIN_DONOR_AGE) errs.dateOfBirth = `Only family members aged ${MIN_DONOR_AGE} or older can be donors.`;
      else if (age > MAX_DONOR_AGE) errs.dateOfBirth = `Donors must be ${MAX_DONOR_AGE} or younger.`;
      if (form.useOwnerPhone) {
        if (!user?.phone) errs.useOwnerPhone = 'Add your mobile number to your profile first, or enter their own number.';
      } else if (!(form.donorPhone || '').trim()) {
        errs.donorPhone = 'Enter their mobile number, or tick “Use same mobile number”.';
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: FamilyMemberInput = form.willingToDonate
        ? {
            ...form,
            name: form.name.trim(),
            dateOfBirth: form.dateOfBirth || null,
            donorPhone: form.useOwnerPhone ? null : (form.donorPhone || '').trim(),
          }
        : { name: form.name.trim(), relation: form.relation, bloodGroup: form.bloodGroup, dateOfBirth: form.dateOfBirth || null, willingToDonate: false };
      const next = editingId ? await familyApi.updateMember(editingId, payload) : await familyApi.addMember(payload);
      setMembers(next);
      setForm(EMPTY);
      setEditingId(null);
      setInvite(null);
      setCircleKey((k) => k + 1);
    } catch (err) {
      const fe = getFieldErrors(err);
      setFieldErrors(fe);
      setBanner({ title: errorTitle(err), message: errorMessage(err, 'Could not save this family member.') });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (m: FamilyMember) => {
    setEditingId(m.id);
    setFieldErrors({});
    setForm({
      name: m.name,
      relation: m.relation,
      bloodGroup: m.bloodGroup,
      dateOfBirth: m.dateOfBirth || '',
      willingToDonate: m.willingToDonate,
      useOwnerPhone: m.useOwnerPhone,
      donorPhone: m.donorPhone || '',
      contactConsent: m.contactConsent,
    });
  };

  const remove = async (m: FamilyMember) => {
    if (!window.confirm(`Remove ${m.name} from your family list?`)) return;
    try {
      setMembers(await familyApi.removeMember(m.id));
      setInvite(null);
      setCircleKey((k) => k + 1);
    } catch (err) {
      setBanner({ title: errorTitle(err), message: errorMessage(err) });
    }
  };

  const createInvite = async () => {
    setBanner(null);
    try {
      setInvite(await familyApi.getInvite());
    } catch (err) {
      setBanner({ title: errorTitle(err), message: errorMessage(err, 'Could not create the invite link.') });
    }
  };

  const inviteLink = invite ? `${window.location.origin}/family-invite/${invite.code}` : '';
  const inviteMessage = invite
    ? `My family may need blood in an emergency. Blood groups needed: ${invite.bloodGroups.join(', ')}. ` +
      `If you can donate any of these, please pledge here (free): ${inviteLink}`
    : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setBanner({ message: 'Could not copy. Please select the text and copy it manually.' });
    }
  };

  const setPermission = async (p: MyPledge, key: keyof MyPledge['permissions'], value: boolean) => {
    const before = pledges;
    setPledges((list) => list.map((x) => (x.ownerUserId === p.ownerUserId ? { ...x, permissions: { ...x.permissions, [key]: value } } : x)));
    try {
      await familyApi.updatePermissions(p.ownerUserId, { [key]: value });
    } catch (err) {
      setPledges(before);
      setBanner({ title: errorTitle(err), message: errorMessage(err, 'Could not save this permission.') });
    }
  };

  const withdraw = async (p: MyPledge) => {
    if (!window.confirm(`Stop being a donor for ${p.familyOf}'s family?`)) return;
    try {
      setPledges(await familyApi.withdraw(p.ownerUserId));
    } catch (err) {
      setBanner({ title: errorTitle(err), message: errorMessage(err) });
    }
  };

  if (appConfig.isDemo) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-ink-secondary">
          My Family works with the live backend. Start the full app (2 - Start Full App) to use it.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-ink-main tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6 text-brand-500" /> My Family
        </h1>
        <p className="text-sm text-ink-secondary">
          Add the people you may need blood for, then invite anyone willing to donate: relatives, friends, colleagues, neighbours. Everyone who pledges joins your Donor Circle.
        </p>
      </div>

      <PlanSections />

      {banner && <ErrorBanner title={banner.title} message={banner.message} />}

      {/* Family members */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-bold text-ink-main">Family members</h2>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 space-y-5">
          {loading ? (
            <p className="text-xs text-ink-secondary">Loading…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-ink-secondary">No family members yet. Add the first one below (you can add yourself too).</p>
          ) : (
            <ul className="divide-y divide-line-border border border-line-border rounded-xl">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <BloodGroupBadge group={m.bloodGroup} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-main truncate">{m.name}</p>
                      <p className="text-xs text-ink-secondary">{RELATION_LABELS[m.relation]}</p>
                      {m.willingToDonate && (
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="inline-flex items-center gap-1 font-semibold text-brand-700 bg-brand-50 rounded px-1.5 py-0.5">
                            <Droplet className="w-3 h-3" /> Willing to donate
                          </span>
                          {m.contactConsent ? (
                            <span className="text-emerald-700">Name and number shown to matching requests</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-ink-secondary">
                              <Lock className="w-3 h-3" /> Not shared (no consent)
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(m)}
                      className="p-2 rounded-lg text-ink-secondary hover:bg-gray-100 min-h-[40px] min-w-[40px]"
                      aria-label={`Edit ${m.name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(m)}
                      className="p-2 rounded-lg text-status-error hover:bg-red-50 min-h-[40px] min-w-[40px]"
                      aria-label={`Remove ${m.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form noValidate onSubmit={onSubmit} className="space-y-3 rounded-xl bg-gray-50 p-4 border border-line-border">
            <p className="text-sm font-semibold text-ink-main flex items-center gap-2">
              {editingId ? <Pencil className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {editingId ? 'Edit family member' : 'Add a family member'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                id="family-name"
                label="Name"
                required
                placeholder="e.g. Lakshmi"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                error={fieldErrors.name}
              />
              <Select
                id="family-relation"
                label="Relation"
                required
                value={form.relation}
                onChange={(e) => setForm({ ...form, relation: e.target.value as FamilyRelation })}
                options={RELATION_OPTIONS}
                error={fieldErrors.relation}
              />
              <Select
                id="family-blood-group"
                label="Blood group"
                required
                value={form.bloodGroup}
                onChange={(e) => setForm({ ...form, bloodGroup: e.target.value as BloodGroup })}
                options={BLOOD_GROUPS.map((g) => ({ value: g.value, label: g.label }))}
                error={fieldErrors.bloodGroup}
              />
              <Input
                id="family-dob"
                label="Date of birth (optional)"
                type="date"
                value={form.dateOfBirth || ''}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                error={fieldErrors.dateOfBirth}
              />
            </div>

            {/* Optional: this family member can donate blood */}
            <div className="rounded-lg border border-line-border bg-white p-3 space-y-2">
              <Checkbox
                id="family-willing"
                label="Eligible to donate blood?"
                description="Optional. Tick if this family member is 18 or older and willing to donate when someone nearby needs their blood group."
                checked={!!form.willingToDonate}
                onChange={(e) => setForm({ ...form, willingToDonate: e.target.checked })}
                error={fieldErrors.willingToDonate}
              />
              {form.willingToDonate && (
                <div className="pl-7 space-y-2">
                  <p className="text-xs text-ink-secondary">
                    Name: <strong className="text-ink-main">{form.name.trim() || '—'}</strong>. A date of birth is needed (18 to 65).
                  </p>
                  <Checkbox
                    id="family-same-phone"
                    label="Use same mobile number"
                    description={user?.phone ? `Reach them on your number (${user.phone}).` : 'Your profile has no mobile number yet.'}
                    checked={!!form.useOwnerPhone}
                    onChange={(e) => setForm({ ...form, useOwnerPhone: e.target.checked, contactConsent: false })}
                    error={fieldErrors.useOwnerPhone}
                  />
                  {!form.useOwnerPhone && (
                    <Input
                      id="family-donor-phone"
                      label="Their mobile number"
                      type="tel"
                      inputMode="tel"
                      required
                      placeholder="e.g. 98765 43210"
                      value={form.donorPhone || ''}
                      onChange={(e) => setForm({ ...form, donorPhone: e.target.value, contactConsent: false })}
                      error={fieldErrors.donorPhone}
                    />
                  )}
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <Checkbox
                      id="family-consent"
                      label={`${form.name.trim() || 'This family member'} has agreed to share their name and mobile number`}
                      description={
                        <>
                          {consentWording(form.name)} Ask them first. Without this, they are saved as willing but their details are never shown to
                          anyone. Changing the number needs their consent again.
                        </>
                      }
                      checked={!!form.contactConsent}
                      onChange={(e) => setForm({ ...form, contactConsent: e.target.checked })}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              {editingId && (
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<X className="w-4 h-4" />}
                  onClick={() => {
                    setEditingId(null);
                    setForm(EMPTY);
                    setFieldErrors({});
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" variant="primary" isLoading={saving}>
                {editingId ? 'Save changes' : 'Add to family'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Invite donors */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-bold text-ink-main flex items-center gap-2">
            <Share2 className="w-5 h-5 text-brand-500" /> Invite people to your Donor Circle
          </h2>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <p className="text-xs text-ink-secondary">
            The invite shows <strong>only the blood groups</strong> your family may need and your first name. Family members’ names
            and other details are never shared.
          </p>
          {neededGroups.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {neededGroups.map((g) => (
                <BloodGroupBadge key={g} group={g} />
              ))}
            </div>
          )}

          {shareLocked ? (
            <div className="space-y-3">
              <SubscribeToShareNotice compact />
              <PartnerCodeCard onRedeemed={() => setTimeout(() => window.location.reload(), 1500)} />
            </div>
          ) : subLoading ? null : !invite ? (
            <Button variant="primary" onClick={createInvite} disabled={!members.length} leftIcon={<Share2 className="w-4 h-4" />}>
              Create invite message
            </Button>
          ) : (
            <div className="space-y-3">
              <textarea
                readOnly
                value={inviteMessage}
                rows={4}
                className="w-full text-sm p-3 rounded-lg border border-line-border bg-gray-50"
                aria-label="Invite message"
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" size="sm" onClick={copy} leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}>
                  {copied ? 'Copied' : 'Copy message'}
                </Button>
                <a href={`https://wa.me/?text=${encodeURIComponent(inviteMessage)}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" leftIcon={<MessageCircle className="w-4 h-4" />}>
                    WhatsApp
                  </Button>
                </a>
                <a href={`sms:?&body=${encodeURIComponent(inviteMessage)}`}>
                  <Button variant="outline" size="sm" leftIcon={<Smartphone className="w-4 h-4" />}>
                    SMS
                  </Button>
                </a>
                {typeof navigator.share === 'function' && (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Share2 className="w-4 h-4" />}
                    onClick={() => navigator.share({ title: 'Blood donor invite', text: inviteMessage }).catch(() => undefined)}
                  >
                    More…
                  </Button>
                )}
              </div>
            </div>
          )}
          {!members.length && <p className="text-xs text-ink-muted">Add at least one family member first.</p>}
        </CardContent>
      </Card>

      {/* Who is ready to donate (blurred until subscribed) */}
      <FamilyCircleCard key={circleKey} />

      {/* Families I've pledged to */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-bold text-ink-main flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-brand-500" /> Families you’ve pledged to help
          </h2>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">
          {pledges.length === 0 ? (
            <p className="text-xs text-ink-secondary">
              When someone sends you a family invite and you pledge, it shows here. Donating is always free.
            </p>
          ) : (
            <ul className="divide-y divide-line-border">
              {pledges.map((p) => (
                <li key={p.ownerUserId} className="py-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink-main">{p.familyOf}’s family</p>
                      <div className="flex gap-1 mt-1">
                        {p.bloodGroups.map((g) => (
                          <BloodGroupBadge key={g} group={g} size="sm" />
                        ))}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => withdraw(p)}>
                      Withdraw
                    </Button>
                  </div>
                  <fieldset className="rounded-lg bg-gray-50 p-3 space-y-1.5">
                    <legend className="sr-only">What {p.familyOf} can see and send</legend>
                    {(
                      [
                        ['shareContact', `${p.familyOf} can see my mobile number and call me`],
                        ['allowRequestAlerts', `Send me ${p.familyOf}’s emergency blood requests, wherever I am`],
                        ['shareAvailability', `${p.familyOf} can see if I can donate right now`],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-xs text-ink-main">
                        <input
                          type="checkbox"
                          checked={p.permissions[key]}
                          onChange={(e) => setPermission(p, key, e.target.checked)}
                        />
                        {label}
                      </label>
                    ))}
                    <p className="text-[11px] text-ink-muted">Only {p.familyOf} sees these, never other family members.</p>
                  </fieldset>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
