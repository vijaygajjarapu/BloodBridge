import type { DonorService } from '../contracts';
import type { PaginatedResult } from '../../../types/api';
import type {
  DonorSummary,
  DonorDetails,
  DonorRegistrationInput,
  DonorRegistrationResult,
  DonorListParams,
} from '../../../types/donor';
import { apiClient } from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';

export class HttpDonorService implements DonorService {
  async listMyDonors(params: DonorListParams): Promise<PaginatedResult<DonorSummary>> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.bloodGroup && params.bloodGroup !== 'ALL') query.set('bloodGroup', params.bloodGroup);
    if (params.status && params.status !== 'ALL') query.set('status', params.status);
    if (params.country && params.country !== 'ALL') query.set('country', params.country);
    if (params.state) query.set('state', params.state);
    if (params.district) query.set('district', params.district);
    if (params.page) query.set('page', params.page.toString());
    if (params.pageSize) query.set('pageSize', params.pageSize.toString());
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);

    const qs = query.toString();
    const url = `${ENDPOINTS.MY_DONORS}${qs ? `?${qs}` : ''}`;
    return apiClient.get<PaginatedResult<DonorSummary>>(url);
  }

  async getDonorById(id: string): Promise<DonorDetails> {
    const res = await apiClient.get<any>(ENDPOINTS.DONOR_BY_ID(id));
    return {
      id: res.id,
      name: res.name || res.fullName || 'Anonymous Donor',
      bloodGroup: res.bloodGroup,
      location: res.location || {
        country: res.country,
        city: res.city || '',
        state: res.state || '',
        district: res.district || '',
        postalCode: res.postalCode,
      },
      status: res.status || (res.isAvailable ? 'active' : 'unavailable'),
      willingness: res.willingness || res.donationWillingness || 'regular',
      registeredAt: res.registeredAt || res.createdAt || new Date().toISOString(),
      referredByCode: res.referredByCode,
      lastDonatedAt: res.lastDonatedAt || res.lastDonationDate,
      isEligibleNow: res.isEligibleNow ?? res.isAvailable ?? true,
      email: res.email,
      canAccessContact: Boolean(res.canAccessContact),
      contactNumber: res.contactNumber || res.mobileNumber,
      contactUnavailableReason: res.contactUnavailableReason,
      contactSharingConsentGranted: Boolean(res.contactSharingConsentGranted),
      notes: res.notes,
      emergencyAvailability: res.emergencyAvailability ?? res.isAvailable ?? true,
      totalDonationsCount: res.totalDonationsCount ?? res.totalDonations ?? 0,
    };
  }

  async registerDonor(input: DonorRegistrationInput): Promise<DonorRegistrationResult> {
    const payload = {
      ...input,
      mobileNumber: input.phone || (input as any).mobileNumber,
      phone: input.phone || (input as any).mobileNumber,
      contactConsent: input.contactSharingConsent ?? (input as any).contactConsent ?? true,
      contactSharingConsent: input.contactSharingConsent ?? (input as any).contactConsent ?? true,
      donationWillingness: input.willingness || (input as any).donationWillingness || 'regular',
      willingness: input.willingness || (input as any).donationWillingness || 'regular',
    };
    return apiClient.post<DonorRegistrationResult>(ENDPOINTS.REGISTER_DONOR, payload);
  }

  async updateDonor(id: string, input: Partial<DonorDetails>): Promise<DonorDetails> {
    return apiClient.put<DonorDetails>(ENDPOINTS.DONOR_BY_ID(id), input);
  }

  async reportIncorrectInfo(donorId: string, reason: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post<{ success: boolean; message: string }>(ENDPOINTS.REPORT_DONOR(donorId), { reason });
  }
}

export const httpDonorService = new HttpDonorService();
