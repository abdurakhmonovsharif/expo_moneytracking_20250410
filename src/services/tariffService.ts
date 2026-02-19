import axios from "axios";
import { Platform } from "react-native";
import { API_BASE_URL } from "constants/featureFlags";
import { auth } from "lib/firebase";

export type TariffPurchaseType = "subscription" | "one_time";

export type TariffStoreProductIds = {
  ios?: string | null;
  android?: string | null;
};

export type TariffPlan = {
  id: string;
  name: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  access_plan: string;
  purchase_type: TariffPurchaseType;
  billing_period_unit: string;
  billing_period_count: number;
  price_amount: number;
  currency: string;
  price_label?: string | null;
  price_sub_label?: string | null;
  discount_percent: number;
  discount_label?: string | null;
  badge_text?: string | null;
  trial_days: number;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  cta_title?: string | null;
  cta_subtitle?: string | null;
  cta_button_text?: string | null;
  nighth_style: Record<string, string | number | boolean>;
  store_product_ids: TariffStoreProductIds;
  created_at?: string | null;
  updated_at?: string | null;
};

type TariffListResponse = {
  tariffs: TariffPlan[];
};

export type SubscriptionAccessProfile = {
  plan?: string;
  access_plan?: string;
  is_premium?: boolean;
  premium_status?: string | null;
  premium_until?: string | null;
  trial_status?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  trial_expired_at?: string | null;
  trial_converted_at?: string | null;
  trial_tariff_id?: string | null;
  trial_access_plan?: string | null;
  trial_consumed?: boolean;
  active_tariff_id?: string | null;
  pending_tariff_id?: string | null;
};

type TrialStartResponse = {
  profile: SubscriptionAccessProfile;
  tariff: TariffPlan;
};

const requireToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }
  return user.getIdToken();
};

const getApiBaseUrl = () => {
  if (!API_BASE_URL) {
    throw new Error("API_BASE_URL not configured");
  }
  return API_BASE_URL.replace(/\/$/, "");
};

const getPlatformKey = (): "ios" | "android" =>
  Platform.OS === "ios" ? "ios" : "android";

export const getTariffProductId = (tariff: TariffPlan): string | null => {
  const platform = getPlatformKey();
  const value = tariff.store_product_ids?.[platform];
  if (!value) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
};

export const fetchTariffs = async (): Promise<TariffPlan[]> => {
  const token = await requireToken();
  const baseUrl = getApiBaseUrl();
  const platform = getPlatformKey();
  const { data } = await axios.get<TariffListResponse>(`${baseUrl}/tariffs`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { platform },
    timeout: 8000,
  });
  const tariffs = Array.isArray(data?.tariffs) ? data.tariffs : [];
  return tariffs.filter((item) => item?.is_active !== false);
};

export const fetchMySubscriptionProfile = async (): Promise<SubscriptionAccessProfile> => {
  const token = await requireToken();
  const baseUrl = getApiBaseUrl();
  const { data } = await axios.get<SubscriptionAccessProfile>(`${baseUrl}/me`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 8000,
  });
  return data;
};

export const startTariffTrial = async (
  tariffId: string
): Promise<TrialStartResponse> => {
  const token = await requireToken();
  const baseUrl = getApiBaseUrl();
  const { data } = await axios.post<TrialStartResponse>(
    `${baseUrl}/me/trial/start`,
    { tariff_id: tariffId },
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    }
  );
  return data;
};

