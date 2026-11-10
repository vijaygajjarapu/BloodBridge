import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Droplet, Printer } from 'lucide-react';
import { requestApi } from '../../../services/requestApi';
import type { BloodRequest } from '../../../types/request';
import { Button } from '../../../components/ui/Button';
import { ErrorBanner } from '../../../components/ui/ErrorBanner';
import { useT } from '../../../i18n/I18nProvider';
import type { TranslationKey } from '../../../i18n/locales/en';
import { errorMessage } from '../../../utils/formErrors';

/**
 * Printable flyer: "Donate here, save a life in <city>". No patient name or phone number on it, only the
 * public request link. Share it in other cities (office notice boards, WhatsApp groups) or print it.
 */
export const RequestFlyerPage: React.FC = () => {
  const { id = '' } = useParams();
  const t = useT();
  const [r, setR] = useState<BloodRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    requestApi.get(id).then(setR).catch((e) => setError(errorMessage(e, 'Could not load the request.')));
  }, [id]);

  if (error) return <div className="max-w-2xl mx-auto"><ErrorBanner message={error} /></div>;
  if (!r) return <div className="max-w-2xl mx-auto text-sm text-ink-muted">…</div>;

  const link = `${window.location.origin}/r/${r.publicCode}`;
  const hospital = [r.hospitalName, r.city].filter(Boolean).join(', ');

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link to={`/app/requests/${r.id}`} className="text-xs text-ink-secondary inline-flex items-center"><ArrowLeft className="w-4 h-4 mr-1" /> {t('req.back')}</Link>
        <Button variant="primary" size="sm" leftIcon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>{t('flyer.print')}</Button>
      </div>

      {/* The flyer itself (A5-ish card, prints on one page) */}
      <article id="flyer" className="bg-white rounded-2xl border-4 border-brand-600 p-8 sm:p-10 space-y-6 text-center shadow-lg print:shadow-none">
        <div className="flex items-center justify-center gap-2 text-brand-700 font-extrabold text-lg">
          <Droplet className="w-6 h-6 fill-current" /> BloodBridge
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-ink-main leading-tight">{t('flyer.title', { city: r.city })}</h1>
        <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-brand-600 text-white text-4xl font-black mx-auto">{r.bloodGroup}</div>
        <p className="text-lg text-ink-main">{t('flyer.body', { group: r.bloodGroup, hospital: r.hospitalName, city: r.city })}</p>
        <p className="text-sm font-semibold text-brand-700">{t(`urgency.${r.urgency}` as TranslationKey)} · {hospital}</p>
        <div className="rounded-xl bg-gray-50 border border-line-border p-4 space-y-1">
          <p className="text-sm text-ink-secondary">{t('flyer.steps')}</p>
          <p className="text-lg font-mono font-bold text-ink-main break-all">{link}</p>
        </div>
        <p className="text-xs text-ink-muted">{t('flyer.free')}</p>
      </article>
    </div>
  );
};
