import { z } from 'zod';

export const shareInvitationSchema = z.object({
  channel: z.enum(['native', 'whatsapp', 'email', 'copy']),
  recipientContact: z.string().optional(),
});

export type ShareInvitationInput = z.infer<typeof shareInvitationSchema>;
