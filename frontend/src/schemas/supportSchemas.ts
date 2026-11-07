import { z } from 'zod';

export const supportInquirySchema = z.object({
  name: z.string().min(2, 'Please provide your name.'),
  email: z.string().email('Please enter a valid email for communication.'),
  category: z.string().min(1, 'Please select an inquiry category.'),
  subject: z.string().min(3, 'Subject line must be at least 3 characters.'),
  message: z.string().min(10, 'Please describe your request in at least 10 characters.'),
});

export type SupportInquiryFormData = z.infer<typeof supportInquirySchema>;
