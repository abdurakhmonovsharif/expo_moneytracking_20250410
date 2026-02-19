import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from 'constants/featureFlags';

type FxRatesResponse = {
  base: string;
  date?: string;
  rates: Record<string, number>;
  previous_date?: string;
  previous_rates?: Record<string, number>;
  delta_rates?: Record<string, number>;
  updated_at?: string;
  source?: string;
};

type CbuRateItem = {
  Ccy?: string;
  Rate?: string;
  Diff?: string;
  Nominal?: string;
  Date?: string;
};

const FX_CACHE_KEY = 'fx_rates_cache_v2';
const FX_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const CBU_RATES_URL = 'https://cbu.uz/uz/arkhiv-kursov-valyut/json/';

type FxCachePayload = {
  updatedAt: string;
  date?: string;
  previousDate?: string;
  rates: Record<string, number>;
  previousRates?: Record<string, number>;
  deltaRates?: Record<string, number>;
  source?: string;
};

const getNow = () => Date.now();

const parseNumber = (value?: string | number | null) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const normalized = value.toString().trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseCbuDate = (raw?: string) => {
  if (!raw) return new Date().toISOString();
  const parts = raw.trim().split('.');
  if (parts.length !== 3) return new Date().toISOString();
  const [day, month, year] = parts;
  const yyyy = Number(year);
  const mm = Number(month);
  const dd = Number(day);
  if (!yyyy || !mm || !dd) return new Date().toISOString();
  const iso = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0));
  return iso.toISOString();
};

const shiftDateIso = (isoDate: string, deltaDays: number) => {
  const parsed = new Date(`${isoDate}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) {
    return undefined;
  }
  parsed.setUTCDate(parsed.getUTCDate() + deltaDays);
  return parsed.toISOString().slice(0, 10);
};

const normalizeCbuRates = (items: CbuRateItem[]) => {
  const rates: Record<string, number> = { UZS: 1 };
  const deltaRates: Record<string, number> = { UZS: 0 };
  const previousRates: Record<string, number> = { UZS: 1 };
  let updatedAt: string | null = null;
  for (const item of items) {
    const code = (item.Ccy ?? '').toString().trim().toUpperCase();
    if (!code) continue;
    const rate = parseNumber(item.Rate);
    const nominal = parseNumber(item.Nominal) ?? 1;
    if (!rate || nominal <= 0) continue;
    const normalizedRate = rate / nominal;
    rates[code] = normalizedRate;
    const diff = parseNumber(item.Diff);
    if (diff !== null) {
      const normalizedDiff = diff / nominal;
      deltaRates[code] = normalizedDiff;
      previousRates[code] = normalizedRate - normalizedDiff;
    }
    if (item.Date && !updatedAt) {
      updatedAt = parseCbuDate(item.Date);
    }
  }
  const date = (updatedAt ?? new Date().toISOString()).slice(0, 10);
  return {
    rates,
    updatedAt: updatedAt ?? new Date().toISOString(),
    date,
    previousDate: shiftDateIso(date, -1),
    previousRates: Object.keys(previousRates).length > 1 ? previousRates : undefined,
    deltaRates: Object.keys(deltaRates).length > 1 ? deltaRates : undefined,
    source: 'CBU',
  };
};

const fetchFromBackend = async () => {
  const { data } = await axios.get<FxRatesResponse>(`${API_BASE_URL}/fx/rates`);
  const updatedAt = data.updated_at ?? new Date().toISOString();
  const date = data.date;
  return {
    rates: data.rates ?? {},
    updatedAt,
    date,
    previousDate: data.previous_date,
    previousRates: data.previous_rates ?? undefined,
    deltaRates: data.delta_rates ?? undefined,
    source: data.source,
  };
};

const fetchFromCbu = async () => {
  const { data } = await axios.get<CbuRateItem[]>(CBU_RATES_URL);
  if (!Array.isArray(data)) {
    return null;
  }
  const normalized = normalizeCbuRates(data);
  return normalized.rates ? normalized : null;
};

export const loadFxRates = async (force = false): Promise<FxCachePayload | null> => {
  if (!force) {
    const cachedRaw = await AsyncStorage.getItem(FX_CACHE_KEY);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw) as FxCachePayload & { storedAt: number };
        if (cached?.rates && cached?.storedAt) {
          const age = getNow() - cached.storedAt;
          if (age < FX_TTL_MS) {
            return {
              rates: cached.rates,
              updatedAt: cached.updatedAt,
              date: cached.date,
              previousDate: cached.previousDate,
              previousRates: cached.previousRates,
              deltaRates: cached.deltaRates,
              source: cached.source,
            };
          }
        }
      } catch {
        // ignore invalid cache
      }
    }
  }

  if (!API_BASE_URL) {
    // Allow direct CBU fallback when backend is not configured.
    const fallback = await fetchFromCbu().catch(() => null);
    if (fallback?.rates) {
      await AsyncStorage.setItem(
        FX_CACHE_KEY,
        JSON.stringify({ ...fallback, storedAt: getNow() })
      );
      return fallback;
    }
    return null;
  }

  let payload: FxCachePayload | null = null;
  try {
    payload = await fetchFromBackend();
  } catch {
    payload = null;
  }
  if (!payload?.rates || Object.keys(payload.rates).length === 0) {
    const fallback = await fetchFromCbu().catch(() => null);
    if (fallback?.rates) {
      payload = fallback;
    }
  }
  if (!payload) {
    return null;
  }

  await AsyncStorage.setItem(
    FX_CACHE_KEY,
    JSON.stringify({ ...payload, storedAt: getNow() })
  );

  return payload;
};

export const clearFxRatesCache = async () => {
  await AsyncStorage.removeItem(FX_CACHE_KEY);
};
