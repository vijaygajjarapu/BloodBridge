import React from 'react';
import { Link } from 'react-router-dom';
import { Hospital, MapPin, Clock, Droplet, PauseCircle, ShieldCheck } from 'lucide-react';
import type { BloodRequest, RequestStatus, Urgency, VerificationStatus } from '../../types/request';
import { STATUS_LABELS, VERIFICATION_LABELS, COMPONENT_LABELS } from '../../types/request';
import { BloodGroupBadge } from '../ui/Badge';
import { formatDate } from '../../constants/countries';

const STATUS_STYLES: Record<RequestStatus, string> = {
  submitted: 'bg-gray-100 text-gray-700',
  open: 'bg-blue-50 text-blue-700',
  donors_notified: 'bg-blue-50 text-blue-700',
  donor_found: 'bg-emerald-50 text-emerald-700',
  in_progress: 'bg-amber-50 text-amber-800',
  partially_fulfilled: 'bg-amber-50 text-amber-800',
  fulfilled: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-600',
  expired: 'bg-gray-100 text-gray-600',
  closed: 'bg-gray-100 text-gray-600',
};

export const RequestStatusBadge: React.FC<{ status: RequestStatus }> = ({ status }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_STYLES[status]}`}>
    {STATUS_LABELS[status]}
  </span>
);

export const UrgencyBadge: React.FC<{ urgency: Urgency }> = ({ urgency }) => {
  const style =
    urgency === 'critical' ? 'bg-red-600 text-white' : urgency === 'urgent' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-700';
  const label = urgency === 'critical' ? 'Critical' : urgency === 'urgent' ? 'Urgent' : 'Planned';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${style}`}>{label}</span>;
};

export const VerificationBadge: React.FC<{ status: VerificationStatus }> = ({ status }) => {
  const style =
    status === 'verified'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'rejected'
        ? 'bg-red-50 text-red-700'
        : status === 'pending_review'
          ? 'bg-amber-50 text-amber-800'
          : 'bg-gray-50 text-gray-600';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${style}`}>
      <ShieldCheck className="w-3 h-3" />
      {VERIFICATION_LABELS[status]}
    </span>
  );
};

export const RequestSummaryCard: React.FC<{ request: BloodRequest; to: string; footer?: React.ReactNode }> = ({ request: r, to, footer }) => (
  <Link
    to={to}
    className="block rounded-xl border border-line-border bg-white p-4 hover:border-brand-300 hover:shadow-sm transition"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <BloodGroupBadge group={r.bloodGroup} />
        <div>
          <div className="text-sm font-bold text-ink-main">
            {r.unitsNeeded} unit{r.unitsNeeded > 1 ? 's' : ''} · {COMPONENT_LABELS[r.component]}
          </div>
          <div className="text-xs text-ink-secondary flex items-center gap-1">
            <Hospital className="w-3.5 h-3.5" /> {r.hospitalName}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <UrgencyBadge urgency={r.urgency} />
        <RequestStatusBadge status={r.status} />
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary">
      <span className="flex items-center gap-1">
        <MapPin className="w-3.5 h-3.5" /> {r.city}, {r.district}
      </span>
      {r.neededBy && (
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" /> Needed by {formatDate(r.neededBy)}
        </span>
      )}
      <span className="flex items-center gap-1">
        <Droplet className="w-3.5 h-3.5" /> {r.unitsFulfilled}/{r.unitsNeeded} received
      </span>
      {r.onHold && (
        <span className="flex items-center gap-1 text-amber-700 font-semibold">
          <PauseCircle className="w-3.5 h-3.5" /> Paused for review
        </span>
      )}
    </div>
    {footer && <div className="mt-3">{footer}</div>}
  </Link>
);
