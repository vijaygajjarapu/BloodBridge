import React, { useState } from 'react';
import { UserMinus } from 'lucide-react';
import { orgApi } from '../../services/orgApi';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { errorMessage } from '../../utils/formErrors';

const RESULT_TEXT: Record<string, string> = {
  done: 'Done',
  not_found: 'Not found on the employee list or among members (check the work email or employee ID)',
  already_left: 'Already marked as left',
  bad_date: 'Date missing, wrong, or in the future (send it on or after the last working day)',
  yourself: 'That is you: use "Leave" instead',
};

/** Parses "work email or employee ID, YYYY-MM-DD" lines (CSV or pasted from a spreadsheet) */
function parseRows(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.split(/[,\t;]/).map((x) => x.trim()))
    .filter((p) => p[0] && !/^(work ?email|employee|email|id)\b/i.test(p[0]))
    .map((p) => ({ key: p[0], exitDate: p[1] || '' }));
}

/**
 * HR: tell BloodNation who left. Their company-paid Donor Circle stays free for 30 days after the last working day,
 * then they are reminded to renew. Their personal account, family and donors are never touched.
 */
export const HrExitsCard: React.FC<{ orgId: string; onDone?: () => void }> = ({ orgId, onDone }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ results: { key: string; result: string }[]; done: number; problems: number } | null>(null);

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    setText(await f.text());
  };

  const submit = async () => {
    const rows = parseRows(text);
    if (!rows.length) {
      setError('Add at least one line: work email or employee ID, then the last working day (YYYY-MM-DD).');
      return;
    }
    if (!window.confirm(`Mark ${rows.length} ${rows.length === 1 ? 'person' : 'people'} as left the organisation?`)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await orgApi.exits(orgId, rows);
      setResult(r);
      if (r.done) setText('');
      onDone?.();
    } catch (e) {
      setError(errorMessage(e, 'Could not record the exits.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-3" id="hr-exits">
        <h2 className="text-base font-bold text-ink-main flex items-center gap-2">
          <UserMinus className="w-4 h-4" /> Employees who left
        </h2>
        <p className="text-xs text-ink-secondary">
          One line per person: <strong>work email or employee ID, last working day</strong> (e.g. <code>ravi@acme.com, 2026-11-10</code>). Paste
          from a spreadsheet or choose a CSV file. Their company-paid Donor Circle stays free for 30 days, then they are reminded to renew.
          They are also taken off the employee list. Their personal account, family and donors are never touched, and colleague alerts stop.
        </p>
        <textarea
          className="w-full min-h-[110px] rounded-lg border border-line-border p-2 text-xs font-mono"
          placeholder={'ravi@acme.com, 2026-11-10\nEMP1042, 2026-11-12'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Employees who left"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input type="file" accept=".csv,.txt" className="text-xs" onChange={(e) => readFile(e.target.files?.[0])} aria-label="CSV file" />
          <Button size="sm" variant="primary" isLoading={busy} onClick={submit}>
            Record exits
          </Button>
        </div>
        {error && <p className="text-xs text-status-error" role="alert">{error}</p>}
        {result && (
          <div className="text-xs space-y-1" role="status">
            <p className="font-semibold text-ink-main">
              {result.done} recorded{result.problems ? `, ${result.problems} need attention` : ''}.
            </p>
            {result.results
              .filter((r) => r.result !== 'done')
              .map((r, i) => (
                <p key={i} className="text-ink-secondary">
                  {r.key}: {RESULT_TEXT[r.result] || r.result}
                </p>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
