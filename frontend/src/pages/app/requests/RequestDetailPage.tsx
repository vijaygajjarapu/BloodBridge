import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Hospital,
  MapPin,
  Clock,
  Phone,
  PhoneOff,
  PhoneCall,
  ShieldCheck,
  Copy,
  Check,
  MessageCircle,
  PauseCircle,
  CheckCircle2,
  Users,
  Info,
} from 'lucide-react';
import { requestApi } from '../../../services/requestApi';
import type { BloodRequest, RequestStatus } from '../../../types/request';
import { STATUS_LABELS, COMPONENT_LABELS } from '../../../types/request';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { BloodGroupBadge } from '../../../components/ui/Badge';
import { ErrorBanner } from '../../../components/ui/ErrorBanner';
import { RequestStatusBadge, UrgencyBadge, VerificationBadge } from '../../../components/requests/RequestBits';
import { MaskedPhone, RevealNumbersButton } from '../../../components/ui/PhoneReveal';
import { NeverPayNotice, RequestDocumentsPanel, ReportRequestButton, DocumentResultBadge } from '../../../components/requests/SafetyBits';
import { formatDate } from '../../../constants/countries';
import { useT } from '../../../i18n/I18nProvider';
import { outreachApi } from '../../../services/outreachApi';
import { RemoteDonationCard, RemoteCreditsCard } from '../../../components/requests/RemoteDonationCard';
import { useAuth } from '../../../hooks/useAuth';
import { errorMessage as callErrorMessage } from '../../../utils/formErrors';
import { MatchingProgress } from '../../../components/requests/MatchingProgress';
import { errorMessage, errorTitle } from '../../../utils/formErrors';

const STATUS_HELP: Partial<Record<RequestStatus, string>> = {
  in_progress: 'A donor is at the hospital / donation is happening',
  partially_fulfilled: 'Some units received, still need more',
  fulfilled: 'All units received',
  cancelled: 'Blood is no longer needed',
  closed: 'Close this request',
};

