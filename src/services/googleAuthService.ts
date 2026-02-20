import axios, { AxiosError } from 'axios';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { signInWithCustomToken, UserCredential } from 'firebase/auth';
import { useRef } from 'react';
import { Platform } from 'react-native';

import { auth } from 'lib/firebase';
import {
  API_BASE_URL,
  GOOGLE_REDIRECT_URI,
  GOOGLE_SIGN_IN_ENABLED,
  GOOGLE_WEB_CLIENT_ID,
} from 'constants/featureFlags';

WebBrowser.maybeCompleteAuthSession();

type BackendResponse = {
  firebase_custom_token?: string;
};

export type GoogleSignInErrorCode =
  | 'MISCONFIGURED'
  | 'REQUEST_NOT_READY'
  | 'USER_CANCELLED'
  | 'GOOGLE_RESPONSE_INVALID'
  | 'SECURE_BROWSER_REQUIRED'
  | 'BACKEND_FAILED'
  | 'FIREBASE_FAILED';

export class GoogleSignInError extends Error {
  code: GoogleSignInErrorCode;
  cause?: unknown;

  constructor(code: GoogleSignInErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'GoogleSignInError';
    this.code = code;
    this.cause = cause;
  }
}

const googleDiscovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const generateGoogleNonce = (): string => {
  try {
    return Crypto.randomUUID().replace(/-/g, '');
  } catch {
    const bytes = Crypto.getRandomBytes(16);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
};

const ANDROID_SECURE_BROWSER_PACKAGES = [
  'com.android.chrome',
  'com.chrome.beta',
  'com.chrome.dev',
  'com.chrome.canary',
  'org.mozilla.firefox',
  'org.mozilla.firefox_beta',
  'org.mozilla.fenix',
  'com.brave.browser',
  'com.brave.browser_beta',
  'com.microsoft.emmx',
  'com.sec.android.app.sbrowser',
  'com.opera.browser',
  'com.vivaldi.browser',
];

const resolveAndroidSecureBrowserPackage = async (): Promise<string | null> => {
  if (Platform.OS !== 'android') {
    return null;
  }

  try {
    const browsers = await WebBrowser.getCustomTabsSupportingBrowsersAsync();
    const availablePackages = new Set(
      [
        browsers.preferredBrowserPackage,
        browsers.defaultBrowserPackage,
        ...browsers.servicePackages,
        ...browsers.browserPackages,
      ].filter((item): item is string => Boolean(item)),
    );

    for (const securePackage of ANDROID_SECURE_BROWSER_PACKAGES) {
      if (availablePackages.has(securePackage)) {
        return securePackage;
      }
    }
  } catch {
    return null;
  }

  return null;
};

const isDisallowedUserAgentError = (
  result: AuthSession.AuthSessionResult,
): boolean => {
  if (result.type !== 'error') {
    return false;
  }

  const raw = `${result.params?.error ?? ''} ${result.params?.error_description ?? ''}`;
  return raw.toLowerCase().includes('disallowed_useragent');
};

const configReady = Boolean(
  GOOGLE_SIGN_IN_ENABLED &&
    GOOGLE_WEB_CLIENT_ID &&
    GOOGLE_REDIRECT_URI &&
    API_BASE_URL,
);

const EXPO_AUTH_PROXY_PREFIX = 'https://auth.expo.io/';
const usesExpoAuthProxyRedirect = GOOGLE_REDIRECT_URI.startsWith(EXPO_AUTH_PROXY_PREFIX);

const buildExpoAuthProxyStartUrl = (authUrl: string, returnUrl: string): string => {
  const baseRedirect = GOOGLE_REDIRECT_URI.replace(/\/+$/, '');
  const query = new URLSearchParams({
    authUrl,
    returnUrl,
  });
  return `${baseRedirect}/start?${query.toString()}`;
};

const resolveIdToken = (result: AuthSession.AuthSessionResult): string | null => {
  if (result.type !== 'success') {
    return null;
  }

  const paramsToken = result.params?.id_token;
  if (paramsToken && paramsToken.trim()) {
    return paramsToken.trim();
  }

  return null;
};

const postGoogleIdToken = async (idToken: string): Promise<string> => {
  try {
    const { data } = await axios.post<BackendResponse>(
      `${API_BASE_URL}/auth/google`,
      { id_token: idToken },
      {
        timeout: 20000,
      },
    );

    const customToken = data.firebase_custom_token?.trim();
    if (!customToken) {
      throw new GoogleSignInError(
        'BACKEND_FAILED',
        'Backend did not return firebase_custom_token',
      );
    }

    return customToken;
  } catch (error) {
    if (error instanceof GoogleSignInError) {
      throw error;
    }

    const axiosError = error as AxiosError<{ detail?: string }>;
    const backendMessage =
      axiosError.response?.data?.detail ||
      axiosError.message ||
      'Google auth backend request failed';

    throw new GoogleSignInError('BACKEND_FAILED', backendMessage, error);
  }
};

const signInWithFirebaseCustomToken = async (
  customToken: string,
): Promise<UserCredential> => {
  try {
    return await signInWithCustomToken(auth, customToken);
  } catch (error) {
    throw new GoogleSignInError(
      'FIREBASE_FAILED',
      'Firebase sign-in with custom token failed',
      error,
    );
  }
};

const mapResultToError = (
  result: AuthSession.AuthSessionResult,
): GoogleSignInError => {
  if (result.type === 'cancel' || result.type === 'dismiss') {
    return new GoogleSignInError(
      'USER_CANCELLED',
      'Google sign-in was cancelled by user',
    );
  }

  if (result.type === 'error') {
    const description =
      result.params?.error_description ||
      result.params?.error ||
      'Google sign-in failed';
    return new GoogleSignInError('GOOGLE_RESPONSE_INVALID', description);
  }

  return new GoogleSignInError(
    'GOOGLE_RESPONSE_INVALID',
    `Unexpected Google auth result type: ${result.type}`,
  );
};

export const getGoogleSignInErrorMessage = (
  error: unknown,
  t: (key: string) => string,
): string => {
  if (!(error instanceof GoogleSignInError)) {
    return t('Unexpected error, try again.');
  }

  switch (error.code) {
    case 'MISCONFIGURED':
      return t('Set EXPO_PUBLIC_GOOGLE_* and EXPO_PUBLIC_API_BASE_URL, then restart.');
    case 'REQUEST_NOT_READY':
      return t('Google Sign-In not configured');
    case 'USER_CANCELLED':
      return t('Google sign-in cancelled or failed');
    case 'SECURE_BROWSER_REQUIRED':
      return t('Install/update Chrome (or another secure browser) and set it as default.');
    default:
      return error.message || t('Unexpected error, try again.');
  }
};

export const useGoogleAuth = () => {
  const nonceRef = useRef<string>('');
  if (!nonceRef.current) {
    nonceRef.current = generateGoogleNonce();
  }

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_WEB_CLIENT_ID,
      redirectUri: GOOGLE_REDIRECT_URI,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.IdToken,
      usePKCE: false,
      extraParams: {
        prompt: AuthSession.Prompt.SelectAccount,
        nonce: nonceRef.current,
      },
    },
    googleDiscovery,
  );

  const signInWithGoogle = async (): Promise<UserCredential> => {
    if (!configReady) {
      throw new GoogleSignInError(
        'MISCONFIGURED',
        'Google Sign-In disabled or misconfigured in environment',
      );
    }

    if (!request) {
      throw new GoogleSignInError(
        'REQUEST_NOT_READY',
        'Google Sign-In request not initialized',
      );
    }

    let androidBrowserPackage: string | undefined;
    if (Platform.OS === 'android') {
      androidBrowserPackage = await resolveAndroidSecureBrowserPackage() ?? undefined;
      if (!androidBrowserPackage) {
        throw new GoogleSignInError(
          'SECURE_BROWSER_REQUIRED',
          'No secure browser found. Install/update Chrome (or Firefox/Edge/Brave) and set it as default browser.',
        );
      }

      try {
        await WebBrowser.warmUpAsync(androidBrowserPackage);
      } catch {
        // Warm-up is optional. Continue even if it fails.
      }
    }

    let result: AuthSession.AuthSessionResult;
    try {
      const browserOptions =
        Platform.OS === 'android'
          ? {
              browserPackage: androidBrowserPackage,
              createTask: true,
              showInRecents: true,
            }
          : undefined;

      if (usesExpoAuthProxyRedirect) {
        const returnUrl = AuthSession.makeRedirectUri({
          scheme: 'com.voxwallet.app',
          path: 'oauthredirect',
        });
        const authUrl = await request.makeAuthUrlAsync(googleDiscovery);
        const startUrl = buildExpoAuthProxyStartUrl(authUrl, returnUrl);
        const proxyResult = await WebBrowser.openAuthSessionAsync(
          startUrl,
          returnUrl,
          browserOptions,
        );
        result =
          proxyResult.type === 'success'
            ? request.parseReturnUrl(proxyResult.url)
            : ({
                type: proxyResult.type,
              } as AuthSession.AuthSessionResult);
      } else {
        result = await promptAsync(browserOptions);
      }
    } catch (error) {
      if (Platform.OS === 'android') {
        throw new GoogleSignInError(
          'SECURE_BROWSER_REQUIRED',
          'Failed to launch a secure browser for Google sign-in',
          error,
        );
      }
      throw error;
    } finally {
      if (Platform.OS === 'android' && androidBrowserPackage) {
        void WebBrowser.coolDownAsync(androidBrowserPackage).catch(() => undefined);
      }
    }

    if (isDisallowedUserAgentError(result)) {
      throw new GoogleSignInError(
        'SECURE_BROWSER_REQUIRED',
        'Google blocked embedded browser. Use Chrome/Firefox/Edge as default browser.',
      );
    }

    if (result.type !== 'success') {
      throw mapResultToError(result);
    }

    const idToken = resolveIdToken(result);
    if (!idToken) {
      throw new GoogleSignInError(
        'GOOGLE_RESPONSE_INVALID',
        'No id_token returned from Google',
      );
    }

    const customToken = await postGoogleIdToken(idToken);
    return signInWithFirebaseCustomToken(customToken);
  };

  return {
    signInWithGoogle,
    ready: configReady && !!request,
  };
};
