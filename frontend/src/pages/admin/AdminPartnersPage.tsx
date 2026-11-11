import React, { useEffect, useState } from 'react';
import { Handshake, Plus, FileBarChart } from 'lucide-react';
import { partnerApi, PARTNER_TYPE_LABELS, type PartnerProgram, type PartnerReport, type PartnerType } from '../../services/partnerApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { errorMessage, getFieldErrors } from '../../utils/formErrors';

const EMPTY = { name: '', partnerType: 'term_insurer' as PartnerType, code: '', seats: '1000', monthsFree: '12', endsAt: '', contactName: '', contactEmail: '' };

/**
 * Manvi Blood staff: partner programmes. An insurer, bank, college or large group sponsors Donor Circle
 * for its customers or members; they redeem the code at /app/subscribe?partner=CODE. The partner gets a counts-only report.
 */
export const AdminPartnersPage: React.FC = () => {
  const [rows, setRows] = useState<PartnerProgram[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [report, setReport] = useState<PartnerReport | null>(null);

  const load = () => partnerApi.adminList().then(setRows).catch((e) => setError(errorMessage(e, 'Could not load partner programmes.')));
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

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 2) errs.name = 'Enter the partner name.';
    if (!(Number(form.seats) >= 1)) errs.seats = 'Enter how many people can use the code.';
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy('create');
    setError(null);
    try {
      await partnerApi.adminCreate({
        name: form.name.trim(),
        partnerType: form.partnerType,
        code: form.code.trim() || undefined,
        seats: Number(form.seats),
        monthsFree: Number(form.monthsFree) || 12,
        endsAt: form.endsAt || null,
        contactName: form.contactName.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
      });
      setForm(EMPTY);
      await load();
    } catch (err) {
      setFieldErrors(getFieldErrors(err) as Record<string, string>);
      setError(errorMessage(err, 'Could not create the programme.'));
    } finally {
      setBusy(null);
    }
  };

  const link = (code: string) => `${window.location.origin}/app/subscribe?partner=${code}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-ink-main flex items-center gap-2">
        <Handshake className="w-6 h-6 text-brand-600" /> Partner programmes
      </h1>
      <p className="text-sm text-ink-secondary max-w-3xl">
        Insurers, term-insurance providers, banks, colleges and large groups sponsor Donor Circle for their customers or members. Give
        the partner the code and link; each person redeems once. Partners see counts only, and small counts (below 3) are hidden.
      </p>
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-5 space-y-3">
          <h2 className="text-base font-bold">Programmes ({rows.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" id="partner-table">
              <thead>
                <tr className="text-left text-xs text-ink-secondary border-b">
                  <th className="py-2 pr-3">Partner</th><th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Used</th>
                  <th className="py-2 pr-3">Free months</th><th className="py-2 pr-3">Status</th><th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-3">
                      <span className="font-semibold">{p.name}</span>
                      <span className="block text-[11px] text-ink-muted">{PARTNER_TYPE_LABELS[p.partnerType]}{p.contactName ? ` · ${p.contactName}` : ''}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className="font-mono text-xs">{p.code}</span>
                      <span className="block text-[11px] text-ink-muted break-all">{link(p.code)}</span>
                    </td>
                    <td className="py-2 pr-3">{p.redeemed} / {p.seats}</td>
                    <td className="py-2 pr-3">{p.monthsFree}</td>
                    <td className="py-2 pr-3 text-xs">
                      {p.status}{p.endsAt ? ` · ends ${new Date(p.endsAt).toLocaleDateString()}` : ''}{p.endingSoon ? ' (soon)' : ''}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap space-x-1">
                      <Button size="sm" variant="ghost" leftIcon={<FileBarChart className="w-4 h-4" />} isLoading={busy === `r-${p.id}`}
                        onClick={() => run(`r-${p.id}`, async () => setReport(await partnerApi.report(p.id)))}>
                        Report
                      </Button>
                      <Button size="sm" variant="outline" isLoading={busy === `a-${p.id}`}
                        onClick={() => run(`a-${p.id}`, () => partnerApi.adminUpdate(p.id, { active: !p.active }))}>
                        {p.active ? 'Pause' : 'Resume'}
                      </Button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="py-3 text-xs text-ink-muted">No partner programmes yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardContent className="p-5 space-y-2" id="partner-report">
            <h2 className="text-base font-bold">Report for {report.name} ({report.code})</h2>
            <p className="text-xs text-ink-muted">Generated {new Date(report.generatedAt).toLocaleString()}. Safe to send to the partner: counts only.</p>
            <ul className="text-sm grid sm:grid-cols-2 gap-x-6 gap-y-1">
              <li>Codes used: <strong>{report.redeemed}</strong> of {report.seats}</li>
              <li>Families who set up their circle: <strong>{report.familiesSetUp.label}</strong></li>
              <li>Donors who pledged to these families: <strong>{report.donorsPledged.label}</strong></li>
              <li>Emergencies posted: <strong>{report.emergenciesPosted.label}</strong></li>
              <li>Emergencies fulfilled: <strong>{report.emergenciesFulfilled.label}</strong></li>
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5">
          <form noValidate onSubmit={create} className="space-y-3">
            <h2 className="text-base font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> New programme</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input id="pp-name" label="Partner name (shown to people)" required value={form.name} error={fieldErrors.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Select id="pp-type" label="Kind of partner" value={form.partnerType}
                onChange={(e) => setForm({ ...form, partnerType: e.target.value as PartnerType })}
                options={Object.entries(PARTNER_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
              <Input id="pp-code" label="Code (optional, made for you if empty)" value={form.code} error={fieldErrors.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              <Input id="pp-seats" label="Seats (people who can redeem)" type="number" min={1} required value={form.seats} error={fieldErrors.seats}
                onChange={(e) => setForm({ ...form, seats: e.target.value })} />
              <Input id="pp-months" label="Free months per person" type="number" min={1} max={36} value={form.monthsFree}
                onChange={(e) => setForm({ ...form, monthsFree: e.target.value })} />
              <Input id="pp-ends" label="Last day to redeem (optional)" type="date" value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
              <Input id="pp-contact" label="Partner contact name" value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
              <Input id="pp-email" label="Partner contact email" type="email" value={form.contactEmail} error={fieldErrors.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
            </div>
            <Button type="submit" variant="primary" isLoading={busy === 'create'} leftIcon={<Plus className="w-4 h-4" />}>
              Create programme
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
