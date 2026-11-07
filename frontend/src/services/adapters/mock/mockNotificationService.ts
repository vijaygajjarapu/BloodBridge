import type { NotificationService } from '../contracts';
import type { AppNotification } from '../../../types/notification';
import { mockStore, delay } from './mockStore';

export class MockNotificationService implements NotificationService {
  async getNotifications(): Promise<AppNotification[]> {
    await delay(150);
    return [...mockStore.notifications];
  }

  async markAsRead(notificationId: string): Promise<void> {
    await delay(100);
    const notif = mockStore.notifications.find((n) => n.id === notificationId);
    if (notif) {
      notif.isRead = true;
    }
  }

  async markAllAsRead(): Promise<void> {
    await delay(150);
    mockStore.notifications.forEach((n) => {
      n.isRead = true;
    });
  }
}

export const mockNotificationService = new MockNotificationService();
