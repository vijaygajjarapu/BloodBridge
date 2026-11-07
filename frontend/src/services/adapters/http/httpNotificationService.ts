import type { NotificationService } from '../contracts';
import type { AppNotification } from '../../../types/notification';
import { apiClient } from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';

export class HttpNotificationService implements NotificationService {
  async getNotifications(): Promise<AppNotification[]> {
    return apiClient.get<AppNotification[]>(ENDPOINTS.NOTIFICATIONS);
  }

  async markAsRead(notificationId: string): Promise<void> {
    await apiClient.patch(ENDPOINTS.MARK_READ(notificationId));
  }

  async markAllAsRead(): Promise<void> {
    await apiClient.post(ENDPOINTS.MARK_ALL_READ);
  }
}

export const httpNotificationService = new HttpNotificationService();
