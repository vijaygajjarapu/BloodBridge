import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, ShieldCheck, Phone, Users, HeartHandshake, Loader2, Droplet } from 'lucide-react';
import { familyApi } from '../../services/familyApi';
import type { FamilyCircle } from '../../types/family';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { BloodGroupBadge } from '../ui/Badge';
import { appConfig } from '../../constants/config';
import { formatDate } from '../../constants/countries';
import { RELATION_LABELS, relationTo } from './relations';
import { MaskedPhone, RevealNumbersButton } from '../ui/PhoneReveal';

/**
 * Donor Circle: every family member with the donors who pledged that member's blood group.
 * Without a subscription the server sends only counts, and this card shows a blurred preview.
 */
export const FamilyCircleCard: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [circle, setCircle] = useState<FamilyCircle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ending a relationship (owner side): stops everything shared; optionally don't let them pledge again
  const [removing, setRemoving] = useState<{ donorUserId: string; name: string } | null>(null);
  const [blockAgain, setBlockAgain] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);

  const loadCircle = () =>
    familyApi
      .circle()
      .then(setCircle)
      .catch((e: { message?: string }) => setError(e?.message || 'Could not load your Donor Circle.'))
      .finally(() => setLoading(false));

  useEffect(() => {
    if (appConfig.isDemo) {
      setLoading(false);
      return;
    }
    loadCircle();
  }, []);

  const endRelationship = (donorUserId: string, name: string) => {
    setBlockAgain(false);
    setRemoving({ donorUserId, name });
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await familyApi.endRelationship(removing.donorUserId, blockAgain);
      setRemoving(null);
      await loadCircle();
    } catch (e) {
      setError((e as { message?: string })?.message || 'Could not remove this donor.');
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <Card className="border-line-border">
      {removing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="remove-donor-title">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 id="remove-donor-title" className="text-base font-bold text-ink-main">Remove {removing.name} from your circle?</h3>
            <p className="text-sm text-ink-secondary">
              Everything shared with {removing.name} stops now: you won’t see their number, and your family’s requests won’t be sent to them.
            </p>
            <label className="flex items-start gap-2 text-sm text-ink-main">
              <input type="checkbox" className="mt-1" checked={blockAgain} onChange={(e) => setBlockAgain(e.target.checked)} id="block-donor" />
              <span>
                Also don’t let {removing.name} pledge to my family again
                <span className="block text-xs text-ink-muted">They won’t be able to use your invite link any more.</span>
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRemoving(null)} disabled={removeBusy}>Keep</Button>
              <Button variant="danger" size="sm" onClick={confirmRemove} isLoading={removeBusy} id="confirm-remove-donor">Remove</Button>
            </div>
          </div>
        </div>
      )}
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink-main flex items-center gap-2">
              <HeartHandshake className="w-5 h-5 text-brand-500" />
              Donor Circle
            </h2>
            <p className="text-xs text-ink-secondary mt-0.5">
              People who pledged to donate for you, matched to each person’s blood group.
            </p>
          </div>
          {circle && circle.totalDonors > 0 && (
            <span className="text-xs font-semibold bg-emerald-50 text-status-success px-2.5 py-1 rounded-full whitespace-nowrap">
              {circle.totalDonors} donor{circle.totalDonors === 1 ? '' : 's'} ready
            </span>
          )}
        </div>

        {appConfig.isDemo && (
          <p className="text-xs text-ink-secondary">Available in the full app (live backend), not in demo mode.</p>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-ink-secondary">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        )}
        {error && <p className="text-xs text-status-error">{error}</p>}

        {circle && circle.members.length === 0 && (
          <div className="rounded-xl border border-dashed border-line-border p-4 text-center space-y-2">
            <Users className="w-6 h-6 text-ink-muted mx-auto" />
            <p className="text-sm text-ink-main font-medium">Add your family members to get started</p>
            <p className="text-xs text-ink-secondary">We only use their blood groups when inviting donors.</p>
            <Link to="/app/family">
              <Button size="sm" variant="primary">Add family members</Button>
            </Link>
          </div>
        )}

        {/* Your own family members who can donate: always shown (no subscription needed, it's your family) */}
        {circle && (circle.familyDonors || []).length > 0 && (
          <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3 space-y-2">
            <p className="text-xs font-bold text-ink-main flex items-center gap-1.5">
              <Droplet className="w-3.5 h-3.5 text-brand-500" /> From your family ({(circle.familyDonors || []).length})
            </p>
            <ul className="divide-y divide-line-border">
              {(circle.familyDonors || []).slice(0, compact ? 3 : undefined).map((f) => (
                <li key={f.memberId} className="py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-2 min-w-0">
                    <BloodGroupBadge group={f.bloodGroup} size="sm" />
                    <span className="min-w-0">
                      <span className="font-semibold text-ink-main">{f.name}</span>{' '}
                      <span className="text-ink-secondary">{RELATION_LABELS[f.relation] || f.relation}</span>
                      <span className="block text-ink-secondary">
                        {f.canGiveTo.length ? `Can give to: ${f.canGiveTo.join(', ')}` : 'No one in your list has a blood group they can give to'}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={f.sharedOutsideFamily ? 'text-emerald-700' : 'text-ink-muted'}>
                      {f.sharedOutsideFamily ? 'Also offered to people nearby' : 'Family only'}
                    </span>
                    {f.phone && <MaskedPhone phone={f.phone} />}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {circle && circle.members.length > 0 && (
          <div className="relative">
            {!circle.locked && circle.members.some((m) => m.donors.some((d) => d.phone)) && (
              <div className="flex justify-end -mt-2 mb-1">
                <RevealNumbersButton />
              </div>
            )}
            <ul className={`space-y-3 ${circle.locked ? 'select-none' : ''}`} aria-hidden={circle.locked}>
              {circle.members.slice(0, compact ? 4 : undefined).map((m) => (
                <li key={m.memberId} className="rounded-xl border border-line-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <BloodGroupBadge group={m.bloodGroup} size="sm" />
                      <span className="text-sm font-semibold text-ink-main truncate">{m.name}</span>
                      {m.memberId !== 'you' && <span className="text-xs text-ink-secondary">{RELATION_LABELS[m.relation] || m.relation}</span>}
                    </div>
                    <span className="text-xs text-ink-secondary whitespace-nowrap">
                      {m.donorCount} ready
                    </span>
                  </div>

                  {circle.locked ? (
                    // Placeholder rows only: real names and numbers are never sent before subscribing
                    m.donorCount - (m.familyDonorCount || 0) > 0 && (
                      <ul className="mt-2 space-y-1 blur-[5px]">
                        {Array.from({ length: Math.min(m.donorCount - (m.familyDonorCount || 0), 3) }).map((_, i) => (
                          <li key={i} className="flex justify-between text-xs text-ink-secondary">
                            <span>Donor name hidden</span>
                            <span>+91 ••••• •••••</span>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : m.donors.length ? (
                    <ul className="mt-2 divide-y divide-line-border">
                      {m.donors.map((d) => (
                        <li key={d.pledgeId} className="py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="flex items-center gap-2">
                            <span className="font-medium text-ink-main">{d.name}</span>
                            {d.source === 'family' && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-brand-50 text-brand-700">
                                Family{d.donorBloodGroup ? ` · ${d.donorBloodGroup}` : ''}
                              </span>
                            )}
                            {d.source === 'pledger_family' && (
                              <span
                                className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700"
                                title={`${d.name} agreed to donate for families that ${d.via} pledged to help`}
                              >
                                {relationTo(d.via || 'Donor', d.relation)}{d.donorBloodGroup ? ` · ${d.donorBloodGroup}` : ''}
                              </span>
                            )}
                            {d.availability && (
                              <span
                                className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                  d.availability === 'available'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : d.availability === 'recently_donated'
                                      ? 'bg-amber-50 text-amber-800'
                                      : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {d.availability === 'available' ? 'Can donate now' : d.availability === 'recently_donated' ? 'Donated recently' : 'Not available'}
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-3">
                            <span className="text-ink-muted hidden sm:inline">since {formatDate(d.pledgedAt)}</span>
                            {d.phone ? (
                              <MaskedPhone phone={d.phone} />
                            ) : (
                              <span className="text-ink-muted" title="This donor gets your requests but keeps their number private">
                                Number private
                              </span>
                            )}
                            {!compact && d.source !== 'family' && d.donorUserId && (
                              <button
                                type="button"
                                onClick={() => endRelationship(d.donorUserId!, d.name)}
                                className="text-ink-muted hover:text-status-error font-semibold"
                                aria-label={`Remove ${d.name} from your circle`}
                              >
                                Remove
                              </button>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-ink-muted">No donors for {m.bloodGroup} yet. Share your invite link.</p>
                  )}
                </li>
              ))}
            </ul>

            {circle.locked && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px] rounded-xl">
                <div className="text-center max-w-xs p-4 space-y-2 bg-white/90 rounded-xl shadow-md border border-brand-100">
                  <Lock className="w-6 h-6 text-brand-500 mx-auto" />
                  <p className="text-sm font-bold text-ink-main">Subscribe to keep your family safe</p>
                  <p className="text-xs text-ink-secondary">
                    See who is ready to donate for each family member and call them directly in an emergency.
                  </p>
                  <p className="text-[11px] text-ink-muted">Finding donors and posting requests are free for everyone.</p>
                  <Link to="/app/subscribe">
                    <Button size="sm" variant="primary" leftIcon={<ShieldCheck className="w-4 h-4" />}>
                      Subscribe
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {compact && circle && circle.members.length > 0 && (
          <div className="text-right">
            <Link to="/app/family" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              Manage family &amp; invite donors →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
