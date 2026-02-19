import { Platform } from "react-native";
import * as RNIap from "react-native-iap";
import axios from "axios";
import {
  API_BASE_URL,
  IAP_ANDROID_SUBSCRIPTION_ID,
  IAP_IOS_SUBSCRIPTION_ID,
} from "constants/featureFlags";
import { auth } from "lib/firebase";
import { TariffPurchaseType } from "./tariffService";

const getSubscriptionSkus = (): string[] => {
  const sku =
    Platform.OS === "ios" ? IAP_IOS_SUBSCRIPTION_ID : IAP_ANDROID_SUBSCRIPTION_ID;
  return sku ? [sku] : [];
};

const uniqueSkus = (skus: Array<string | null | undefined>) => {
  const normalized = skus
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0);
  return Array.from(new Set(normalized));
};

export const initIapConnection = async () => {
  await RNIap.initConnection();
  if (Platform.OS === "android") {
    await RNIap.flushFailedPurchasesCachedAsPendingAndroid();
  }
};

export const endIapConnection = async () => {
  await RNIap.endConnection();
};

export const loadSubscriptions = async (): Promise<RNIap.Subscription[]> => {
  const skus = getSubscriptionSkus();
  if (skus.length === 0) {
    throw new Error("IAP subscription ID is not configured");
  }
  return RNIap.getSubscriptions({ skus });
};

export const loadSubscriptionsBySkus = async (
  skus: string[]
): Promise<RNIap.Subscription[]> => {
  const normalized = uniqueSkus(skus);
  if (normalized.length === 0) {
    return [];
  }
  return RNIap.getSubscriptions({ skus: normalized });
};

export const loadProductsBySkus = async (
  skus: string[]
): Promise<RNIap.Product[]> => {
  const normalized = uniqueSkus(skus);
  if (normalized.length === 0) {
    return [];
  }
  return RNIap.getProducts({ skus: normalized });
};

export const requestSubscriptionPurchase = async (
  subscription: RNIap.Subscription
) => {
  if (
    Platform.OS === "android" &&
    subscription.platform === RNIap.SubscriptionPlatform.android
  ) {
    const offerToken = subscription.subscriptionOfferDetails?.[0]?.offerToken ?? null;
    if (offerToken) {
      return RNIap.requestSubscription({
        sku: subscription.productId,
        subscriptionOffers: [{ sku: subscription.productId, offerToken }],
      });
    }
  }
  return RNIap.requestSubscription({ sku: subscription.productId });
};

type RequestTariffPurchasePayload = {
  purchaseType: TariffPurchaseType;
  productId: string;
  subscription?: RNIap.Subscription | null;
};

export const requestTariffPurchase = async ({
  purchaseType,
  productId,
  subscription,
}: RequestTariffPurchasePayload) => {
  const normalizedProductId = String(productId || "").trim();
  if (!normalizedProductId) {
    throw new Error("Store product ID is missing");
  }

  if (purchaseType === "one_time") {
    if (Platform.OS === "android") {
      return RNIap.requestPurchase({ skus: [normalizedProductId] });
    }
    return RNIap.requestPurchase({ sku: normalizedProductId });
  }

  const knownSubscription =
    subscription && subscription.productId === normalizedProductId
      ? subscription
      : null;
  if (
    Platform.OS === "android" &&
    knownSubscription?.platform === RNIap.SubscriptionPlatform.android
  ) {
    const offerToken =
      knownSubscription.subscriptionOfferDetails?.[0]?.offerToken ?? null;
    if (offerToken) {
      return RNIap.requestSubscription({
        sku: normalizedProductId,
        subscriptionOffers: [{ sku: normalizedProductId, offerToken }],
      });
    }
  }

  return RNIap.requestSubscription({ sku: normalizedProductId });
};

type VerifyPurchaseOptions = {
  isSubscription?: boolean;
  productId?: string;
};

export const verifyPurchaseWithBackend = async (
  purchase: RNIap.Purchase,
  options?: VerifyPurchaseOptions
) => {
  if (!API_BASE_URL) {
    throw new Error("API_BASE_URL not configured");
  }
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("User not authenticated");
  }

  const baseUrl = API_BASE_URL.replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${token}` };
  const resolvedProductId = options?.productId ?? purchase.productId;

  if (Platform.OS === "ios") {
    if (!purchase.transactionReceipt) {
      throw new Error("Missing iOS receipt");
    }
    const { data } = await axios.post(
      `${baseUrl}/iap/apple/verify`,
      {
        receipt_data: purchase.transactionReceipt,
        product_id: resolvedProductId,
      },
      { headers }
    );
    return data;
  }

  if (!purchase.purchaseToken) {
    throw new Error("Missing Google purchase token");
  }
  const { data } = await axios.post(
    `${baseUrl}/iap/google/verify`,
    {
      product_id: resolvedProductId,
      purchase_token: purchase.purchaseToken,
      is_subscription: options?.isSubscription ?? true,
    },
    { headers }
  );
  return data;
};

export const extractSubscriptionPrice = (
  subscription: RNIap.Subscription | null
): string => {
  if (!subscription) return "";
  if (subscription.platform === RNIap.SubscriptionPlatform.ios) {
    return subscription.localizedPrice ?? "";
  }
  if (subscription.platform !== RNIap.SubscriptionPlatform.android) {
    return subscription.price ?? "";
  }
  const offer = subscription.subscriptionOfferDetails?.[0];
  const phase = offer?.pricingPhases?.pricingPhaseList?.[0];
  return phase?.formattedPrice ?? "";
};
