import axios from "axios";
import { API_BASE_URL } from "constants/featureFlags";
import { auth } from "lib/firebase";

export type UserPermissionsResponse = {
  plan: string;
  permissions: Record<string, boolean | number | string>;
};

const requireToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }
  return user.getIdToken();
};

export const fetchUserPermissions = async (): Promise<UserPermissionsResponse | null> => {
  if (!API_BASE_URL) {
    return null;
  }
  const token = await requireToken();
  const { data } = await axios.get<UserPermissionsResponse>(
    `${API_BASE_URL.replace(/\/$/, "")}/me/permissions`,
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
    }
  );
  return data;
};
