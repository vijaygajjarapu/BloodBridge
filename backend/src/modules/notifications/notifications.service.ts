import { prisma } from '../../config/database.js';
import { emitToUser } from '../../sockets/socket.server.js';

export class NotificationService {
  async getNotifications(userId: string) {
    let notifications = await prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (notifications.length === 0) {
      const welcome = await prisma.notification.create({
        data: {
          recipientId: userId,
          notificationType: 'system',
          title: 'Welcome to BloodBridge Network!',
          message: 'Your voluntary savior profile is active. You can view matching donation requests and share your referral invitation to expand the emergency circle.',
          isRead: false,
        },
      });
      notifications = [welcome];
    }

    return notifications.map((n) => ({
      id: n.id,
      userId: n.recipientId,
      type: n.notificationType,
      title: n.title || 'System Notification',
      message: n.message,
      isRead: n.isRead,
      read: n.isRead,
      createdAt: n.createdAt.toISOString(),
      timestamp: n.createdAt.toISOString(),
      actionUrl:
        n.relatedEntity && n.relatedEntity.startsWith('/app/')
          ? n.relatedEntity
          : n.notificationType === 'family_pledge'
          ? '/app/family'
          : n.notificationType === 'referral_success'
          ? '/app/referrals'
          : n.notificationType === 'emergency_request'
          ? '/app/donors'
          : '/app/dashboard',
      emergencyUrgency: n.notificationType === 'emergency_request' ? 'critical' : undefined,
    }));
  }

  async markAsRead(notificationId: string, userId: string) {
    await prisma.notification.updateMany({
      where: { id: notificationId, recipientId: userId },
      data: { isRead: true },
    });
    emitToUser(userId, 'notification:read', { notificationId });
  }

  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true },
    });
    emitToUser(userId, 'notification:read', { all: true });
  }

  async createNotification(userId: string, type: string, title: string, message: string, relatedEntity?: string) {
    const notification = await prisma.notification.create({
      data: {
        recipientId: userId,
        notificationType: type,
        title,
        message,
        relatedEntity,
      },
    });

    emitToUser(userId, 'notification:new', {
      id: notification.id,
      userId: notification.recipientId,
      type: notification.notificationType,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead,
      read: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
      timestamp: notification.createdAt.toISOString(),
    });

    return notification;
  }
}

export const notificationService = new NotificationService();
