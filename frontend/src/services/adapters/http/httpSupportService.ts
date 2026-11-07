import type { SupportService } from '../contracts';
import { apiClient } from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';

export class HttpSupportService implements SupportService {
  async submitInquiry(inquiry: {
    name: string;
    email: string;
    subject: string;
    message: string;
    category: string;
  }): Promise<{ ticketId: string; message: string }> {
    return apiClient.post<{ ticketId: string; message: string }>(ENDPOINTS.SUPPORT_INQUIRY, inquiry);
  }

  async getFaqs(): Promise<{ question: string; answer: string; category: string }[]> {
    return apiClient.get<{ question: string; answer: string; category: string }[]>(ENDPOINTS.FAQS);
  }
}

export const httpSupportService = new HttpSupportService();
