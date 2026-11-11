import type { AppNotification } from '../types/notification';

export type NotificationTone = 'urgent' | 'good' | 'info';

export interface NotificationAction {
  /** Small label above the title, e.g. "Good news" */
  kicker: string;
  tone: NotificationTone;
  /** Button text that says what the person will see */
  label: string;
  to: string;
}

const GOOD_UPDATE = /accepted|thank you|verified|fulfilled|renewed|joined/i;

/**
 * One place that decides how a notification is presented (colour, heading, button text, link),
 * so the dashboard banner and the Notifications page always agree.
 */
export function getNotificationAction(n: AppNotification): NotificationAction {
  const url = n.actionUrl;
  switch (n.type) {
    case 'emergency':
    case 'emergency_request':
      return { kicker: 'Blood needed near you', tone: 'urgent', label: 'View request & respond', to: url || '/app/requests' };
    case 'referral':
    case 'referral_success':
      return { kicker: 'Good news', tone: 'good', label: 'View your donors', to: '/app/donors' };
    case 'family_pledge':
      return { kicker: 'Good news', tone: 'good', label: 'See your Donor Circle', to: '/app/family' };
    case 'request_update': {
      const good = GOOD_UPDATE.test(`${n.title} ${n.message}`);
      return { kicker: good ? 'Good news' : 'Request update', tone: good ? 'good' : 'info', label: 'Open the request', to: url || '/app/requests' };
    }
    case 'system':
      if (url === '/app/subscribe') {
        const good = GOOD_UPDATE.test(n.title);
        return { kicker: good ? 'Good news' : 'Subscription', tone: good ? 'good' : 'info', label: 'View subscription', to: url };
      }
      return { kicker: 'Update', tone: 'info', label: 'View details', to: url || '/app/dashboard' };
    default:
      return { kicker: 'Update', tone: 'info', label: 'View details', to: url || '/app/dashboard' };
  }
}
