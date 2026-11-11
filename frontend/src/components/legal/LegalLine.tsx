import React from 'react';
import { appConfig } from '../../constants/config';
import { useI18n } from '../../i18n/I18nProvider';

/**
 * The standard ownership line shown at the bottom of every screen.
 * Registered office, CIN, phone, email and grievance contact appear only when set in frontend/.env
 * (Rule 26, Companies (Incorporation) Rules 2014 asks for them on the home page once the company is registered).
 */
export const LegalLine: React.FC<{ detailed?: boolean; className?: string }> = ({ detailed = false, className = '' }) => {
  const { t } = useI18n();
  const c = appConfig.company;
  const details = [
    c.registeredOffice && `${t('legal.office')}: ${c.registeredOffice}`,
    c.cin && `CIN: ${c.cin}`,
    c.phone && `${t('legal.phone')}: ${c.phone}`,
    c.email && `${t('legal.email')}: ${c.email}`,
    c.grievanceOfficer && `${t('legal.grievance')}: ${c.grievanceOfficer}`,
  ].filter(Boolean) as string[];

  return (
    <div className={`text-xs text-ink-secondary ${className}`}>
      <p>{t('legal.ownedBy', { brand: appConfig.name, company: c.legalName })}</p>
      {detailed && details.length > 0 && <p className="mt-1">{details.join(' · ')}</p>}
      <p className="mt-1">© {new Date().getFullYear()} {c.legalName}. {t('legal.rights')}</p>
    </div>
  );
};
