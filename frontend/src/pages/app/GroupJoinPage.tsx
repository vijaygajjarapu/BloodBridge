import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Users, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { communityApi } from '../../services/communityApi';
import type { GroupInvitePreview } from '../../types/community';
import { COMMUNITY_TYPE_LABELS } from '../../types/community';
import { useT } from '../../i18n/I18nProvider';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { errorMessage } from '../../utils/formErrors';

/** Opened from a group's invite link (e.g. posted in a WhatsApp group): join in one tap */
export const GroupJoinPage: React.FC = () => {
  const t = useT();
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState<GroupInvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [helpMembers, setHelpMembers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    communityApi
      .byCode(code)
      .then((g) => {
        setGroup(g);
        setHelpMembers(g.peopleGroup);
        setJoined(g.isMember);
      })
      .catch((e) => setError(errorMessage(e, t('group.notFound'))));
  }, [code, t]);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      await communityApi.joinByCode(code, helpMembers);
      setJoined(true);
    } catch (e) {
      setError(errorMessage(e, t('group.failed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <h1 className="text-2xl font-extrabold text-ink-main tracking-tight flex items-center gap-2">
        <Users className="w-7 h-7 text-brand-600" /> {t('group.title')}
      </h1>
      {error && <ErrorBanner message={error} />}
      {group && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <p className="text-lg font-bold text-ink-main" id="group-name">{group.name}</p>
              <p className="text-xs text-ink-muted">
                {COMMUNITY_TYPE_LABELS[group.type]} · {group.city} · {t('group.members', { count: group.members.label })}
              </p>
            </div>
            <p className="text-sm text-ink-secondary">{t('group.explain')}</p>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-ink-secondary flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-status-success shrink-0" />
              <span>{t('group.privacy')}</span>
            </div>
            {joined ? (
              <div className="space-y-3" role="status">
                <p className="text-sm font-semibold text-status-success flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> {t('group.joined', { name: group.name })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => navigate('/app/communities')}>
                    {t('group.manage')}
                  </Button>
                  <Link to="/app/profile" className="text-sm font-semibold text-brand-600 self-center">
                    {t('group.checkProfile')}
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <label className="flex items-start gap-3 cursor-pointer min-h-[44px]" htmlFor="group-help">
                  <input id="group-help" type="checkbox" className="mt-0.5 w-4 h-4 accent-brand-600" checked={helpMembers} onChange={(e) => setHelpMembers(e.target.checked)} />
                  <span>
                    <span className="block text-sm text-ink-main">{t('group.helpMembers')}</span>
                    <span className="block text-[11px] text-ink-muted">{t('group.helpHint')}</span>
                  </span>
                </label>
                <Button variant="primary" isLoading={busy} onClick={join}>
                  {t('group.join')}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
