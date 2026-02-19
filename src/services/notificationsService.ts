import axios from 'axios';
import { API_BASE_URL } from 'constants/featureFlags';
import { auth } from 'lib/firebase';

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  title_map?: Record<string, string>;
  body_map?: Record<string, string>;
  data?: Record<string, any>;
  created_at: string;
  read_at?: string | null;
  is_read: boolean;
};

type NotificationListResponse = {
  items: AppNotification[];
  unread_count: number;
};

type NotificationUnreadCountResponse = {
  unread_count: number;
};

type NotificationMarkReadResponse = {
  id: string;
  read_at?: string | null;
  is_read: boolean;
};

type NotificationMarkAllReadResponse = {
  updated_count: number;
};

type OverspendingNotificationResponse = {
  triggered: boolean;
  notification_id?: string;
  reason?: string;
  push_attempted?: number;
  push_sent?: number;
  push_failed?: number;
};

type AdminBroadcastNotificationResponse = {
  delivered_users: number;
  created_count: number;
  deduped_count: number;
  push_attempted?: number;
  push_sent?: number;
  push_failed?: number;
};

type PushTokenRegisterResponse = {
  token_id: string;
  provider: string;
  platform?: string | null;
  active: boolean;
};

type PushTokenUnregisterResponse = {
  token_id: string;
  removed: boolean;
};

const requireToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user.getIdToken();
};

const requireApiBaseUrl = () => {
  if (!API_BASE_URL) {
    throw new Error('API_BASE_URL not configured');
  }
  return API_BASE_URL;
};

const authHeader = async () => {
  const token = await requireToken();
  return {
    Authorization: `Bearer ${token}`,
  };
};

export const listMyNotifications = async (params?: {
  limit?: number;
  unreadOnly?: boolean;
  language?: string;
}): Promise<NotificationListResponse> => {
  const baseUrl = requireApiBaseUrl();
  const headers = await authHeader();
  const { data } = await axios.get<NotificationListResponse>(
    `${baseUrl}/me/notifications`,
    {
      headers,
      params: {
        limit: params?.limit ?? 50,
        unread_only: Boolean(params?.unreadOnly),
        language: params?.language,
      },
    }
  );
  return data;
};

export const getMyNotificationUnreadCount = async (): Promise<number> => {
  const baseUrl = requireApiBaseUrl();
  const headers = await authHeader();
  const { data } = await axios.get<NotificationUnreadCountResponse>(
    `${baseUrl}/me/notifications/unread-count`,
    { headers }
  );
  return Number(data.unread_count ?? 0);
};

export const markMyNotificationRead = async (
  notificationId: string
): Promise<NotificationMarkReadResponse> => {
  const baseUrl = requireApiBaseUrl();
  const headers = await authHeader();
  const { data } = await axios.post<NotificationMarkReadResponse>(
    `${baseUrl}/me/notifications/${notificationId}/read`,
    {},
    { headers }
  );
  return data;
};

export const markAllMyNotificationsRead = async (): Promise<NotificationMarkAllReadResponse> => {
  const baseUrl = requireApiBaseUrl();
  const headers = await authHeader();
  const { data } = await axios.post<NotificationMarkAllReadResponse>(
    `${baseUrl}/me/notifications/read-all`,
    {},
    { headers }
  );
  return data;
};

export const registerMyPushToken = async (payload: {
  token: string;
  provider?: 'fcm' | 'expo';
  platform?: string;
  appVersion?: string;
  locale?: string;
}): Promise<PushTokenRegisterResponse> => {
  const baseUrl = requireApiBaseUrl();
  const headers = await authHeader();
  const { data } = await axios.post<PushTokenRegisterResponse>(
    `${baseUrl}/me/push-tokens/register`,
    {
      token: payload.token,
      provider: payload.provider ?? 'fcm',
      platform: payload.platform,
      app_version: payload.appVersion,
      locale: payload.locale,
    },
    { headers }
  );
  return data;
};

export const unregisterMyPushToken = async (payload: {
  token: string;
  provider?: 'fcm' | 'expo';
}): Promise<PushTokenUnregisterResponse> => {
  const baseUrl = requireApiBaseUrl();
  const headers = await authHeader();
  const { data } = await axios.post<PushTokenUnregisterResponse>(
    `${baseUrl}/me/push-tokens/unregister`,
    {
      token: payload.token,
      provider: payload.provider,
    },
    { headers }
  );
  return data;
};

export const createOverspendingNotification = async (payload: {
  periodKey?: string;
  actualSpent: number;
  expectedSpent: number;
  currency?: string;
  language?: string;
}): Promise<OverspendingNotificationResponse> => {
  const baseUrl = requireApiBaseUrl();
  const headers = await authHeader();
  const { data } = await axios.post<OverspendingNotificationResponse>(
    `${baseUrl}/me/notifications/overspending`,
    {
      period_key: payload.periodKey,
      actual_spent: payload.actualSpent,
      expected_spent: payload.expectedSpent,
      currency: payload.currency,
      language: payload.language,
    },
    { headers }
  );
  return data;
};

export const broadcastNotificationToAllUsers = async (payload: {
  title?: string;
  body?: string;
  titleMap?: Record<string, string>;
  bodyMap?: Record<string, string>;
  data?: Record<string, any>;
  dedupeKey?: string;
}): Promise<AdminBroadcastNotificationResponse> => {
  const baseUrl = requireApiBaseUrl();
  const headers = await authHeader();
  const { data } = await axios.post<AdminBroadcastNotificationResponse>(
    `${baseUrl}/admin/notifications/broadcast`,
    {
      title: payload.title,
      body: payload.body,
      title_map: payload.titleMap,
      body_map: payload.bodyMap,
      data: payload.data ?? {},
      dedupe_key: payload.dedupeKey,
    },
    { headers }
  );
  return data;
};
