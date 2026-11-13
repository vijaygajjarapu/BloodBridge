import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Users, CheckCircle2, Clock, Lock } from 'lucide-react';
import { subscriptionApi } from '../../services/familyApi';
import { orgApi } from '../../services/orgApi';
import type { MySubscription } from '../../types/family';
import type { MyOrganisation } from '../../types/organisation';
import { appConfig } from '../../constants/config';
import { formatDate } from '../../constants/countries';
import { Card, CardContent } from '../ui/Card';

/** Who pays for the Donor Circle right now, in one line */
export function coverageLine(mine: MySubscription | null): { tone: 'ok' | 'warn' | 'off'; text: string } {
  if (!mine) return { tone: 'off', text: 'Loading…' };
  const c = mine.company;
  if (c?.kind === 'company') return { tone: 'ok', text: `Free: paid by ${c.orgName} while you work there.` };
  if (mine.endsAt && mine.active) return { tone: 'ok', text: `Active until ${formatDate(mine.endsAt)} (your own plan).` };
  if (c?.kind === 'grace') return { tone: 'warn', text: `${c.orgName} paid until you left. Free until ${formatDate(c.until)}, then renew to keep it.` };
  return { tone: 'off', text: 'Not active. Finding donors and posting requests stay free.' };
}

/**
 * Two sections:
 * - Corporate: only you, through your company (colleagues are alerted on your requests). No family here.
 * - Personal: your family and your Donor Circle. Free while a paying company covers you.
 */
export const PlanSections: React.FC = () => {
  const [mine, setMine] = useState<MySubscription | null>(null);
  const [orgs, setOrgs] = useState<MyOrganisation[]>([]);

  useEffect(() => {
    if (appConfig.isDemo) return;
    subscriptionApi.mine().then(setMine).catch(() => undefined);
    orgApi.mine().then((rows) => setOrgs(rows.filter((o) => o.membership.status === 'active'))).catch(() => undefined);
  }, []);

  if (appConfig.isDemo) return null;
  const line = coverageLine(mine);
  const Icon = line.tone === 'ok' ? CheckCircle2 : line.tone === 'warn' ? Clock : Lock;
  const color = line.tone === 'ok' ? 'text-emerald-700' : line.tone === 'warn' ? 'text-amber-700' : 'text-ink-secondary';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="plan-sections">
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-bold text-ink-main flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-500" /> Corporate
          </p>
          {orgs.length ? (
            <ul className="text-xs text-ink-secondary space-y-1">
              {orgs.map((o) => (
                <li key={o.id}>
                  <span className="font-semibold text-ink-main">{o.name}</span>
                  {mine?.company?.kind === 'company' && mine.company.orgId === o.id ? ' · pays for your Donor Circle' : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-secondary">Not linked to a company.</p>
          )}
          <p className="text-xs text-ink-secondary">
            Just you. Your requests also alert your colleagues, wherever they are. Family members are added under Personal.
          </p>
          <Link to="/app/organisations" className="text-xs font-semibold text-brand-600">
            {orgs.length ? 'Manage' : 'Join with your work email'} →
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-bold text-ink-main flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-500" /> Personal
          </p>
          <p className="text-xs text-ink-secondary">Your family and your Donor Circle. They stay yours if you change jobs.</p>
          <p className={`text-xs font-semibold flex items-start gap-1.5 ${color}`}>
            <Icon className="w-4 h-4 flex-shrink-0" /> {line.text}
          </p>
          {mine?.company?.kind !== 'company' && !(mine?.endsAt && mine?.active) && (
            <Link to="/app/subscribe" className="text-xs font-semibold text-brand-600">
              {mine?.company?.kind === 'grace' ? 'Renew now' : 'Subscribe'} →
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
