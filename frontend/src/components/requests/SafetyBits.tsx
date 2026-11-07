import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, FileUp, FileCheck2, FileWarning, FileX2, Loader2, Eye, Flag, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { requestApi } from '../../services/requestApi';
import type { DocumentCheck, ReportReason, RequestDocumentItem } from '../../types/request';
import { Button } from '../ui/Button';
import { errorMessage } from '../../utils/formErrors';

/** "Donating is always free" warning shown with every request */
export const NeverPayNotice: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <div className={`flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 ${compact ? 'p-2.5 text-xs' : 'p-3 text-sm'}`} role="note">
    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
    <span>
      <strong>Donating blood is always free.</strong> Never pay anyone or share bank / UPI details for a blood request. If someone asks for money,
      report the request. <Link to="/safety" className="underline font-semibold">Safety tips</Link>
    </span>
  </div>
);

const ICONS: Record<DocumentCheck['outcome'], React.ReactNode> = {
  pass: <CheckCircle2 className="w-3.5 h-3.5 text-status-success shrink-0" />,
  warn: <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
  fail: <XCircle className="w-3.5 h-3.5 text-status-error shrink-0" />,
  info: <Info className="w-3.5 h-3.5 text-ink-muted shrink-0" />,
};

export const DocumentResultBadge: React.FC<{ result: RequestDocumentItem['result'] | 'none' }> = ({ result }) => {
  const map = {
    none: { cls: 'bg-gray-100 text-gray-600', icon: <FileUp className="w-3 h-3" />, label: 'No document' },
    checking: { cls: 'bg-blue-50 text-blue-700', icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Checking document' },
    passed: { cls: 'bg-emerald-50 text-emerald-700', icon: <FileCheck2 className="w-3 h-3" />, label: 'Document checked' },
    warnings: { cls: 'bg-amber-50 text-amber-800', icon: <FileWarning className="w-3 h-3" />, label: 'Document needs review' },
    failed: { cls: 'bg-red-50 text-red-700', icon: <FileX2 className="w-3 h-3" />, label: 'Document failed checks' },
  }[result];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${map.cls}`}>
      {map.icon}
      {map.label}
    </span>
  );
};

export const DocumentChecks: React.FC<{ doc: RequestDocumentItem; requestId: string }> = ({ doc, requestId }) => {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="rounded-lg border border-line-border p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink-main truncate max-w-[60%]">{doc.fileName}</span>
        <div className="flex items-center gap-2">
          <DocumentResultBadge result={doc.result} />
          <button
            type="button"
            className="text-xs font-semibold text-brand-600 inline-flex items-center gap-1 min-h-[32px]"
            onClick={() => requestApi.openDocument(requestId, doc.id).catch((e) => setError(errorMessage(e)))}
          >
            <Eye className="w-3.5 h-3.5" /> View
          </button>
        </div>
      </div>
      {doc.result === 'checking' ? (
        <p className="text-xs text-ink-secondary">Reading the document… this can take up to a minute.</p>
      ) : (
        <ul className="space-y-1">
          {doc.checks.map((c) => (
            <li key={c.code} className="flex items-start gap-1.5 text-xs text-ink-secondary">
              {ICONS[c.outcome]} {c.label}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-status-error">{error}</p>}
    </div>
  );
};

/** Requester: upload the patient's document and see the automatic checks */
export const RequestDocumentsPanel: React.FC<{ requestId: string; urgency: string; onChange?: () => void }> = ({ requestId, urgency, onChange }) => {
  const [docs, setDocs] = useState<RequestDocumentItem[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    requestApi.documents(requestId).then(setDocs).catch(() => setDocs([]));
  }, [requestId]);
  useEffect(load, [load]);

  // Poll while a document is being checked
  useEffect(() => {
    if (!docs?.some((d) => d.result === 'checking')) return;
    const t = window.setTimeout(() => {
      load();
      onChange?.();
    }, 4000);
    return () => window.clearTimeout(t);
  }, [docs, load, onChange]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
      setError('Please choose a photo (JPG or PNG) or a PDF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('The file is larger than 5 MB. Please choose a smaller photo.');
      return;
    }
    setUploading(true);
    try {
      setDocs(await requestApi.uploadDocument(requestId, file));
      onChange?.();
    } catch (e) {
      setError(errorMessage(e, 'Could not upload the document. Please try again.'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3" id="request-documents">
      <p className="text-xs text-ink-secondary">
        Upload the hospital’s blood requisition form or the doctor’s note (photo or PDF, up to 5 MB). We check it automatically
        against this request{urgency === 'critical' ? ', and critical requests with a checked document are verified faster' : ''}. Only you and our
        team can see it.
      </p>
      {docs?.map((d) => <DocumentChecks key={d.id} doc={d} requestId={requestId} />)}
      {(docs?.length || 0) < 3 && (
        <div>
          <input
            ref={inputRef}
            id="request-document-input"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="sr-only"
            onChange={(e) => upload(e.target.files?.[0])}
          />
          <Button size="sm" variant="outline" leftIcon={<FileUp className="w-4 h-4" />} isLoading={uploading} onClick={() => inputRef.current?.click()}>
            {docs?.length ? 'Add another document' : 'Upload patient document'}
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-status-error" role="alert">{error}</p>}
    </div>
  );
};

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'money_demanded', label: 'They asked for money' },
  { value: 'fake_request', label: 'This request looks fake' },
  { value: 'wrong_number', label: 'Wrong or unreachable number' },
  { value: 'other', label: 'Something else' },
];

/** Donor: report a suspicious request */
export const ReportRequestButton: React.FC<{ requestId: string }> = ({ requestId }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (done) return <p className="text-xs text-emerald-700 font-semibold" role="status">{done}</p>;

  const submit = async () => {
    if (!reason) {
      setError('Choose what went wrong.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await requestApi.report(requestId, reason, details.trim() || undefined);
      setDone(res.message);
    } catch (e) {
      setError(errorMessage(e, 'Could not send the report. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return open ? (
    <div className="rounded-lg border border-line-border p-3 space-y-2" id="report-request">
      <p className="text-sm font-semibold text-ink-main">What went wrong?</p>
      {REASONS.map((r) => (
        <label key={r.value} className="flex items-center gap-2 text-sm text-ink-main">
          <input type="radio" name="report-reason" value={r.value} checked={reason === r.value} onChange={() => { setReason(r.value); setError(null); }} />
          {r.label}
        </label>
      ))}
      <textarea
        rows={2}
        maxLength={500}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Anything else our team should know (optional)"
        className="w-full text-sm p-2 rounded-lg border border-line-border"
      />
      {error && <p className="text-xs text-status-error" role="alert">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="danger" isLoading={busy} onClick={submit}>Send report</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  ) : (
    <button type="button" id="open-report" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-status-error min-h-[36px]">
      <Flag className="w-3.5 h-3.5" /> Report this request
    </button>
  );
};
