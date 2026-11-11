import React from 'react';
import { createBrowserRouter } from 'react-router-dom';

// Layouts
import { PublicLayout } from '../layouts/PublicLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { UserLayout } from '../layouts/UserLayout';
import { AdminLayout } from '../layouts/AdminLayout';

// Route Guards
import { RequireAuth, RequireAdmin } from './guards';

// Public Pages
import { LandingPage } from '../pages/public/LandingPage';
import { AboutPage } from '../pages/public/AboutPage';
import { PrivacyPage } from '../pages/public/PrivacyPage';
import { TermsPage } from '../pages/public/TermsPage';

// Auth Pages
import { WelcomePage } from '../pages/auth/WelcomePage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { VerifyOtpPage } from '../pages/auth/VerifyOtpPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';
import { GoogleCallbackPage } from '../pages/auth/GoogleCallbackPage';

// Referral Pages
import { ReferralLandingPage } from '../pages/registration/ReferralLandingPage';
import { DonorRegistrationPage } from '../pages/registration/DonorRegistrationPage';
import { RegistrationReviewPage } from '../pages/registration/RegistrationReviewPage';
import { RegistrationSuccessPage } from '../pages/registration/RegistrationSuccessPage';

// Donor App Pages
import { DonorDashboardPage } from '../pages/app/DonorDashboardPage';
import { MyDonorsPage } from '../pages/app/MyDonorsPage';
import { DonorDetailsPage } from '../pages/app/DonorDetailsPage';
import { ReferralCenterPage } from '../pages/app/ReferralCenterPage';
import { ShareReferralPage } from '../pages/app/ShareReferralPage';
import { NotificationsPage } from '../pages/app/NotificationsPage';
import { ProfilePage } from '../pages/app/ProfilePage';
import { EditProfilePage } from '../pages/app/EditProfilePage';
import { SettingsPage } from '../pages/app/SettingsPage';
import { PrivacySettingsPage } from '../pages/app/PrivacySettingsPage';
import { HelpSupportPage } from '../pages/app/HelpSupportPage';
import { FamilyPage } from '../pages/app/FamilyPage';
import { CommunitiesPage } from '../pages/app/CommunitiesPage';
import { OrganisationsPage } from '../pages/app/OrganisationsPage';
import { OrgAdminPage } from '../pages/app/OrgAdminPage';
import { RequestFlyerPage } from '../pages/app/requests/RequestFlyerPage';
import { AdminOrganisationsPage } from '../pages/admin/AdminOrganisationsPage';
import { AdminPartnersPage } from '../pages/admin/AdminPartnersPage';
import { GroupJoinPage } from '../pages/app/GroupJoinPage';
import { SubscribePage } from '../pages/app/SubscribePage';
import { FamilyInvitePage } from '../pages/public/FamilyInvitePage';
import { PublicRequestPage } from '../pages/public/PublicRequestPage';
import { QuickRespondPage } from '../pages/public/QuickRespondPage';
import { SafetyPage } from '../pages/public/SafetyPage';
import { RequestsPage } from '../pages/app/requests/RequestsPage';
import { NewRequestPage } from '../pages/app/requests/NewRequestPage';
import { RequestDetailPage } from '../pages/app/requests/RequestDetailPage';
import { FindDonorsPage } from '../pages/app/requests/FindDonorsPage';

// Admin Pages
import { AdminLoginPage } from '../pages/admin/AdminLoginPage';
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';
import { AdminDonorsPage } from '../pages/admin/AdminDonorsPage';
import { AdminReferralsPage } from '../pages/admin/AdminReferralsPage';
import { AdminConsentsPage } from '../pages/admin/AdminConsentsPage';
import { AdminAuditLogsPage } from '../pages/admin/AdminAuditLogsPage';
import { AdminSettingsPage } from '../pages/admin/AdminSettingsPage';
import { AdminRequestsPage } from '../pages/admin/AdminRequestsPage';

// Error Pages
import { NotFoundPage } from '../pages/errors/NotFoundPage';
import { UnauthorizedPage } from '../pages/errors/UnauthorizedPage';

export const router = createBrowserRouter([
  // Public Routes (Marketing, Policy, Info)
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'family-invite/:code', element: <FamilyInvitePage /> },
      { path: 'r/:code', element: <PublicRequestPage /> },
      { path: 'q/:token', element: <QuickRespondPage /> },
      { path: 'safety', element: <SafetyPage /> },

      // Referral Flow Routes inside PublicLayout (Crucial precedence: success route before dynamic parameter)
      { path: 'join/success', element: <RegistrationSuccessPage /> },
      { path: 'join/:referralCode', element: <ReferralLandingPage /> },
      { path: 'join/:referralCode/register', element: <DonorRegistrationPage /> },
      { path: 'join/:referralCode/review', element: <RegistrationReviewPage /> },
    ],
  },

  // Auth Routes
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { index: true, element: <LoginPage /> },
      { path: 'welcome', element: <WelcomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'verify-otp', element: <VerifyOtpPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'google/callback', element: <GoogleCallbackPage /> },
    ],
  },

  // Donor App Protected Routes
  {
    path: '/app',
    element: (
      <RequireAuth>
        <UserLayout />
      </RequireAuth>
    ),
    children: [
      { path: 'dashboard', element: <DonorDashboardPage /> },
      { path: 'donors', element: <MyDonorsPage /> },
      { path: 'donors/:id', element: <DonorDetailsPage /> },
      { path: 'referrals', element: <ReferralCenterPage /> },
      { path: 'referrals/share', element: <ShareReferralPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'profile/edit', element: <EditProfilePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'settings/privacy', element: <PrivacySettingsPage /> },
      { path: 'help', element: <HelpSupportPage /> },
      { path: 'family', element: <FamilyPage /> },
      { path: 'communities', element: <CommunitiesPage /> },
      { path: 'communities/join/:code', element: <GroupJoinPage /> },
      { path: 'organisations', element: <OrganisationsPage /> },
      { path: 'organisations/:id/admin', element: <OrgAdminPage /> },
      { path: 'requests/:id/flyer', element: <RequestFlyerPage /> },
      { path: 'requests', element: <RequestsPage /> },
      { path: 'requests/new', element: <NewRequestPage /> },
      { path: 'requests/:id', element: <RequestDetailPage /> },
      { path: 'find-donors', element: <FindDonorsPage /> },
      { path: 'subscribe', element: <SubscribePage /> },
    ],
  },

  // Admin Login (Dedicated Unprotected Route)
  {
    path: '/admin/login',
    element: <AdminLoginPage />,
  },

  // Admin Protected Routes
  {
    path: '/admin',
    element: (
      <RequireAdmin>
        <AdminLayout />
      </RequireAdmin>
    ),
    children: [
      { path: 'dashboard', element: <AdminDashboardPage /> },
      { path: 'users', element: <AdminUsersPage /> },
      { path: 'donors', element: <AdminDonorsPage /> },
      { path: 'referrals', element: <AdminReferralsPage /> },
      { path: 'consents', element: <AdminConsentsPage /> },
      { path: 'requests', element: <AdminRequestsPage /> },
      { path: 'organisations', element: <AdminOrganisationsPage /> },
      { path: 'partners', element: <AdminPartnersPage /> },
      { path: 'audit-logs', element: <AdminAuditLogsPage /> },
      { path: 'settings', element: <AdminSettingsPage /> },
    ],
  },

  // Errors & Fallbacks
  {
    path: '/unauthorized',
    element: <UnauthorizedPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
