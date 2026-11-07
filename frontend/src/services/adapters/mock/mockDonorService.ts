import type { DonorService } from '../contracts';
import type { PaginatedResult } from '../../../types/api';
import type {
  DonorSummary,
  DonorDetails,
  DonorRegistrationInput,
  DonorRegistrationResult,
  DonorListParams,
} from '../../../types/donor';
import { mockStore, delay } from './mockStore';

export class MockDonorService implements DonorService {
  async listMyDonors(params: DonorListParams): Promise<PaginatedResult<DonorSummary>> {
    await delay(250);

    let filtered = [...mockStore.donors];

    // Search filter (name, city, district)
    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      filtered = filtered.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.location.city.toLowerCase().includes(q) ||
          d.location.district.toLowerCase().includes(q) ||
          d.bloodGroup.toLowerCase().includes(q)
      );
    }

    // Blood group filter
    if (params.bloodGroup && params.bloodGroup !== 'ALL') {
      filtered = filtered.filter((d) => d.bloodGroup === params.bloodGroup);
    }

    // Status filter
    if (params.status && params.status !== 'ALL') {
      filtered = filtered.filter((d) => d.status === params.status);
    }

    // Location state filter
    if (params.state) {
      filtered = filtered.filter((d) => d.location.state === params.state);
    }

    // Location district filter
    if (params.district) {
      filtered = filtered.filter((d) => d.location.district === params.district);
    }

    // Sorting
    if (params.sortBy) {
      const order = params.sortOrder === 'desc' ? -1 : 1;
      filtered.sort((a, b) => {
        if (params.sortBy === 'name') {
          return a.name.localeCompare(b.name) * order;
        }
        if (params.sortBy === 'registeredAt') {
          return (new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime()) * order;
        }
        if (params.sortBy === 'bloodGroup') {
          return a.bloodGroup.localeCompare(b.bloodGroup) * order;
        }
        return 0;
      });
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const paginatedItems = filtered.slice(startIndex, startIndex + pageSize);

    // Map to DonorSummary
    const summaries: DonorSummary[] = paginatedItems.map((d) => ({
      id: d.id,
      name: d.name,
      bloodGroup: d.bloodGroup,
      location: d.location,
      status: d.status,
      willingness: d.willingness,
      registeredAt: d.registeredAt,
      referredByCode: d.referredByCode,
      lastDonatedAt: d.lastDonatedAt,
      isEligibleNow: d.isEligibleNow,
    }));

    return {
      data: summaries,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async getDonorById(id: string): Promise<DonorDetails> {
    await delay(200);
    const donor = mockStore.donors.find((d) => d.id === id);
    if (!donor) {
      throw {
        code: 'DONOR_NOT_FOUND',
        message: `No donor record found with identifier ${id}.`,
      };
    }

    // Strict privacy boundary simulation:
    // If donor didn't grant contact sharing, don't expose phone number in response
    return {
      ...donor,
      contactNumber: donor.canAccessContact ? donor.contactNumber : undefined,
      contactUnavailableReason: donor.canAccessContact
        ? undefined
        : donor.contactUnavailableReason || 'Contact sharing restricted by donor privacy settings.',
    };
  }

  async registerDonor(input: DonorRegistrationInput): Promise<DonorRegistrationResult> {
    await delay(350);
    return mockStore.registerNewDonor(input);
  }

  async updateDonor(id: string, input: Partial<DonorDetails>): Promise<DonorDetails> {
    await delay(250);
    const index = mockStore.donors.findIndex((d) => d.id === id);
    if (index === -1) {
      throw {
        code: 'DONOR_NOT_FOUND',
        message: `Donor ${id} not found.`,
      };
    }

    mockStore.donors[index] = {
      ...mockStore.donors[index],
      ...input,
    };

    return mockStore.donors[index];
  }

  async reportIncorrectInfo(donorId: string, reason: string): Promise<{ success: boolean; message: string }> {
    await delay(250);
    mockStore.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      actorId: mockStore.currentUser?.id || 'demo_user',
      actorName: mockStore.currentUser?.name || 'Marcus Vance',
      actorRole: 'Donor',
      action: 'DONOR_INFO_REPORTED',
      entityType: 'donor',
      entityId: donorId,
      details: `Reported inaccuracy: ${reason}`,
      timestamp: new Date().toISOString(),
      ipAddress: '127.0.0.1 (demo)',
    });

    return {
      success: true,
      message: 'Thank you for helping keep BloodBridge accurate. Our verification team will review this report.',
    };
  }
}

export const mockDonorService = new MockDonorService();
