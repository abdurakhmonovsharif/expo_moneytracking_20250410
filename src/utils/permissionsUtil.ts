type PermissionValue = boolean | number | string | null | undefined;

export const getPermissionValue = (
  permissions: Record<string, PermissionValue> | undefined | null,
  key: string,
  fallback: PermissionValue = undefined
) => {
  if (!permissions) return fallback;
  const value = permissions[key];
  return value === undefined ? fallback : value;
};

export const getPermissionBoolean = (
  permissions: Record<string, PermissionValue> | undefined | null,
  key: string,
  fallback = true
) => {
  const value = getPermissionValue(permissions, key, fallback);
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
};

export const getPermissionNumber = (
  permissions: Record<string, PermissionValue> | undefined | null,
  key: string,
  fallback = 0
) => {
  const value = getPermissionValue(permissions, key, fallback);
  if (value === undefined || value === null) return fallback;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
