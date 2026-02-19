import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { auth } from "lib/firebase";
import { registerMyPushToken, unregisterMyPushToken } from "./notificationsService";

type PushProvider = "fcm" | "expo";

type TokenRegistrationResult = {
  registered: boolean;
  reason?: string;
};

type CachedPushToken = {
  uid: string;
  token: string;
  provider: PushProvider;
};

const PUSH_TOKEN_CACHE_KEY = "@moneytracking/push-token";
const DEFAULT_ANDROID_CHANNEL_ID = "default";

let notificationHandlerConfigured = false;

const ensureNotificationHandler = () => {
  if (notificationHandlerConfigured) {
    return;
  }
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  notificationHandlerConfigured = true;
};

const getExpoProjectId = (): string | undefined => {
  const easProjectId = (Constants as unknown as { easConfig?: { projectId?: string } })
    ?.easConfig?.projectId;
  const expoProjectId = (
    Constants as unknown as { expoConfig?: { extra?: { eas?: { projectId?: string } } } }
  )?.expoConfig?.extra?.eas?.projectId;
  return easProjectId || expoProjectId;
};

const normalizeLocale = (value?: string): string => {
  if (value && value.trim()) {
    return value.trim().toLowerCase();
  }
  try {
    const raw = Intl.DateTimeFormat().resolvedOptions().locale || "en";
    const [base] = raw.split("-");
    return (base || raw || "en").toLowerCase();
  } catch {
    return "en";
  }
};

const ensureAndroidChannel = async () => {
  if (Platform.OS !== "android") {
    return;
  }
  await Notifications.setNotificationChannelAsync(DEFAULT_ANDROID_CHANNEL_ID, {
    name: "Default",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#22C55E",
    sound: "default",
  });
};

const ensurePushPermission = async (): Promise<boolean> => {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return (
    requested.granted ||
    requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
};

const isPhysicalDeviceAsync = async (): Promise<boolean> => {
  try {
    const deviceModule = await import("expo-device");
    return Boolean(deviceModule?.isDevice);
  } catch {
    // Avoid crashing when native module isn't in the currently installed dev build.
    return false;
  }
};

const resolveNativePushToken = async (): Promise<{ token: string; provider: PushProvider } | null> => {
  const isPhysicalDevice = await isPhysicalDeviceAsync();
  if (!isPhysicalDevice) {
    return null;
  }
  await ensureAndroidChannel();
  const allowed = await ensurePushPermission();
  if (!allowed) {
    return null;
  }

  if (Platform.OS === "android") {
    const nativeToken = await Notifications.getDevicePushTokenAsync();
    const token = String(nativeToken?.data || "").trim();
    if (token) {
      return { token, provider: "fcm" };
    }
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    return null;
  }
  const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
  if (!expoToken?.data) {
    return null;
  }
  return { token: expoToken.data, provider: "expo" };
};

const readCachedToken = async (): Promise<CachedPushToken | null> => {
  try {
    const raw = await AsyncStorage.getItem(PUSH_TOKEN_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachedPushToken;
    if (!parsed?.token || !parsed?.provider || !parsed?.uid) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeCachedToken = async (value: CachedPushToken) => {
  await AsyncStorage.setItem(PUSH_TOKEN_CACHE_KEY, JSON.stringify(value));
};

const clearCachedToken = async () => {
  await AsyncStorage.removeItem(PUSH_TOKEN_CACHE_KEY);
};

export const registerPushNotificationsForCurrentUser = async (
  language?: string
): Promise<TokenRegistrationResult> => {
  ensureNotificationHandler();
  const user = auth.currentUser;
  if (!user) {
    return { registered: false, reason: "no_authenticated_user" };
  }

  const resolved = await resolveNativePushToken();
  if (!resolved) {
    return { registered: false, reason: "push_token_unavailable" };
  }

  const locale = normalizeLocale(language);
  await registerMyPushToken({
    token: resolved.token,
    provider: resolved.provider,
    platform: Platform.OS,
    locale,
  });
  await writeCachedToken({
    uid: user.uid,
    token: resolved.token,
    provider: resolved.provider,
  });
  return { registered: true };
};

export const unregisterPushNotificationsForCurrentUser = async (): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) {
    return false;
  }
  const cached = await readCachedToken();
  if (!cached || cached.uid !== user.uid) {
    return false;
  }
  await unregisterMyPushToken({
    token: cached.token,
    provider: cached.provider,
  });
  await clearCachedToken();
  return true;
};

export const subscribeToNotificationOpens = (onOpen: () => void): (() => void) => {
  ensureNotificationHandler();
  const subscription = Notifications.addNotificationResponseReceivedListener(() => {
    onOpen();
  });
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) {
        onOpen();
      }
    })
    .catch(() => {
      // no-op
    });
  return () => {
    subscription.remove();
  };
};
