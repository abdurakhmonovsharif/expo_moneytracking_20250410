const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
// Custom scheme redirect; no Expo proxy allowed
const GOOGLE_REDIRECT_URI =
  process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI ?? 'moneytracking://oauthredirect';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const IAP_IOS_SUBSCRIPTION_ID =
  process.env.EXPO_PUBLIC_IAP_IOS_SUBSCRIPTION_ID ?? '';
const IAP_ANDROID_SUBSCRIPTION_ID =
  process.env.EXPO_PUBLIC_IAP_ANDROID_SUBSCRIPTION_ID ?? '';

// Feature flag stays but defaults to true when client ID exists
const envEnabled = (process.env.EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED ?? 'true').toLowerCase();
const GOOGLE_SIGN_IN_ENABLED = envEnabled !== 'false' && Boolean(GOOGLE_WEB_CLIENT_ID);

export {
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_REDIRECT_URI,
  GOOGLE_SIGN_IN_ENABLED,
  API_BASE_URL,
  IAP_IOS_SUBSCRIPTION_ID,
  IAP_ANDROID_SUBSCRIPTION_ID,
};
