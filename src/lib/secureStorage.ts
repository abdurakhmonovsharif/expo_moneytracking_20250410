import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const SECURE_KEY_PREFIX = "voxwallet_secure_";
const MAX_SECURE_STORE_VALUE_BYTES = 1800;
const CHUNK_META_SUFFIX = "__meta";
const CHUNK_VALUE_SUFFIX = "__chunk_";

type ChunkMeta = {
  v: 1;
  chunks: number;
};

const buildSecureStoreKey = async (key: string): Promise<string> => {
  try {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      key
    );
    return `${SECURE_KEY_PREFIX}${digest}`;
  } catch {
    const fallback = key.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `${SECURE_KEY_PREFIX}${fallback}`;
  }
};

const buildChunkMetaKey = (secureKey: string) => `${secureKey}${CHUNK_META_SUFFIX}`;
const buildChunkValueKey = (secureKey: string, index: number) =>
  `${secureKey}${CHUNK_VALUE_SUFFIX}${index}`;

const utf8CharInfo = (value: string, index: number) => {
  const codeUnit = value.charCodeAt(index);
  if (codeUnit <= 0x7f) {
    return { bytes: 1, charLength: 1 };
  }
  if (codeUnit <= 0x7ff) {
    return { bytes: 2, charLength: 1 };
  }
  if (codeUnit >= 0xd800 && codeUnit <= 0xdbff && index + 1 < value.length) {
    const low = value.charCodeAt(index + 1);
    if (low >= 0xdc00 && low <= 0xdfff) {
      return { bytes: 4, charLength: 2 };
    }
  }
  return { bytes: 3, charLength: 1 };
};

const utf8ByteLength = (value: string): number => {
  let total = 0;
  let index = 0;
  while (index < value.length) {
    const { bytes, charLength } = utf8CharInfo(value, index);
    total += bytes;
    index += charLength;
  }
  return total;
};

const splitByUtf8Bytes = (value: string, maxBytes: number): string[] => {
  if (value.length === 0) {
    return [""];
  }

  const chunks: string[] = [];
  let chunkStart = 0;
  let chunkBytes = 0;
  let index = 0;

  while (index < value.length) {
    const { bytes, charLength } = utf8CharInfo(value, index);
    if (chunkBytes + bytes > maxBytes && chunkStart < index) {
      chunks.push(value.slice(chunkStart, index));
      chunkStart = index;
      chunkBytes = 0;
      continue;
    }

    chunkBytes += bytes;
    index += charLength;
  }

  if (chunkStart < value.length) {
    chunks.push(value.slice(chunkStart));
  }

  return chunks;
};

const parseChunkMeta = (raw: string): ChunkMeta | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<ChunkMeta>;
    if (parsed?.v !== 1) {
      return null;
    }
    if (!Number.isInteger(parsed.chunks) || (parsed.chunks ?? 0) <= 0) {
      return null;
    }
    return { v: 1, chunks: parsed.chunks as number };
  } catch {
    return null;
  }
};

const readLegacyValue = async (key: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
};

const clearLegacyValue = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // no-op
  }
};

const removeSecureStoreKeySilently = async (key: string): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // no-op
  }
};

const removeChunkedValue = async (secureKey: string): Promise<void> => {
  const metaKey = buildChunkMetaKey(secureKey);
  try {
    const rawMeta = await SecureStore.getItemAsync(metaKey);
    if (!rawMeta) {
      await removeSecureStoreKeySilently(metaKey);
      return;
    }

    const meta = parseChunkMeta(rawMeta);
    if (!meta) {
      await removeSecureStoreKeySilently(metaKey);
      return;
    }

    await Promise.all(
      Array.from({ length: meta.chunks }, (_, index) =>
        removeSecureStoreKeySilently(buildChunkValueKey(secureKey, index))
      )
    );
    await removeSecureStoreKeySilently(metaKey);
  } catch {
    // no-op
  }
};

const readChunkedValue = async (secureKey: string): Promise<string | null> => {
  const metaKey = buildChunkMetaKey(secureKey);
  try {
    const rawMeta = await SecureStore.getItemAsync(metaKey);
    if (!rawMeta) {
      return null;
    }

    const meta = parseChunkMeta(rawMeta);
    if (!meta) {
      await removeSecureStoreKeySilently(metaKey);
      return null;
    }

    const chunkPromises = Array.from({ length: meta.chunks }, (_, index) =>
      SecureStore.getItemAsync(buildChunkValueKey(secureKey, index))
    );
    const chunks = await Promise.all(chunkPromises);
    if (chunks.some((item) => item === null)) {
      await removeChunkedValue(secureKey);
      return null;
    }
    return chunks.join("");
  } catch {
    return null;
  }
};

const writeSecureValue = async (secureKey: string, value: string): Promise<void> => {
  const valueBytes = utf8ByteLength(value);

  await removeSecureStoreKeySilently(secureKey);
  await removeChunkedValue(secureKey);

  if (valueBytes <= MAX_SECURE_STORE_VALUE_BYTES) {
    await SecureStore.setItemAsync(secureKey, value);
    return;
  }

  const chunks = splitByUtf8Bytes(value, MAX_SECURE_STORE_VALUE_BYTES);
  await Promise.all(
    chunks.map((chunk, index) =>
      SecureStore.setItemAsync(buildChunkValueKey(secureKey, index), chunk)
    )
  );
  const meta: ChunkMeta = {
    v: 1,
    chunks: chunks.length,
  };
  await SecureStore.setItemAsync(buildChunkMetaKey(secureKey), JSON.stringify(meta));
};

const readSecureValue = async (key: string): Promise<string | null> => {
  const secureKey = await buildSecureStoreKey(key);
  const chunkedValue = await readChunkedValue(secureKey);
  if (chunkedValue !== null) {
    return chunkedValue;
  }

  try {
    const value = await SecureStore.getItemAsync(secureKey);
    if (value !== null) {
      return value;
    }
  } catch {
    // no-op
  }

  // Backward compatibility for keys written directly before key normalization.
  try {
    const directValue = await SecureStore.getItemAsync(key);
    if (directValue !== null) {
      try {
        await writeSecureValue(secureKey, directValue);
        await removeSecureStoreKeySilently(key);
      } catch {
        // no-op
      }
      return directValue;
    }
  } catch {
    // no-op
  }

  return null;
};

export const secureStorage: StorageAdapter = {
  async getItem(key) {
    const secureValue = await readSecureValue(key);
    if (secureValue !== null) {
      return secureValue;
    }

    const legacyValue = await readLegacyValue(key);
    if (legacyValue === null) {
      return null;
    }

    try {
      const secureKey = await buildSecureStoreKey(key);
      await writeSecureValue(secureKey, legacyValue);
      await clearLegacyValue(key);
    } catch {
      // no-op
    }

    return legacyValue;
  },
  async setItem(key, value) {
    const secureKey = await buildSecureStoreKey(key);
    await writeSecureValue(secureKey, value);
    await clearLegacyValue(key);
    await removeSecureStoreKeySilently(key);
  },
  async removeItem(key) {
    const secureKey = await buildSecureStoreKey(key);
    await removeSecureStoreKeySilently(secureKey);
    await removeChunkedValue(secureKey);
    await removeSecureStoreKeySilently(key);
    await clearLegacyValue(key);
  },
};
