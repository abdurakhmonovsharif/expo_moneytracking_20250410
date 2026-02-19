import axios, { AxiosError } from 'axios';
import * as Crypto from 'expo-crypto';
import { signInWithCustomToken, UserCredential } from 'firebase/auth';
import { Platform } from 'react-native';

import { auth } from 'lib/firebase';
import { API_BASE_URL } from 'constants/featureFlags';

type BackendResponse = {
  firebase_custom_token?: string;
};

type AppleAuthCredential = {
  identityToken?: string | null;
  email?: string | null;
  fullName?: {
    givenName?: string | null;
    familyName?: string | null;
    middleName?: string | null;
    namePrefix?: string | null;
    nameSuffix?: string | null;
    nickname?: string | null;
  } | null;
};

type AppleAuthModule = {
  AppleAuthenticationScope: {
    FULL_NAME: number;
    EMAIL: number;
  };
  isAvailableAsync?: () => Promise<boolean>;
  signInAsync: (options: {
    requestedScopes?: number[];
    nonce?: string;
  }) => Promise<AppleAuthCredential>;
};

export type AppleSignInErrorCode =
  | 'MISCONFIGURED'
  | 'NOT_SUPPORTED'
  | 'USER_CANCELLED'
  | 'APPLE_RESPONSE_INVALID'
  | 'BACKEND_FAILED'
  | 'FIREBASE_FAILED';

export class AppleSignInError extends Error {
  code: AppleSignInErrorCode;
  cause?: unknown;

  constructor(code: AppleSignInErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'AppleSignInError';
    this.code = code;
    this.cause = cause;
  }
}

const configReady = Boolean(API_BASE_URL);

const getAppleAuthModule = (): AppleAuthModule | null => {
  try {
    // Resolve lazily to keep Android/web builds resilient when package is absent.
    return require('expo-apple-authentication') as AppleAuthModule;
  } catch {
    return null;
  }
};

const generateAppleNonce = (): string => {
  try {
    return Crypto.randomUUID().replace(/-/g, '');
  } catch {
    const bytes = Crypto.getRandomBytes(16);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
};

const toFullName = (value: AppleAuthCredential['fullName']): string | undefined => {
  if (!value) return undefined;
  const parts = [
    value.namePrefix,
    value.givenName,
    value.middleName,
    value.familyName,
    value.nameSuffix,
  ]
    .map((item) => String(item || '').trim())
    .filter((item) => item.length > 0);
  if (parts.length === 0) return undefined;
  return parts.join(' ');
};

const postAppleIdentityToken = async (params: {
  identityToken: string;
  nonce: string;
  email?: string;
  fullName?: string;
}): Promise<string> => {
  try {
    const { data } = await axios.post<BackendResponse>(
      `${API_BASE_URL}/auth/apple`,
      {
        identity_token: params.identityToken,
        nonce: params.nonce,
        email: params.email,
        full_name: params.fullName,
      },
      {
        timeout: 20000,
      },
    );

    const customToken = data.firebase_custom_token?.trim();
    if (!customToken) {
      throw new AppleSignInError(
        'BACKEND_FAILED',
        'Backend did not return firebase_custom_token',
      );
    }
    return customToken;
  } catch (error) {
    if (error instanceof AppleSignInError) {
      throw error;
    }
    const axiosError = error as AxiosError<{ detail?: string }>;
    const backendMessage =
      axiosError.response?.data?.detail ||
      axiosError.message ||
      'Apple auth backend request failed';
    throw new AppleSignInError('BACKEND_FAILED', backendMessage, error);
  }
};

const signInWithFirebaseCustomToken = async (
  customToken: string,
): Promise<UserCredential> => {
  try {
    return await signInWithCustomToken(auth, customToken);
  } catch (error) {
    throw new AppleSignInError(
      'FIREBASE_FAILED',
      'Firebase sign-in with custom token failed',
      error,
    );
  }
};

const isCancelError = (error: unknown): boolean => {
  const code = String((error as { code?: unknown })?.code || '').toLowerCase();
  const message = String((error as { message?: unknown })?.message || '').toLowerCase();
  return (
    code.includes('cancel') ||
    code.includes('canceled') ||
    code.includes('request_canceled') ||
    message.includes('cancel')
  );
};

export const getAppleSignInErrorMessage = (
  error: unknown,
  t: (key: string) => string,
): string => {
  if (!(error instanceof AppleSignInError)) {
    return t('Unexpected error, try again.');
  }
  switch (error.code) {
    case 'MISCONFIGURED':
      return 'Set EXPO_PUBLIC_API_BASE_URL and install expo-apple-authentication.';
    case 'NOT_SUPPORTED':
      return 'Apple Sign-In is only available on iOS devices.';
    case 'USER_CANCELLED':
      return 'Apple sign-in cancelled by user.';
    default:
      return error.message || t('Unexpected error, try again.');
  }
};

export const useAppleAuth = () => {
  const ready = configReady && Platform.OS === 'ios' && Boolean(getAppleAuthModule());

  const signInWithApple = async (): Promise<UserCredential> => {
    if (!configReady) {
      throw new AppleSignInError(
        'MISCONFIGURED',
        'Apple Sign-In disabled or misconfigured in environment',
      );
    }

    if (Platform.OS !== 'ios') {
      throw new AppleSignInError(
        'NOT_SUPPORTED',
        'Apple Sign-In is only supported on iOS',
      );
    }

    const AppleAuthentication = getAppleAuthModule();
    if (!AppleAuthentication?.signInAsync) {
      throw new AppleSignInError(
        'MISCONFIGURED',
        'expo-apple-authentication is not installed',
      );
    }

    if (AppleAuthentication.isAvailableAsync) {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        throw new AppleSignInError(
          'NOT_SUPPORTED',
          'Apple Sign-In is unavailable on this device',
        );
      }
    }

    const nonce = generateAppleNonce();
    let credential: AppleAuthCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce,
      });
    } catch (error) {
      if (isCancelError(error)) {
        throw new AppleSignInError(
          'USER_CANCELLED',
          'Apple sign-in cancelled by user',
          error,
        );
      }
      throw new AppleSignInError(
        'APPLE_RESPONSE_INVALID',
        'Apple sign-in failed',
        error,
      );
    }

    const identityToken = String(credential.identityToken || '').trim();
    if (!identityToken) {
      throw new AppleSignInError(
        'APPLE_RESPONSE_INVALID',
        'No identity token returned from Apple',
      );
    }

    const email = String(credential.email || '').trim() || undefined;
    const fullName = toFullName(credential.fullName);
    const customToken = await postAppleIdentityToken({
      identityToken,
      nonce,
      email,
      fullName,
    });
    return signInWithFirebaseCustomToken(customToken);
  };

  return {
    signInWithApple,
    ready,
  };
};
