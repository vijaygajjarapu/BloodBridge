import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Users, HeartPulse, Megaphone, ShieldCheck, Activity, UserMinus, UserCog, Copy } from 'lucide-react';
import { orgApi } from '../../services/orgApi';
import type { OrgDashboard, OrgMemberRow } from '../../types/organisation';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { errorMessage } from '../../utils/formErrors';

const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-xl border border-line-border p-4">
    <p className="text-2xl font-extrabold text-ink-main">{value}</p>
    <p className="text-xs font-semibold text-ink-secondary">{label}</p>
    {hint && <p className="text-[11px] text-ink-muted mt-0.5">{hint}</p>}
  </div>
);

/**
 * Organisation admin (HR / CSR): counts only, member list (names and work emails), announcements and camps.
 * Never shows a named employee's blood group, eligibility or reasons to wait.
 */
export const OrgAdminPage: React.FC = () => {
  const { id = '' } = useParams();
  const [d, setD] = useState<OrgDashboard | null>(null);
  const [members, setMembers] = useState<OrgMemberRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [a, setA] = useState({ kind: 'camp' as 'camp' | 'announcement', title: '', body: '', campDate: '', place: '' });
  const [filter, setFilter] = useState('');

  const load = async () => {
    try {
      const [dash, list] = await Promise.all([orgApi.dashboard(id), orgApi.members(id)]);
      setD(dash);
      setMembers(list);
    } catch (e) {
      setError(errorMessage(e, 'Could not load the dashboard.'));
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (ok) setNotice(ok);
      await load();
    } catch (e) {
      setError(errorMessage(e, 'Something went wrong. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  if (error && !d) return <div className="max-w-4xl mx-auto"><ErrorBanner message={error} /></div>;
  if (!d) return <div className="max-w-4xl mx-auto text-sm text-ink-muted">Loading…</div>;

  const inviteLink = `${window.location.origin}/app/organisations?code=${d.org.inviteCode}`;
  const shown = members.filter((m) => !filter || `${m.name} ${m.workEmail} ${m.employeeId || ''}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <Link to="/app/organisations" className="text-xs text-ink-secondary inline-flex items-center"><ArrowLeft className="w-4 h-4 mr-1" /> My organisation</Link>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-main">{d.org.name}</h1>
          <p className="text-xs text-ink-secondary">
            {d.org.city}, {d.org.state} · work emails: {d.org.emailDomains.map((x) => '@' + x).join(', ')} · {d.org.verified ? 'Verified' : 'Waiting for BloodNation to verify'} · {d.org.plan === 'paid' ? 'Paid plan' : 'Pilot'}
          </p>
        </div>
        <div className="rounded-xl border border-line-border p-3 text-xs">
          <p className="font-semibold text-ink-main">Invite code: <span className="font-mono text-brand-700">{d.org.inviteCode}</span></p>
          <button type="button" className="mt-1 inline-flex items-center gap-1 text-brand-600 font-semibold" onClick={() => { navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
            <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied' : 'Copy invite link for staff'}
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-ink-secondary flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-status-success shrink-0" />
        You see counts only. BloodNation never shows which employee has which blood group, who can donate, or anyone's health reasons. Numbers below 3 show as "fewer than 3".
      </div>
      {error && <ErrorBanner message={error} />}
      {notice && <p className="text-sm text-status-success font-semibold" role="status">{notice}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Members" value={d.people.members} hint={d.people.waitingForEmailCheck ? `${d.people.waitingForEmailCheck} waiting to check their work email` : undefined} />
        <Stat label="Registered donors" value={d.people.donors} />
        <Stat label="Could donate now" value={d.readyToDonateNow.label} hint="Available, eligible and reachable by colleagues" />
        <Stat label="Requests (90 days)" value={`${d.last90Days.fulfilled}/${d.last90Days.requests}`} hint="fulfilled / posted by members who allow it" />
        <Stat label="Times colleagues said yes (90 days)" value={d.last90Days.colleagueHelps} />
        <Stat label="Replacement donations (90 days)" value={d.last90Days.remoteDonations} hint="Donate here, save a life there" />
      </div>

      <Card>
        <CardContent className="p-5 space-y-2">
          <h2 className="text-base font-bold text-ink-main flex items-center gap-2"><HeartPulse className="w-4 h-4 text-brand-600" /> Donors by blood group</h2>
          <div className="flex flex-wrap gap-2">
            {Object.keys(d.bloodGroups).length === 0 && <p className="text-xs text-ink-muted">No donors yet. Run a donation camp to get started.</p>}
            {Object.entries(d.bloodGroups).sort().map(([g, c]) => (
              <span key={g} className="rounded-lg border border-line-border px-3 py-1.5 text-sm"><strong>{g}</strong> · {c.label}</span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-3">
          <h2 className="text-base font-bold text-ink-main flex items-center gap-2"><Megaphone className="w-4 h-4" /> Send an announcement or a donation camp</h2>
          <p className="text-xs text-ink-secondary">Goes to members who allow company alerts. Up to 5 a day. For emergencies, employees post a request themselves: it reaches colleagues and nearby donors immediately, without waiting for approval.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Select id="a-kind" label="Type" value={a.kind} onChange={(e) => setA({ ...a, kind: e.target.value as 'camp' | 'announcement' })}
              options={[{ value: 'camp', label: 'Donation camp' }, { value: 'announcement', label: 'Announcement' }]} />
            <Input id="a-title" label="Title" value={a.title} maxLength={100} onChange={(e) => setA({ ...a, title: e.target.value })} />
            {a.kind === 'camp' && (
              <>
                <Input id="a-date" type="date" label="Camp date" value={a.campDate} onChange={(e) => setA({ ...a, campDate: e.target.value })} />
                <Input id="a-place" label="Place" value={a.place} maxLength={120} onChange={(e) => setA({ ...a, place: e.target.value })} />
              </>
            )}
          </div>
          <div>
            <label htmlFor="a-body" className="block text-sm font-medium text-ink-main mb-1">Message</label>
            <textarea id="a-body" rows={3} maxLength={600} value={a.body} onChange={(e) => setA({ ...a, body: e.target.value })}
              className="w-full rounded-lg border border-line-border px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          </div>
          <Button variant="primary" isLoading={busy === 'announce'} disabled={!a.title.trim() || !a.body.trim()}
            onClick={() => run('announce', async () => {
              const res = await orgApi.announce(id, { kind: a.kind, title: a.title, body: a.body, campDate: a.campDate || undefined, place: a.place || undefined });
              setA({ ...a, title: '', body: '', campDate: '', place: '' });
              setNotice(`Sent to ${res.sentTo} people.`);
            })}>
            Send
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <h2 className="text-base font-bold text-ink-main flex items-center gap-2"><Users className="w-4 h-4" /> Members ({members.length})</h2>
            <Input id="m-filter" label="Search name or work email" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-secondary border-b border-line-border">
                  <th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Work email</th><th className="py-2 pr-3">Employee ID</th><th className="py-2 pr-3">Status</th><th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => (
                  <tr key={m.id} className="border-b border-line-border last:border-0">
                    <td className="py-2 pr-3">{m.name}{m.role === 'admin' && <span className="ml-1 text-[10px] font-bold text-brand-700">ADMIN</span>}</td>
                    <td className="py-2 pr-3 text-ink-secondary">{m.workEmail}</td>
                    <td className="py-2 pr-3 text-ink-secondary">{m.employeeId || '—'}</td>
                    <td className="py-2 pr-3 text-xs">{m.status === 'active' ? 'Active' : 'Checking email'}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {m.status === 'active' && (
                        <Button size="sm" variant="ghost" leftIcon={<UserCog className="w-4 h-4" />} isLoading={busy === `role-${m.id}`}
                          onClick={() => run(`role-${m.id}`, () => orgApi.updateMember(id, m.id, { role: m.role === 'admin' ? 'member' : 'admin' }))}>
                          {m.role === 'admin' ? 'Remove admin' : 'Make admin'}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" leftIcon={<UserMinus className="w-4 h-4" />} isLoading={busy === `rm-${m.id}`}
                        onClick={() => { if (window.confirm(`Remove ${m.name} (left the organisation)? Their personal BloodNation account stays.`)) run(`rm-${m.id}`, () => orgApi.updateMember(id, m.id, { remove: true })); }}>
                        Left
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] text-ink-muted flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Impact numbers count only members who allow it. Download a report for CSR / HR from this page (coming next).</p>
    </div>
  );
};
