import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type {
  User,
  AuthSession,
  LoginCredentials,
  RegisterInput,
  SignInCredentials,
  SignInResponse,
  SignUpInput,
  SignUpResponse,
  SignupReferralInput,
  PhoneLoginOtpResponse,
} from '../types/auth';
import { authService } from '../services';
import { appConfig } from '../constants/config';
import { apiClient } from '../services/api/client';
import { useIdleSession, IDLE_LOGOUT_FLAG } from './useIdleSession';

interface AuthContextType {
  user: User | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  isDemo: boolean;
  signin: (credentials: SignInCredentials) => Promise<SignInResponse>;
  signup: (input: SignUpInput) => Promise<SignUpResponse>;
  signupWithReferral: (input: SignupReferralInput) => Promise<AuthSession>;
  verifyLoginOtp: (input: { email: string; code: string }) => Promise<AuthSession>;
  resendLoginOtp: (input: { email: string }) => Promise<{ success: boolean; message: string }>;
  requestPhoneLoginOtp: (input: { phone: string }) => Promise<PhoneLoginOtpResponse>;
  verifyPhoneLoginOtp: (input: { phone: string; code: string }) => Promise<AuthSession>;
  verifyEmail: (input: { email: string; code: string }) => Promise<AuthSession>;
  resendVerification: (input: { email: string }) => Promise<{ success: boolean; message: string }>;
  login: (credentials: LoginCredentials) => Promise<AuthSession>;
  loginAsDemoUser: () => Promise<AuthSession>;
  loginAsDemoAdmin: () => Promise<AuthSession>;
  register: (input: RegisterInput) => Promise<AuthSession>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const current = await authService.getCurrentSession();
      setSession(current);
    } catch {
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const signin = async (credentials: SignInCredentials): Promise<SignInResponse> => {
    setIsLoading(true);
    try {
      const result = await authService.signin(credentials);
      // Verified members are signed in straight away (no login code)
      if (result.token && result.user) {
        setSession({
          user: result.user,
          token: result.token,
          expiresAt: result.expiresAt || '',
          idleTimeoutSeconds: result.idleTimeoutSeconds,
        });
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (input: SignUpInput): Promise<SignUpResponse> => {
    setIsLoading(true);
    try {
      return await authService.signup(input);
    } finally {
      setIsLoading(false);
    }
  };

  const signupWithReferral = async (input: SignupReferralInput): Promise<AuthSession> => {
    setIsLoading(true);
    try {
      const authResult = await authService.signupWithReferral(input);
      setSession(authResult);
      return authResult;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyLoginOtp = async (input: { email: string; code: string }): Promise<AuthSession> => {
    setIsLoading(true);
    try {
      const sessionResult = await authService.verifyLoginOtp(input);
      setSession(sessionResult);
      return sessionResult;
    } finally {
      setIsLoading(false);
    }
  };

  const resendLoginOtp = async (input: { email: string }): Promise<{ success: boolean; message: string }> => {
    return authService.resendLoginOtp(input);
  };

  const requestPhoneLoginOtp = async (input: { phone: string }): Promise<PhoneLoginOtpResponse> => {
    return authService.requestPhoneLoginOtp(input);
  };

  const verifyPhoneLoginOtp = async (input: { phone: string; code: string }): Promise<AuthSession> => {
    setIsLoading(true);
    try {
      const sessionResult = await authService.verifyPhoneLoginOtp(input);
      setSession(sessionResult);
      return sessionResult;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyEmail = async (input: { email: string; code: string }): Promise<AuthSession> => {
    setIsLoading(true);
    try {
      const sessionResult = await authService.verifyEmail(input);
      setSession(sessionResult);
      return sessionResult;
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerification = async (input: { email: string }): Promise<{ success: boolean; message: string }> => {
    return authService.resendVerification(input);
  };

  const login = async (credentials: LoginCredentials): Promise<AuthSession> => {
    setIsLoading(true);
    try {
      const authResult = await authService.login(credentials);
      setSession(authResult);
      return authResult;
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsDemoUser = async (): Promise<AuthSession> => {
    return login({ identifier: 'marcus.vance@example.org', password: 'Password123!' });
  };

  const loginAsDemoAdmin = async (): Promise<AuthSession> => {
    return login({ identifier: 'admin@bloodbridge.org', password: 'AdminPassword2026!' });
  };

  const register = async (input: RegisterInput): Promise<AuthSession> => {
    setIsLoading(true);
    try {
      const authResult = await authService.register(input);
      setSession(authResult);
      return authResult;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authService.logout();
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  const user = session?.user || null;
  const isAuthenticated = Boolean(user);
  const isAdmin = user?.role === 'admin';

  // Sign out after 5 minutes (server setting) with no clicks or typing; activity keeps the session going
  const idleMs = (session?.idleTimeoutSeconds || appConfig.sessionIdleMinutes * 60) * 1000;
  useIdleSession({
    enabled: isAuthenticated,
    idleMs,
    refresh: async () => {
      // Another tab may already have refreshed the token
      const stored = localStorage.getItem('bloodbridge_auth_token');
      if (stored && stored !== apiClient.getToken()) apiClient.setToken(stored);
      await authService.refreshSessionToken();
    },
    onIdle: () => {
      localStorage.removeItem('bloodbridge_auth_token');
      apiClient.setToken(null);
      setSession(null);
      try {
        sessionStorage.setItem(IDLE_LOGOUT_FLAG, '1');
      } catch {
        /* storage unavailable */
      }
      const returnTo = window.location.pathname + window.location.search;
      window.location.assign(`/auth/login?reason=idle&from=${encodeURIComponent(returnTo)}`);
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated,
        isAdmin,
        isLoading,
        isDemo: appConfig.isDemo,
        signin,
        signup,
        signupWithReferral,
        verifyLoginOtp,
        resendLoginOtp,
        requestPhoneLoginOtp,
        verifyPhoneLoginOtp,
        verifyEmail,
        resendVerification,
        login,
        loginAsDemoUser,
        loginAsDemoAdmin,
        register,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
