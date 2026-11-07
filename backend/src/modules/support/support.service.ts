import { prisma } from '../../config/database.js';
import { generateRandomToken } from '../../shared/password.js';

export class SupportService {
  async submitInquiry(inquiry: {
    name: string;
    email: string;
    subject: string;
    message: string;
    category: string;
    userId?: string;
  }) {
    const ticketId = 'TKT-' + generateRandomToken(4).toUpperCase();

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: inquiry.userId || null,
        name: inquiry.name,
        email: inquiry.email,
        subject: inquiry.subject,
        message: inquiry.message,
        category: inquiry.category || 'general',
        status: 'open',
      },
    });

    return {
      ticketId,
      dbId: ticket.id,
      message: 'Your inquiry has been received. Our clinical support team will follow up within 24 hours.',
    };
  }

  async getFaqs() {
    return [
      {
        question: 'Who is eligible to donate blood through BloodBridge?',
        answer: 'Healthy adults aged 18–65 weighing at least 50 kg (110 lbs) with no active infections or recent tattoos within 6 months are generally eligible.',
        category: 'Eligibility',
      },
      {
        question: 'How does the referral network operate?',
        answer: 'Registered saviors receive a unique referral link. When friends or community members register using your link, they are credited to your personal donor network.',
        category: 'Referrals',
      },
      {
        question: 'How is my private telephone number protected?',
        answer: 'BloodBridge strictly enforces zero-knowledge contact masking. Your raw phone number is never exposed publicly without your explicit, voluntary opt-in consent.',
        category: 'Privacy',
      },
      {
        question: 'How often can I donate whole blood?',
        answer: 'Male donors can donate every 12 weeks, and female donors can donate every 16 weeks to ensure adequate hemoglobin and iron stores.',
        category: 'Medical',
      },
    ];
  }
}

export const supportService = new SupportService();
