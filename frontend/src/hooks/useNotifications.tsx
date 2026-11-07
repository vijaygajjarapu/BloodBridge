import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AppNotification } from '../types/notification';
import { notificationService } from '../services';
import { useAuth } from './useAuth';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const data = await notificationService.getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to fetch notifications');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load when user logs in or switches
  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  // Periodic poll every 20 seconds for real-time notification changes
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      refreshNotifications();
    }, 20000);
    return () => clearInterval(timer);
  }, [user, refreshNotifications]);

  const markAsRead = async (id: string) => {
    // Optimistically mark as read so UI updates instantly
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    try {
      await notificationService.markAsRead(id);
    } catch (err) {
      console.error('Failed to mark notification as read on server', err);
    }
  };

  const markAllAsRead = async () => {
    // Optimistically mark all as read so navbar badge clears instantly
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await notificationService.markAllAsRead();
    } catch (err) {
      console.error('Failed to mark all notifications as read on server', err);
    }
  };

  // Real unread count based on actual notification state
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        error,
        refreshNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    // Graceful fallback if rendered outside provider
    return {
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
      refreshNotifications: async () => {},
      markAsRead: async () => {},
      markAllAsRead: async () => {},
    };
  }
  return context;
};
