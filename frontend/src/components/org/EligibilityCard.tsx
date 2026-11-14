import React, { useEffect, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { orgApi } from '../../services/orgApi';
import type { EligibilityList, EligibilityUploadResult } from '../../types/organisation';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { errorMessage } from '../../utils/formErrors';

const REASON_TEXT: Record<string, string> = {
  missing_id: 'Employee ID missing or too long',
  bad_date: 'Date of birth missing or not a real date (use YYYY-MM-DD or DD-MM-YYYY)',
  bad_email: 'Work email is not valid',
  duplicate: 'Same employee ID or work email twice in this file',
};

/** "employee ID, date of birth, work email (optional)" lines, from a CSV or pasted from a spreadsheet */
function parseRows(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.split(/[,\t;]/).map((x) => x.trim()))
    .filter((p) => p.some(Boolean) && !/^(employee|emp|id)\b/i.test(p[0] || ''))
    .map((p) => ({ employeeId: p[0] || '', dateOfBirth: p[1] || '', workEmail: p[2] || undefined }));
}

/**
 * HR: the employee list. Only people on it can link the company (employee ID + date of birth, or a code to the
 * work email on their row). A full list marks anyone missing from it as left the company.
 */
export const EligibilityCard: React.FC<{ orgId: string; onDone?: () => void }> = ({ orgId, onDone }) => {
  const [list, setList] = useState<EligibilityList | null>(null);
  const [text, setText] = useState('');
  const [fullList, setFullList] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EligibilityUploadResult | null>(null);
  const [show, setShow] = useState(false);

  const load = () => orgApi.eligibility(orgId).then(setList).catch(() => undefined);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const submit = async () => {
    const rows = parseRows(text);
    if (!rows.length) {
      setError('Add at least one line: employee ID, date of birth, and optionally the work email.');
      return;
    }
    if (fullList && !window.confirm(`This is the full list of ${rows.length} employees? Anyone on the current list who is not in it will be marked as left the company.`)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await orgApi.uploadEligibility(orgId, rows, fullList);
      setResult(r);
      if (r.applied && !r.problems.length) setText('');
      await load();
      onDone?.();
    } catch (e) {
      setError(errorMessage(e, 'Could not upload the list.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-3" id="employee-list">
        <h2 className="text-base font-bold text-ink-main flex items-center gap-2">
          <ListChecks className="w-4 h-4" /> Employee list
        </h2>
        <p className="text-xs text-ink-secondary">
          Only people on this list can link your company to their BloodNation account. One line per person:{' '}
          <strong>employee ID, date of birth, work email (optional)</strong>, e.g. <code>EMP1042, 1990-05-28, ravi@acme.com</code>. Employees
          link with their employee ID and date of birth, or with a code sent to the work email on their line. They keep signing in with their
          own mobile number. Dates of birth are only used for this check and are never shown back.
        </p>
        {list && (
          <p className="text-sm text-ink-main" role="status">
            <strong>{list.onList}</strong> on the list · <strong>{list.linked}</strong> linked · {list.removed} removed
          </p>
        )}
        <textarea
          className="w-full min-h-[110px] rounded-lg border border-line-border p-2 text-xs font-mono"
          placeholder={'EMP1042, 1990-05-28, ravi@acme.com\nEMP1043, 14-02-1988'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Employee list"
        />
        <label className="flex items-start gap-2 text-sm text-ink-main cursor-pointer min-h-[44px]">
          <input type="checkbox" className="mt-0.5 w-4 h-4 accent-brand-600" checked={fullList} onChange={(e) => setFullList(e.target.checked)} />
          <span>
            This is the full list of employees. <span className="text-ink-secondary text-xs">Anyone not in it is marked as left: their company-paid Donor Circle stays free for 30 days, then they are asked to renew.</span>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input type="file" accept=".csv,.txt" className="text-xs" aria-label="CSV file" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
          <Button size="sm" variant="primary" isLoading={busy} onClick={submit}>
            {fullList ? 'Replace the list' : 'Add to the list'}
          </Button>
        </div>
        {error && <p className="text-xs text-status-error" role="alert">{error}</p>}
        {result && (
          <div className="text-xs space-y-1" role="status">
            {result.applied ? (
              <p className="font-semibold text-ink-main">
                {result.added} added, {result.updated} updated, {result.unchanged} unchanged
                {result.removed ? `, ${result.removed} removed (${result.exits} of them had linked and are marked as left)` : ''}.
              </p>
            ) : (
              <p className="font-semibold text-status-error">Nothing was changed: fix these lines first, so nobody is wrongly marked as left.</p>
            )}
            {result.problems.map((p, i) => (
              <p key={i} className="text-ink-secondary">
                Line {p.line}{p.employeeId ? ` (${p.employeeId})` : ''}: {REASON_TEXT[p.reason] || p.reason}
              </p>
            ))}
          </div>
        )}
        {list && list.rows.length > 0 && (
          <div>
            <button type="button" className="text-xs font-semibold text-brand-600" onClick={() => setShow((v) => !v)} aria-expanded={show}>
              {show ? 'Hide the list' : `Show the list (${list.rows.length})`}
            </button>
            {show && (
              <div className="overflow-x-auto max-h-72 overflow-y-auto mt-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-ink-secondary border-b border-line-border">
                      <th className="py-1.5 pr-3">Employee ID</th><th className="py-1.5 pr-3">Work email</th><th className="py-1.5 pr-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.rows.map((r) => (
                      <tr key={r.employeeId} className="border-b border-line-border last:border-0">
                        <td className="py-1.5 pr-3 font-mono">{r.employeeId}</td>
                        <td className="py-1.5 pr-3 text-ink-secondary">{r.workEmail || '—'}</td>
                        <td className="py-1.5 pr-3">{r.status === 'removed' ? 'Removed (left)' : r.linked ? 'Linked' : 'Not linked yet'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
