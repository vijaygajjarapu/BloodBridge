import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase } from 'lucide-react';
import { orgApi } from '../../services/orgApi';
import { useT } from '../../i18n/I18nProvider';

/** Small link on the profile: join your company. Hidden once the person is in an organisation. */
export const OrgJoinHint: React.FC = () => {
  const t = useT();
  const [show, setShow] = useState(false);
  useEffect(() => {
    orgApi.mine().then((rows) => setShow(rows.length === 0)).catch(() => setShow(false));
  }, []);
  if (!show) return null;
  return (
    <Link to="/app/organisations" className="flex items-center gap-2 rounded-xl border border-dashed border-line-border p-3 text-sm text-ink-secondary hover:bg-gray-50">
      <Briefcase className="w-4 h-4 text-brand-600" /> {t('org.joinCta')}
    </Link>
  );
};
