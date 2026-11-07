import React, { useCallback, useEffect, useState } from 'react';
import { Siren, PauseCircle, PlayCircle, ShieldCheck, ShieldX, Eye } from 'lucide-react';
import { requestApi } from '../../services/requestApi';
import type { BloodRequest, VerificationStatus } from '../../types/request';
import { STATUS_LABELS, VERIFICATION_LABELS } from '../../types/request';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BloodGroupBadge } from '../../components/ui/Badge';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { CountryFilter } from '../../components/forms/CountryFilter';
import { RequestStatusBadge, UrgencyBadge, VerificationBadge } from '../../components/requests/RequestBits';
import { DocumentChecks, DocumentResultBadge } from '../../components/requests/SafetyBits';
import type { RequestDocumentItem } from '../../types/request';
import { formatDate } from '../../constants/countries';
import { errorMessage } from '../../utils/formErrors';

/** Admin: review blood requests (verification track) and pause/release them (hold) */
export const AdminRequestsPage: React.FC = () => {
  const [country, setCountry] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [verification, setVerification] = useState('ALL');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: BloodRequest[]; total: number; totalPages: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [docs, setDocs] = useState<Record<string, RequestDocumentItem[] | 'loading'>>({});

  const toggleDocs = (id: string) => {
    if (docs[id]) {
      setDocs((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      return;
    }
    setDocs((d) => ({ ...d, [id]: 'loading' }));
    requestApi
      .adminDocuments(id)
      .then((list) => setDocs((d) => ({ ...d, [id]: list })))
      .catch((err) => {
        setError(errorMessage(err, 'Could not load documents.'));
        setDocs((d) => ({ ...d, [id]: [] }));
      });
  };

  const load = useCallback(() => {
    setError(null);
    requestApi
      .adminList({ country, status, verification, page, pageSize: 10 })
      .then(setData)
      .catch((err) => setError(errorMessage(err, 'Could not load blood requests.')));
  }, [country, status, verification, page]);

  useEffect(load, [load]);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await fn();
      load();
    } catch (err) {
      setError(errorMessage(err, 'The change could not be saved.'));
    } finally {
      setBusyId(null);
    }
  };

  const verify = (r: BloodRequest, v: VerificationStatus) => {
    let note: string | undefined;
    if (v === 'rejected') {
      const reason = window.prompt('Reason for not approving (shown to the requester):');
      if (reason === null) return;
      note = reason.trim() || undefined;
    }
    act(r.id, () => requestApi.adminVerify(r.id, v, note));
  };

  const hold = (r: BloodRequest) => {
    if (r.onHold) return act(r.id, () => requestApi.adminHold(r.id, false));
    const reason = window.prompt('Why pause this request? (shown to the requester)');
    if (reason === null) return;
    act(r.id, () => requestApi.adminHold(r.id, true, reason.trim() || undefined));
  };

  const selectCls = 'text-xs border border-line-border rounded-lg px-2 py-1.5 bg-white';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-main flex items-center gap-2"><Siren className="w-6 h-6 text-brand-600" /> Blood Requests</h1>
          <p className="text-xs text-ink-secondary">Verify requests, reject fake ones, or pause a request while you check it.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CountryFilter value={country} onChange={(v) => { setCountry(v); setPage(1); }} />
          <select aria-label="Filter by status" className={selectCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="ALL">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select aria-label="Filter by verification" className={selectCls} value={verification} onChange={(e) => { setVerification(e.target.value); setPage(1); }}>
            <option value="ALL">All verification</option>
            {Object.entries(VERIFICATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="space-y-3">
        {data?.items.length === 0 && (
          <Card><CardContent className="p-8 text-center text-sm text-ink-secondary">No blood requests match these filters.</CardContent></Card>
        )}
        {data?.items.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <BloodGroupBadge group={r.bloodGroup} />
                  <div>
                    <p className="text-sm font-bold text-ink-main">{r.unitsNeeded} unit(s) for {r.patientName} · {r.hospitalName}</p>
                    <p className="text-xs text-ink-secondary">{r.city}, {r.district}, {r.state} · {r.publicCode} · {formatDate(r.createdAt)}</p>
                    <p className="text-xs text-ink-secondary">Requester: {r.requesterName} · {r.requesterEmail} · {r.requesterPhone}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <UrgencyBadge urgency={r.urgency} />
                  <RequestStatusBadge status={r.status} />
                  <VerificationBadge status={r.verificationStatus} />
                  {r.onHold && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">On hold</span>}
                  {r.documentStatus && <DocumentResultBadge result={r.documentStatus} />}
                  {typeof r.riskScore === 'number' && (
                    <span
                      data-risk={r.riskLevel}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        r.riskLevel === 'high' ? 'bg-red-600 text-white' : r.riskLevel === 'medium' ? 'bg-orange-100 text-orange-800' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      Risk {r.riskScore}
                    </span>
                  )}
                  {(r.reportCount || 0) > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700">{r.reportCount} report(s)</span>
                  )}
                </div>
              </div>
              {r.riskFlags && r.riskFlags.length > 0 && (
                <ul className="rounded-lg bg-orange-50 border border-orange-200 p-2.5 space-y-0.5">
                  {r.riskFlags.map((f) => (
                    <li key={f.code} className="text-xs text-orange-900">⚠ {f.label} <span className="text-orange-700">(+{f.points})</span></li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-ink-secondary">{r.donorsNotified} donors alerted · {r.acceptedCount || 0} accepted · {r.unitsFulfilled}/{r.unitsNeeded} received{r.holdReason ? ` · Hold reason: ${r.holdReason}` : ''}</p>
              <div className="flex flex-wrap gap-2">
                {r.verificationStatus !== 'pending_review' && r.verificationStatus !== 'rejected' && (
                  <Button size="sm" variant="outline" leftIcon={<Eye className="w-4 h-4" />} disabled={busyId === r.id} onClick={() => verify(r, 'pending_review')}>Mark under review</Button>
                )}
                {r.verificationStatus !== 'verified' && r.verificationStatus !== 'rejected' && (
                  <Button size="sm" variant="secondary" leftIcon={<ShieldCheck className="w-4 h-4" />} disabled={busyId === r.id} onClick={() => verify(r, 'verified')}>Verify</Button>
                )}
                {r.verificationStatus !== 'rejected' && (
                  <Button size="sm" variant="danger" leftIcon={<ShieldX className="w-4 h-4" />} disabled={busyId === r.id} onClick={() => verify(r, 'rejected')}>Reject</Button>
                )}
                <Button size="sm" variant="outline" leftIcon={r.onHold ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />} disabled={busyId === r.id} onClick={() => hold(r)}>
                  {r.onHold ? 'Release hold' : 'Put on hold'}
                </Button>
                {r.documentStatus && r.documentStatus !== 'none' && (
                  <Button size="sm" variant="ghost" onClick={() => toggleDocs(r.id)}>
                    {docs[r.id] ? 'Hide document' : 'View document checks'}
                  </Button>
                )}
              </div>
              {docs[r.id] === 'loading' && <p className="text-xs text-ink-secondary">Loading…</p>}
              {Array.isArray(docs[r.id]) && (
                <div className="space-y-2">
                  {(docs[r.id] as RequestDocumentItem[]).map((d) => <DocumentChecks key={d.id} doc={d} requestId={r.id} />)}
                  <p className="text-xs text-ink-muted">Software can’t prove a stamp or signature is real. For high-risk requests, call the hospital’s blood bank to confirm before verifying.</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-ink-secondary">
          <span>{data.total} request(s)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="self-center">Page {page} of {data.totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
};
