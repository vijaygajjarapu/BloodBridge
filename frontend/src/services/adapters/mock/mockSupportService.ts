import type { SupportService } from '../contracts';
import { mockStore, delay } from './mockStore';

export class MockSupportService implements SupportService {
  async submitInquiry(inquiry: {
    name: string;
    email: string;
    subject: string;
    message: string;
    category: string;
  }): Promise<{ ticketId: string; message: string }> {
    await delay(300);
    const ticketId = `TCK-${Math.floor(100000 + Math.random() * 900000)}`;

    mockStore.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      actorId: mockStore.currentUser?.id || 'guest',
      actorName: inquiry.name,
      actorRole: 'User',
      action: 'SUPPORT_TICKET_SUBMITTED',
      entityType: 'system',
      entityId: ticketId,
      details: `Subject: ${inquiry.subject} (${inquiry.category})`,
      timestamp: new Date().toISOString(),
      ipAddress: '127.0.0.1 (demo)',
    });

    return {
      ticketId,
      message: `Your inquiry has been received. Ticket ${ticketId} has been created. A support specialist will respond within 24 hours.`,
    };
  }

  async getFaqs(): Promise<{ question: string; answer: string; category: string }[]> {
    await delay(150);
    return [...mockStore.faqs];
  }
}

export const mockSupportService = new MockSupportService();
