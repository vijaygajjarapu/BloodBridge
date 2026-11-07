export type NotificationType =
  | 'emergency'
  | 'emergency_request'
  | 'request_update'
  | 'referral'
  | 'referral_success'
  | 'family_pledge'
  | 'system'
  | 'reminder'
  | (string & {});

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  emergencyUrgency?: 'critical' | 'high' | 'normal';
}