export const RequestDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const t = useT();
  const { user: me } = useAuth();
  const location = useLocation();
  const navState = location.state as { justCreated?: boolean; savedDonorsAlerted?: number; docUploadFailed?: boolean } | null;
  const justCreated = Boolean(navState?.justCreated);
  const savedDonorsAlerted = navState?.savedDonorsAlerted || 0;
  const [r, setR] = useState<BloodRequest | null>(null);
  const [error, setError] = useState<{ title?: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // Calls through BloodNation (numbers stay hidden): which call is starting, and what to tell the person
  const [calling, setCalling] = useState<string | null>(null);
  const [callNote, setCallNote] = useState<{ key: string; text: string; ok: boolean } | null>(null);
  const maskedCall = async (key: string, fn: () => Promise<{ message: string }>) => {
    setCalling(key);
    setCallNote(null);
    try {
      const res = await fn();
      setCallNote({ key, text: res.message, ok: true });
    } catch (err) {
      setCallNote({ key, text: callErrorMessage(err, t('call.error')), ok: false });
    } finally {
      setCalling(null);
    }
  };
  const [shareNumber, setShareNumber] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    requestApi
      .get(id)
      .then((data) => {
        setR(data);
        if (data.myResponse && typeof data.myResponse === 'object') setShareNumber(data.myResponse.shareDirectNumber);
      })
      .catch((err) => setError({ title: errorTitle(err), message: errorMessage(err, 'Could not load this request.') }));
  }, [id]);

  useEffect(load, [load]);

  // Requester: refresh live progress every 20 s while the page is open and the tab is visible
  const isRequester = Boolean(r?.isRequester);
  useEffect(() => {
    if (!isRequester) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 20_000);
    return () => clearInterval(t);
  }, [isRequester, load]);

  const run = async (fn: () => Promise<BloodRequest>) => {
    setBusy(true);
    setError(null);
    try {
      setR(await fn());
    } catch (err) {
      setError({ title: errorTitle(err), message: errorMessage(err, 'Something went wrong. Please try again.') });
    } finally {
      setBusy(false);
    }
  };

  if (!r) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Link to="/app/requests" className="inline-flex items-center text-xs font-semibold text-ink-secondary min-h-[44px]">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to requests
        </Link>
        {error ? <ErrorBanner title={error.title} message={error.message} /> : <p className="text-sm text-ink-secondary">Loading…</p>}
      </div>
    );
  }

  const publicLink = `${window.location.origin}/r/${r.publicCode}`;
  const shareText = `${r.urgency === 'critical' ? 'URGENT: ' : ''}${r.bloodGroup} blood needed at ${r.hospitalName}, ${r.city}. If you can donate, open: ${publicLink}`;
  const myResponse = r.myResponse && typeof r.myResponse === 'object' ? r.myResponse : null;
  const accepted = myResponse?.status === 'accepted' || myResponse?.status === 'donated';

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link to={r.isRequester ? '/app/requests?tab=mine' : '/app/requests'} className="inline-flex items-center text-xs font-semibold text-ink-secondary hover:text-ink-main min-h-[44px]">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to requests
      </Link>

      {justCreated && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-900 flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>
            Request posted. {r.onHold ? 'Our safety team is checking it first; matching donors will be alerted as soon as it is approved.' : r.donorsNotified > 0
              ? `${r.donorsNotified} matching donor${r.donorsNotified === 1 ? ' was' : 's were'} alerted.`
              : 'No matching donors are registered in this district yet. Share the link below so more people see it.'}
            {savedDonorsAlerted > 0 && ` This includes ${savedDonorsAlerted} of your saved donor${savedDonorsAlerted === 1 ? '' : 's'}.`}
            {navState?.docUploadFailed && ' The document could not be uploaded; please add it again below.'}
          </span>
        </div>
      )}
      {error && <ErrorBanner title={error.title} message={error.message} />}
      {r.onHold && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 flex items-start gap-2">
          <PauseCircle className="w-5 h-5 shrink-0" />
          <span>
            This request is paused while our team reviews it. Donors can’t respond until it’s released.
            {r.isRequester && r.holdReason ? ` Reason: ${r.holdReason}` : ''}
          </span>
        </div>
      )}

      <Card>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <BloodGroupBadge group={r.bloodGroup} />
              <div>
                <h1 className="text-lg font-extrabold text-ink-main">
                  {r.unitsNeeded} unit{r.unitsNeeded > 1 ? 's' : ''} of {r.bloodGroup} · {COMPONENT_LABELS[r.component]}
                </h1>
                {r.isRequester && r.patientName && <p className="text-xs text-ink-secondary">For {r.patientName}</p>}
                {!r.isRequester && r.requesterFirstName && <p className="text-xs text-ink-secondary">Requested by {r.requesterFirstName}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <UrgencyBadge urgency={r.urgency} />
              <RequestStatusBadge status={r.status} />
              <VerificationBadge status={r.verificationStatus} />
              {r.documentStatus && r.documentStatus !== 'none' && <DocumentResultBadge result={r.documentStatus} />}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <p className="flex items-start gap-2"><Hospital className="w-4 h-4 text-brand-600 mt-0.5" /> {r.hospitalName}{r.hospitalArea ? `, ${r.hospitalArea}` : ''}{r.hospitalPinCode ? ` · PIN ${r.hospitalPinCode}` : ''}</p>
            <p className="flex items-start gap-2"><MapPin className="w-4 h-4 text-brand-600 mt-0.5" /> {r.city}, {r.district}, {r.state}</p>
            {r.neededBy && <p className="flex items-start gap-2"><Clock className="w-4 h-4 text-brand-600 mt-0.5" /> Needed by {formatDate(r.neededBy)} {new Date(r.neededBy).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>}
            <p className="flex items-start gap-2"><Users className="w-4 h-4 text-brand-600 mt-0.5" /> {r.unitsFulfilled} of {r.unitsNeeded} unit(s) received</p>
          </div>
          {r.notes && <p className="text-sm text-ink-secondary bg-gray-50 rounded-lg p-3">{r.notes}</p>}
        </CardContent>
      </Card>

      {/* ---------- Requester view ---------- */}
      {r.isRequester && (
        <>
          {r.matching && (
            <MatchingProgress
              matching={r.matching}
              unitsNeeded={r.unitsNeeded}
              live={['submitted', 'open', 'donors_notified', 'donor_found', 'in_progress', 'partially_fulfilled'].includes(r.status) && !r.onHold}
              busy={busy}
              onAlertMore={() => run(() => requestApi.alertMore(r.id))}
            />
          )}
          {r.remote && <RemoteCreditsCard requestId={r.id} summary={r.remote} />}
          <div className="flex justify-end">
            <Link to={`/app/requests/${r.id}/flyer`}>
              <Button size="sm" variant="outline">{t('flyer.open')}</Button>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <h2 className="text-base font-bold text-ink-main">Patient document</h2>
            </CardHeader>
            <CardContent className="p-5">
              <RequestDocumentsPanel requestId={r.id} urgency={r.urgency} onChange={load} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-ink-main">Donors who accepted</h2>
                {(r.responses || []).some((x) => x.phone) && <RevealNumbersButton />}
              </div>
              <p className="text-xs text-ink-secondary">
                {r.donorsNotified} matching donor{r.donorsNotified === 1 ? '' : 's'} alerted. Donors who accept have your number and will call you.
              </p>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              {callNote && callNote.key !== 'family' && (
                <p className={`text-xs ${callNote.ok ? 'text-status-success' : 'text-status-error'}`} role="status">{callNote.text}</p>
              )}
              {r.shareNumberInAlerts && <p className="text-xs text-ink-secondary">{t('req.numberInAlertsOn')}</p>}
              {(r.responses || []).length === 0 ? (
                <p className="text-sm text-ink-secondary">No donor has accepted yet. Share the link below to reach more people.</p>
              ) : (
                (r.responses || []).map((x) => (
                  <div key={x.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-border p-3">
                    <div className="flex items-center gap-3">
                      {x.donorBloodGroup && <BloodGroupBadge group={x.donorBloodGroup} size="sm" />}
                      {x.donorBloodGroupVerified && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5">
                          <ShieldCheck className="w-3 h-3" /> {t('verify.badge')}
                        </span>
                      )}
                      <div>
                        <p className="text-sm font-bold text-ink-main">{x.donorFirstName}</p>
                        <p className="text-xs text-ink-secondary">{x.status === 'donated' ? 'Donated, thank you!' : `Accepted ${formatDate(x.respondedAt)}`}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {x.phone ? (
                        <MaskedPhone phone={x.phone} asButton />
                      ) : (
                        r.maskedCallAvailable ? (
                          <Button
                            size="sm"
                            variant="outline"
                            isLoading={calling === x.id}
                            disabled={calling !== null}
                            title={t('call.viaAppHint')}
                            leftIcon={<PhoneCall className="w-4 h-4" />}
                            onClick={() => maskedCall(x.id, () => outreachApi.callDonor(r.id, x.id))}
                          >
                            {t('call.viaApp')}
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled leftIcon={<PhoneOff className="w-4 h-4" />} title="The donor's number is private. They have yours and will call you.">
                            {t('call.private')}
                          </Button>
                        )
                      )}
                      {x.status === 'accepted' && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => requestApi.markDonated(r.id, x.id))}>
                          Mark donated
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {(r.familyMemberDonors || []).length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-ink-main flex items-center gap-2">
                    <Users className="w-5 h-5 text-brand-500" /> Family members who can donate
                  </h2>
                  <RevealNumbersButton />
                </div>
                <p className="text-xs text-ink-secondary">
                  Your own family members who can donate (wherever the hospital is), and family members of BloodNation users near the
                  hospital who agreed to share their name and number. All match the blood group needed. Please call politely, ask when they
                  last donated, and never offer or ask for money.
                </p>
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                {(r.familyMemberDonors || []).map((d) => (
                  <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-border p-3">
                    <div className="flex items-center gap-3">
                      <BloodGroupBadge group={d.bloodGroup} size="sm" />
                      <div>
                        <p className="text-sm font-bold text-ink-main">{d.name}</p>
                        <p className="text-xs text-ink-secondary">
                          {d.yourFamily ? 'Your family' : d.city || 'Near the hospital'}
                        </p>
                      </div>
                    </div>
                    <MaskedPhone phone={d.phone} asButton />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <h2 className="text-base font-bold text-ink-main">Share this request</h2>
              <p className="text-xs text-ink-secondary">The public page shows only the blood group, hospital and city. No names or numbers.</p>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 bg-gray-50 border border-line-border rounded-lg px-3 py-2 text-xs font-mono truncate">{publicLink}</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="primary" leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  onClick={() => { navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                  {copied ? 'Copied' : 'Copy message'}
                </Button>
                <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" leftIcon={<MessageCircle className="w-4 h-4" />}>WhatsApp</Button>
                </a>
                <Link to={`/r/${r.publicCode}`} target="_blank">
                  <Button size="sm" variant="ghost">Preview public page</Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {r.allowedNextStatuses.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-base font-bold text-ink-main">Update status</h2>
              </CardHeader>
              <CardContent className="p-5 flex flex-wrap gap-2">
                {r.allowedNextStatuses.map((s) => (
                  <Button key={s} size="sm" variant={s === 'cancelled' ? 'outline' : 'secondary'} disabled={busy} title={STATUS_HELP[s]}
                    onClick={() => {
                      if (s === 'cancelled' && !window.confirm('Cancel this request? Donors who accepted will be told they don’t need to come.')) return;
                      run(() => requestApi.setStatus(r.id, s));
                    }}>
                    Mark {STATUS_LABELS[s].toLowerCase()}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ---------- Donor view ---------- */}
      {!r.isRequester && <NeverPayNotice />}
      {!r.isRequester && (r.remoteOffered || r.remote?.mine) && (
        <RemoteDonationCard requestId={r.id} initial={r.remote} myState={(me as { state?: string } | null)?.state} myDistrict={(me as { district?: string } | null)?.district} />
      )}
      {!r.isRequester && (
        <Card>
          <CardContent className="p-5 sm:p-6 space-y-4">
            {accepted ? (
              <>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-status-success shrink-0" />
                  <div>
                    <p className="text-base font-bold text-ink-main">
                      {myResponse?.status === 'donated' ? t('donor.donated') : t('donor.accepted')}
                    </p>
                    <p className="text-xs text-ink-secondary">{t('donor.tellWhen', { hospital: r.hospitalName })}</p>
                  </div>
                </div>
                {r.maskedCallAvailable && (
                  <div>
                    <Button
                      variant="outline"
                      isLoading={calling === 'family'}
                      leftIcon={<PhoneCall className="w-4 h-4" />}
                      onClick={() => maskedCall('family', () => outreachApi.callFamily(r.id))}
                    >
                      {t('call.viaApp')}
                    </Button>
                    <p className={`mt-1 text-[11px] ${callNote?.key === 'family' && !callNote.ok ? 'text-status-error' : 'text-ink-muted'}`}>
                      {callNote?.key === 'family' ? callNote.text : t('call.viaAppHint')}
                    </p>
                  </div>
                )}
                {r.requesterPhone && (
                  <a href={`tel:${r.requesterPhone.replace(/\s/g, '')}`} className="inline-block">
                    <Button variant="primary" size="lg" leftIcon={<Phone className="w-5 h-5" />}>{t('donor.call', { name: r.requesterFirstName || '', phone: r.requesterPhone })}</Button>
                  </a>
                )}
                {myResponse?.status === 'accepted' && (
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Checkbox
                      label={t('donor.shareNumber')}
                      checked={shareNumber}
                      onChange={(e) => {
                        setShareNumber(e.target.checked);
                        run(() => requestApi.respond(r.id, 'accept', e.target.checked));
                      }}
                    />
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => requestApi.respond(r.id, 'withdraw'))}>
                      {t('donor.cantCome')}
                    </Button>
                  </div>
                )}
              </>
            ) : r.canRespond ? (
              <>
                <h2 className="text-base font-bold text-ink-main">{t('donor.canYouDonate')}</h2>
                {r.requesterPhone && (
                  <p className="text-sm text-ink-main">
                    <a className="font-semibold text-brand-600 underline" href={`tel:${r.requesterPhone.replace(/\s/g, '')}`}>
                      {t('quick.familyNumber', { phone: r.requesterPhone })}
                    </a>
                  </p>
                )}
                <p className="text-xs text-ink-secondary flex items-start gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-status-success shrink-0" />
                  {t('donor.acceptHint')}
                </p>
                <Checkbox
                  label={t('donor.shareNumber')}
                  checked={shareNumber}
                  onChange={(e) => setShareNumber(e.target.checked)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" size="lg" isLoading={busy} id="accept-request" onClick={() => run(() => requestApi.respond(r.id, 'accept', shareNumber))}>
                    {t('donor.yes')}
                  </Button>
                  <Button variant="outline" size="lg" disabled={busy} onClick={() => run(() => requestApi.respond(r.id, 'decline'))}>
                    {t('donor.no')}
                  </Button>
                </div>
                {myResponse?.status === 'declined' && <p className="text-xs text-ink-muted">{t('donor.declined')}</p>}
              </>
            ) : (
              <p className="text-sm text-ink-secondary flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" /> {r.cannotRespondReason || t('donor.cannotRespond')}
              </p>
            )}
            <div className="pt-2 border-t border-line-border">
              <ReportRequestButton requestId={r.id} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
