/**
 * Family Safety Circle and subscription calls. These need the live backend (VITE_APP_MODE=api).
 */
import { apiClient } from './api/client';
import type {
  FamilyMember,
  FamilyMemberInput,
  FamilyInviteInfo,
  FamilyInvitePublic,
  FamilyCircle,
  MyPledge,
  MySubscription,
  SubscriptionPlan,
  PaymentOrder,
  PledgePermissions,
} from '../types/family';

export const familyApi = {
  listMembers: () => apiClient.get<FamilyMember[]>('/family/members'),
  addMember: (input: FamilyMemberInput) => apiClient.post<FamilyMember[]>('/family/members', input),
  updateMember: (id: string, input: Partial<FamilyMemberInput>) => apiClient.put<FamilyMember[]>(`/family/members/${id}`, input),
  removeMember: (id: string) => apiClient.delete<FamilyMember[]>(`/family/members/${id}`),
  getInvite: () => apiClient.post<FamilyInviteInfo>('/family/invite'),
  getInvitePublic: (code: string) => apiClient.get<FamilyInvitePublic>(`/family/invites/${encodeURIComponent(code)}`),
  pledge: (code: string, bloodGroups: string[], shareContact: boolean) =>
    apiClient.post<{ success: boolean; pledgedGroups: string[] }>(`/family/invites/${encodeURIComponent(code)}/pledge`, {
      bloodGroups,
      shareContact,
    }),
  myPledges: () => apiClient.get<MyPledge[]>('/family/my-pledges'),
  withdraw: (ownerUserId: string) => apiClient.delete<MyPledge[]>(`/family/my-pledges/${ownerUserId}`),
  circle: () => apiClient.get<FamilyCircle>('/family/circle'),
  updatePermissions: (ownerUserId: string, permissions: Partial<PledgePermissions>) =>
    apiClient.patch<{ success: boolean }>(`/family/my-pledges/${ownerUserId}/permissions`, permissions),
  endRelationship: (donorUserId: string, block: boolean) =>
    apiClient.post<{ success: boolean; blocked: boolean }>(`/family/circle/donors/${donorUserId}/end`, { block }),
};

export const subscriptionApi = {
  plan: () => apiClient.get<SubscriptionPlan>('/subscriptions/plan'),
  mine: () => apiClient.get<MySubscription>('/subscriptions/me'),
  createOrder: () => apiClient.post<PaymentOrder>('/subscriptions/order'),
  verify: (orderId: string, paymentId: string, signature: string) =>
    apiClient.post<MySubscription>('/subscriptions/verify', { orderId, paymentId, signature }),
  verifySubscription: (subscriptionId: string, paymentId: string, signature: string) =>
    apiClient.post<MySubscription>('/subscriptions/verify', { subscriptionId, paymentId, signature }),
  setAutoRenew: (enabled: boolean) => apiClient.post<MySubscription>('/subscriptions/auto-renew', { enabled }),
  devSimulate: () => apiClient.post<MySubscription>('/subscriptions/dev-simulate'),
  devExpire: () => apiClient.post<{ renewed: number; mine: MySubscription }>('/subscriptions/dev-expire'),
};
