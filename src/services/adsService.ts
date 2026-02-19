import axios from "axios";
import { API_BASE_URL } from "constants/featureFlags";
import { auth } from "lib/firebase";

export type AdsConfig = {
  enabled?: boolean;
  min_interval_sec?: number;
  min_view_sec?: number;
  show_on?: string[];
};

export type AdsConfigResponse = {
  platform: string;
  config: AdsConfig;
  updated_at?: string | null;
};

const requireToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }
  return user.getIdToken();
};

export const fetchAdsConfig = async (
  platform: "ios" | "android"
): Promise<AdsConfigResponse | null> => {
  if (!API_BASE_URL) {
    return null;
  }
  const token = await requireToken();
  const baseUrl = API_BASE_URL.replace(/\/$/, "");
  const { data } = await axios.get<AdsConfigResponse>(
    `${baseUrl}/ads/config/${platform}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return data;
};
