import { appConfig } from '../constants/config';
import type {
  AuthService,
  DonorService,
  ReferralService,
  NotificationService,
  ProfileService,
  ConsentService,
  AdminService,
  SupportService,
} from './adapters/contracts';

// Mock adapters
import { mockAuthService } from './adapters/mock/mockAuthService';
import { mockDonorService } from './adapters/mock/mockDonorService';
import { mockReferralService } from './adapters/mock/mockReferralService';
import { mockNotificationService } from './adapters/mock/mockNotificationService';
import { mockProfileService } from './adapters/mock/mockProfileService';
import { mockConsentService } from './adapters/mock/mockConsentService';
import { mockAdminService } from './adapters/mock/mockAdminService';
import { mockSupportService } from './adapters/mock/mockSupportService';

// HTTP adapters
import { httpAuthService } from './adapters/http/httpAuthService';
import { httpDonorService } from './adapters/http/httpDonorService';
import { httpReferralService } from './adapters/http/httpReferralService';
import { httpNotificationService } from './adapters/http/httpNotificationService';
import { httpProfileService } from './adapters/http/httpProfileService';
import { httpConsentService } from './adapters/http/httpConsentService';
import { httpAdminService } from './adapters/http/httpAdminService';
import { httpSupportService } from './adapters/http/httpSupportService';

const isDemo = appConfig.isDemo;

export const authService: AuthService = isDemo ? mockAuthService : httpAuthService;
export const donorService: DonorService = isDemo ? mockDonorService : httpDonorService;
export const referralService: ReferralService = isDemo ? mockReferralService : httpReferralService;
export const notificationService: NotificationService = isDemo ? mockNotificationService : httpNotificationService;
export const profileService: ProfileService = isDemo ? mockProfileService : httpProfileService;
export const consentService: ConsentService = isDemo ? mockConsentService : httpConsentService;
export const adminService: AdminService = isDemo ? mockAdminService : httpAdminService;
export const supportService: SupportService = isDemo ? mockSupportService : httpSupportService;

export * from './adapters/contracts';
