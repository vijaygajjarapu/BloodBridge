import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Users,
  ShieldCheck,
  Clock,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import type { AppNotification } from '../../types/notification';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { formatDate } from '../../constants/countries';
import { getNotificationAction } from '../../utils/notificationActions';

export const NotificationsPage: React.FC = () => {
  const {
    notifications,
    unreadCount,
    isLoading: loading,
    error: errorMsg,
    refreshNotifications: loadNotifications,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
  } = useNotifications();

  const [filterType, setFilterType] = useState<string>('ALL');

  const filteredNotifications = notifications.filter((n) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'UNREAD') return !n.isRead;
    // 'emergency' also covers 'emergency_request'; 'referral' covers 'referral_success'
    return n.type === filterType || String(n.type).startsWith(`${filterType}_`);
  });

  const getIconForType = (type: string) => {
    switch (type) {
      case 'emergency':
      case 'emergency_request':
        return <AlertTriangle className="w-5 h-5 text-status-error" />;
      case 'referral':
      case 'referral_success':
      case 'family_pledge':
        return <Users className="w-5 h-5 text-brand-500" />;
      case 'system':
        return <ShieldCheck className="w-5 h-5 text-status-success" />;
      default:
        return <Bell className="w-5 h-5 text-ink-secondary" />;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-main tracking-tight">
            Notifications &amp; Alerts
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
            Emergency requests, savior referral join notices, and consent updates ({unreadCount} unread)
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMarkAllAsRead}
            leftIcon={<CheckCheck className="w-4 h-4" />}
          >
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line-border pb-3">
        {[
          { label: 'All', value: 'ALL' },
          { label: 'Unread Only', value: 'UNREAD' },
          { label: 'Emergency Alerts', value: 'emergency' },
          { label: 'Referrals', value: 'referral' },
          { label: 'System', value: 'system' },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilterType(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[44px] ${
              filterType === tab.value
                ? 'bg-brand-500 text-white'
                : 'text-ink-secondary hover:text-ink-main hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {errorMsg && <ErrorBanner message={errorMsg} onRetry={loadNotifications} />}

      {/* Notification List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-5 w-1/3 mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </Card>
          ))}
        </div>
      ) : filteredNotifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-8 h-8" />}
          title="No Notifications Found"
          description={
            filterType !== 'ALL'
              ? 'No notifications match this filter. Try viewing all alerts.'
              : 'You are all caught up! Emergency dispatch alerts will appear here.'
          }
          actionText={filterType !== 'ALL' ? 'Show All' : undefined}
          onAction={() => setFilterType('ALL')}
        />
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((n) => (
            <Card
              key={n.id}
              className={`p-4 sm:p-5 transition-all ${
                !n.isRead
                  ? 'border-brand-200 bg-brand-50/20 shadow-sm'
                  : 'bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start space-x-3.5">
                <div
                  className={`p-2.5 rounded-xl flex-shrink-0 ${
                    n.type === 'emergency' || n.type === 'emergency_request'
                      ? 'bg-red-100'
                      : n.type === 'referral' || n.type === 'referral_success' || n.type === 'family_pledge'
                      ? 'bg-brand-50'
                      : 'bg-gray-100'
                  }`}
                >
                  {getIconForType(n.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      className={`text-sm ${
                        !n.isRead ? 'font-bold text-ink-main' : 'font-medium text-ink-main'
                      }`}
                    >
                      {n.title}
                    </h3>
                    <span className="text-[10px] text-ink-muted whitespace-nowrap flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDate(n.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
                    {n.message}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line-border/60">
                    <div>
                      {n.actionUrl && (
                        <Link
                          to={getNotificationAction(n).to}
                          className="text-xs font-bold text-brand-600 hover:text-brand-700 inline-flex items-center min-h-[36px]"
                        >
                          <span>{getNotificationAction(n).label}</span>
                          <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Link>
                      )}
                    </div>

                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(n.id)}
                        className="text-xs font-semibold text-ink-secondary hover:text-ink-main px-2 py-1 rounded hover:bg-gray-100 min-h-[36px]"
                      >
                        Mark as Read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
