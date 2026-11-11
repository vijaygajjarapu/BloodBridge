import React, { useEffect, useState } from 'react';
import { Briefcase, Building2, CheckCircle2, XCircle, Plus } from 'lucide-react';
import { orgApi, remoteApi } from '../../services/orgApi';
import type { Organisation, PartnerBloodBank } from '../../types/organisation';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { errorMessage } from '../../utils/formErrors';

type OrgRow = Organisation & { plan: string; inviteCode: string; members: number; createdAt: string };
type Queue = Awaited<ReturnType<typeof remoteApi.adminQueue>>;

/** BloodNation staff: verify organisations, manage partner blood banks, confirm replacement donations */
export const AdminOrganisationsPage: React.FC = () => {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [banks, setBanks] = useState<PartnerBloodBank[]>([]);
  const [queue, setQueue] = useState<Queue>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bank, setBank] = useState({ name: '', licenceNo: '', address: '', city: '', district: '', state: '', phone: '' });

  const load = async () => {
    try {
      const [o, b, q] = await Promise.all([orgApi.adminAll(), remoteApi.adminBanks(), remoteApi.adminQueue()]);
      setOrgs(o);
      setBanks(b);
      setQueue(q);
    } catch (e) {
      setError(errorMessage(e, 'Could not load.'));
    }
  };
  useEffect(() => {
    load();
  }, []);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errorMessage(e, 'Something went wrong.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-ink-main">Organisations, partner blood banks and replacement donations</h1>
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-5 space-y-3">
          <h2 className="text-base font-bold flex items-center gap-2"><Briefcase className="w-4 h-4" /> Organisations ({orgs.length})</h2>
          <p className="text-xs text-ink-secondary">Verify an organisation after checking it is real (website, the registering person's work email, a call with HR). Employees can only join verified organisations.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-ink-secondary border-b"><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Domains</th><th className="py-2 pr-3">Place</th><th className="py-2 pr-3">Members</th><th className="py-2 pr-3">Plan</th><th className="py-2" /></tr></thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-semibold">{o.name} <span className="text-[11px] text-ink-muted">({o.inviteCode})</span></td>
                    <td className="py-2 pr-3 text-xs">{o.emailDomains.join(', ')}</td>
                    <td className="py-2 pr-3 text-xs">{o.city}, {o.state}</td>
                    <td className="py-2 pr-3">{o.members}</td>
                    <td className="py-2 pr-3">
                      <select value={o.plan} className="border rounded px-2 py-1 text-xs" onChange={(e) => run(`p-${o.id}`, () => orgApi.adminUpdate(o.id, { plan: e.target.value }))}>
                        <option value="pilot">Pilot</option><option value="paid">Paid</option>
                      </select>
                    </td>
                    <td className="py-2 text-right">
                      <Button size="sm" variant={o.verified ? 'outline' : 'primary'} isLoading={busy === `v-${o.id}`}
                        onClick={() => run(`v-${o.id}`, () => orgApi.adminUpdate(o.id, { verified: !o.verified }))}>
                        {o.verified ? 'Unverify' : 'Verify'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-3">
          <h2 className="text-base font-bold flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Replacement donations to confirm ({queue.length})</h2>
          <p className="text-xs text-ink-secondary">Call the blood bank and check the slip number before confirming. Confirmed credits are shown to the family to present at the hospital's blood bank.</p>
          {queue.length === 0 && <p className="text-xs text-ink-muted">Nothing waiting.</p>}
          {queue.map((x) => (
            <div key={x.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <span>{x.donor} ({x.donorPhone || 'no phone'}) · {x.bloodBank} {x.bloodBankPhone ? `(${x.bloodBankPhone})` : ''} · slip <strong>{x.donationRef}</strong> · {new Date(x.donatedAt).toLocaleString()}</span>
              <span className="flex gap-2">
                <Button size="sm" variant="primary" isLoading={busy === `ok-${x.id}`} onClick={() => run(`ok-${x.id}`, () => remoteApi.adminConfirm(x.id, true))}>Confirm</Button>
                <Button size="sm" variant="outline" leftIcon={<XCircle className="w-4 h-4" />} isLoading={busy === `no-${x.id}`} onClick={() => run(`no-${x.id}`, () => remoteApi.adminConfirm(x.id, false))}>Not found</Button>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-3">
          <h2 className="text-base font-bold flex items-center gap-2"><Building2 className="w-4 h-4" /> Partner blood banks ({banks.length})</h2>
          <p className="text-xs text-ink-secondary">Only licensed blood banks that have agreed to honour replacement donations. Inactive banks are hidden from donors.</p>
          <ul className="text-sm space-y-1">
            {banks.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 border-b last:border-0 py-1.5">
                <span>{b.name} · {b.city}, {b.district}, {b.state} {b.licenceNo ? `· licence ${b.licenceNo}` : ''} {b.active ? '' : '(inactive)'}</span>
                <Button size="sm" variant="ghost" isLoading={busy === `b-${b.id}`}
                  onClick={() => run(`b-${b.id}`, () => remoteApi.adminSaveBank({ ...b, address: b.address || undefined, phone: b.phone || undefined, licenceNo: b.licenceNo || undefined, active: !b.active } as never))}>
                  {b.active ? 'Deactivate' : 'Activate'}
                </Button>
              </li>
            ))}
          </ul>
          <div className="grid sm:grid-cols-3 gap-2">
            {(['name', 'licenceNo', 'address', 'city', 'district', 'state', 'phone'] as const).map((k) => (
              <Input key={k} id={`bank-${k}`} label={{ name: 'Name', licenceNo: 'Licence no.', address: 'Address', city: 'City', district: 'District', state: 'State', phone: 'Phone' }[k]}
                value={bank[k]} onChange={(e) => setBank({ ...bank, [k]: e.target.value })} />
            ))}
          </div>
          <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} isLoading={busy === 'addbank'} disabled={!bank.name || !bank.city || !bank.district || !bank.state}
            onClick={() => run('addbank', async () => {
              await remoteApi.adminSaveBank({ ...bank, licenceNo: bank.licenceNo || undefined, address: bank.address || undefined, phone: bank.phone || undefined });
              setBank({ name: '', licenceNo: '', address: '', city: '', district: '', state: '', phone: '' });
            })}>
            Add blood bank
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
