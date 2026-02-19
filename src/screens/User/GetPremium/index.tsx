import React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  View,
} from "react-native";
// ----------------------------- UI kitten -----------------------------------
import {
  Icon,
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Button,
} from "@ui-kitten/components";
import * as RNIap from "react-native-iap";
import axios from "axios";
// ----------------------------- Hooks ---------------------------------------
import { useLayout } from "hooks";
// ----------------------------- Assets ---------------------------------------
import { Images } from "assets/images";
// ----------------------------- Components && Elements -----------------------
import {
  Container,
  Content,
  LayoutCustom,
  LinearGradientText,
  NavigationAction,
  Text,
} from "components";
import OptionButton from "./OptionButton";
import SuccessPay from "./SuccessPay";
import { useTranslation } from "i18n/useTranslation";
import {
  endIapConnection,
  extractSubscriptionPrice,
  initIapConnection,
  loadProductsBySkus,
  loadSubscriptionsBySkus,
  requestTariffPurchase,
  verifyPurchaseWithBackend,
} from "services/iapService";
import { useDispatch } from "react-redux";
import { syncUserData } from "services/userData";
import {
  fetchMySubscriptionProfile,
  fetchTariffs,
  getTariffProductId,
  startTariffTrial,
  SubscriptionAccessProfile,
  TariffPlan,
} from "services/tariffService";

const GetPremium = React.memo(() => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const { height, width, bottom } = useLayout();
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const [visible, setVisible] = React.useState(false);
  const [bootLoading, setBootLoading] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [tariffs, setTariffs] = React.useState<TariffPlan[]>([]);
  const [selectedTariffId, setSelectedTariffId] = React.useState<string | null>(null);
  const [subscriptionsBySku, setSubscriptionsBySku] = React.useState<
    Record<string, RNIap.Subscription>
  >({});
  const [productsBySku, setProductsBySku] = React.useState<Record<string, RNIap.Product>>({});
  const [profile, setProfile] = React.useState<SubscriptionAccessProfile | null>(null);
  const [iapReady, setIapReady] = React.useState(false);
  const pendingVerifyRef = React.useRef<{
    isSubscription: boolean;
    productId: string;
  } | null>(null);

  const closeModal = () => {
    setVisible(false);
  };

  const size = { width: width, height: 210 * (height / 812) };
  const options = [
    {
      title: t("Voice AI"),
      describe: t("Quickly Create Transaction"),
      icon: "headphone",
    },
    {
      title: t("Export data"),
      describe: t("Download your data"),
      icon: "download",
    },
    {
      title: t("Unlimited wallets"),
      describe: t("Unlimited wallet creation manage"),
      icon: "wallet_open",
    },
  ];

  const selectedTariff = React.useMemo(
    () => tariffs.find((item) => item.id === selectedTariffId) ?? null,
    [tariffs, selectedTariffId]
  );

  const resolveAccent = React.useCallback((tariff: TariffPlan | null) => {
    const raw = tariff?.nighth_style?.accent;
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw;
    }
    return "#6C63FF";
  }, []);

  const resolveSurface = React.useCallback((tariff: TariffPlan | null) => {
    const raw = tariff?.nighth_style?.surface;
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw;
    }
    return theme["background-basic-color-3"];
  }, [theme]);

  const fallbackPrice = React.useCallback((tariff: TariffPlan) => {
    if (tariff.price_label && tariff.price_label.trim().length > 0) {
      return tariff.price_label;
    }
    const amount = Number(tariff.price_amount || 0);
    return `${tariff.currency} ${amount.toFixed(2)}`;
  }, []);

  const getStorePriceLabel = React.useCallback(
    (tariff: TariffPlan) => {
      const productId = getTariffProductId(tariff);
      if (!productId) {
        return fallbackPrice(tariff);
      }
      if (tariff.purchase_type === "subscription") {
        const subscription = subscriptionsBySku[productId] ?? null;
        const dynamicPrice = extractSubscriptionPrice(subscription);
        return dynamicPrice || fallbackPrice(tariff);
      }
      const product = productsBySku[productId];
      const dynamicPrice =
        product?.localizedPrice ||
        product?.displayPrice ||
        product?.oneTimePurchaseOfferDetails?.formattedPrice ||
        product?.price ||
        "";
      return dynamicPrice || fallbackPrice(tariff);
    },
    [fallbackPrice, productsBySku, subscriptionsBySku]
  );

  const trialAvailable = React.useMemo(() => {
    if (!selectedTariff || selectedTariff.trial_days <= 0) return false;
    if (profile?.is_premium) return false;
    if (profile?.trial_status === "active") return false;
    if (profile?.trial_consumed === true) return false;
    return true;
  }, [selectedTariff, profile]);

  const trialInfoText = React.useMemo(() => {
    if (profile?.trial_status === "active" && profile.trial_ends_at) {
      const endDate = new Date(profile.trial_ends_at);
      if (!Number.isNaN(endDate.getTime())) {
        return `Trial active until ${endDate.toLocaleDateString()}`;
      }
    }
    if (profile?.trial_status === "expired") {
      return "Trial expired. Choose a paid tariff to continue premium access.";
    }
    return "";
  }, [profile]);

  const canSubmit = React.useMemo(() => {
    if (!selectedTariff) return false;
    if (trialAvailable) return true;
    return Boolean(getTariffProductId(selectedTariff));
  }, [selectedTariff, trialAvailable]);

  const ctaTitle = React.useMemo(() => {
    if (!selectedTariff) return t("Premium Account");
    if (selectedTariff.cta_title) return selectedTariff.cta_title;
    if (trialAvailable) {
      return `Start your free ${selectedTariff.trial_days} day trial`;
    }
    return selectedTariff.description || t("Upgrade your premium account");
  }, [selectedTariff, t, trialAvailable]);

  const ctaSubtitle = React.useMemo(() => {
    if (!selectedTariff) return "";
    if (selectedTariff.cta_subtitle) return selectedTariff.cta_subtitle;
    if (selectedTariff.purchase_type === "subscription") {
      return "Cancel anytime.";
    }
    return "";
  }, [selectedTariff]);

  const buttonTitle = React.useMemo(() => {
    if (!selectedTariff) return t("Upgrade");
    if (selectedTariff.cta_button_text) return selectedTariff.cta_button_text;
    if (trialAvailable) return "TRY FREE";
    if (selectedTariff.purchase_type === "one_time") return "UNLOCK";
    return t("Upgrade");
  }, [selectedTariff, t, trialAvailable]);

  const refreshProfile = React.useCallback(async () => {
    try {
      const me = await fetchMySubscriptionProfile();
      setProfile(me);
    } catch {
      // keep screen usable even if /me is temporarily unavailable
    }
  }, []);

  const bootstrap = React.useCallback(async () => {
    setBootLoading(true);
    try {
      await initIapConnection();
      setIapReady(true);
      const [apiTariffs, me] = await Promise.all([
        fetchTariffs(),
        fetchMySubscriptionProfile().catch(() => null),
      ]);
      if (me) {
        setProfile(me);
      }
      setTariffs(apiTariffs);
      const initialSelection =
        apiTariffs.find((item) => item.is_featured) ?? apiTariffs[0] ?? null;
      setSelectedTariffId(initialSelection?.id ?? null);

      const subscriptionSkus = apiTariffs
        .filter((item) => item.purchase_type === "subscription")
        .map((item) => getTariffProductId(item))
        .filter((value): value is string => Boolean(value));
      const productSkus = apiTariffs
        .filter((item) => item.purchase_type === "one_time")
        .map((item) => getTariffProductId(item))
        .filter((value): value is string => Boolean(value));

      const [subscriptions, products] = await Promise.all([
        loadSubscriptionsBySkus(subscriptionSkus),
        loadProductsBySkus(productSkus),
      ]);
      setSubscriptionsBySku(
        Object.fromEntries(subscriptions.map((item) => [item.productId, item]))
      );
      setProductsBySku(Object.fromEntries(products.map((item) => [item.productId, item])));
    } catch (err: unknown) {
      if (__DEV__) {
        console.warn("GetPremium bootstrap failed", err);
      }
      Alert.alert(t("Please try again."));
    } finally {
      setBootLoading(false);
    }
  }, [t]);

  const onPurchaseTariff = React.useCallback(
    async (tariff: TariffPlan) => {
      const productId = getTariffProductId(tariff);
      if (!productId) {
        Alert.alert(
          t("Please try again."),
          "Store product ID is not configured for this tariff."
        );
        return;
      }
      const isSubscription = tariff.purchase_type === "subscription";
      const knownSubscription = subscriptionsBySku[productId] ?? null;
      pendingVerifyRef.current = { isSubscription, productId };
      try {
        setLoading(true);
        await requestTariffPurchase({
          purchaseType: tariff.purchase_type,
          productId,
          subscription: knownSubscription,
        });
      } catch (err: unknown) {
        pendingVerifyRef.current = null;
        const message =
          err instanceof Error ? err.message : t("Please try again.");
        Alert.alert(t("Please try again."), message);
        setLoading(false);
      }
    },
    [subscriptionsBySku, t]
  );

  const onSubmit = React.useCallback(async () => {
    if (!selectedTariff) {
      Alert.alert(t("Please try again."));
      return;
    }

    if (trialAvailable) {
      try {
        setLoading(true);
        await startTariffTrial(selectedTariff.id);
        await syncUserData(dispatch);
        await refreshProfile();
        Alert.alert("Trial activated", `${selectedTariff.trial_days} days free activated.`);
        setLoading(false);
        return;
      } catch (err: unknown) {
        const statusCode =
          axios.isAxiosError(err) && typeof err.response?.status === "number"
            ? err.response.status
            : null;
        if (statusCode !== 409) {
          const detail =
            axios.isAxiosError(err) && typeof err.response?.data?.detail === "string"
              ? err.response.data.detail
              : err instanceof Error
              ? err.message
              : t("Please try again.");
          Alert.alert(t("Please try again."), detail);
          setLoading(false);
          return;
        }
        // Trial already consumed/active: continue to paid purchase.
      }
    }

    await onPurchaseTariff(selectedTariff);
  }, [dispatch, onPurchaseTariff, refreshProfile, selectedTariff, t, trialAvailable]);

  React.useEffect(() => {
    let isMounted = true;
    const purchaseUpdate = RNIap.purchaseUpdatedListener(async (purchase) => {
      try {
        setLoading(true);
        await verifyPurchaseWithBackend(purchase, pendingVerifyRef.current ?? undefined);
        pendingVerifyRef.current = null;
        await RNIap.finishTransaction({ purchase, isConsumable: false });
        await syncUserData(dispatch);
        await refreshProfile();
        if (!isMounted) return;
        setVisible(true);
      } catch (err: any) {
        Alert.alert(t("Please try again."), err?.message ?? t("Please try again."));
      } finally {
        setLoading(false);
      }
    });
    const purchaseError = RNIap.purchaseErrorListener((error) => {
      pendingVerifyRef.current = null;
      setLoading(false);
      if (__DEV__) {
        console.warn("IAP error", error);
      }
      Alert.alert(t("Please try again."), error?.message ?? t("Please try again."));
    });

    bootstrap();

    return () => {
      isMounted = false;
      pendingVerifyRef.current = null;
      purchaseUpdate.remove();
      purchaseError.remove();
      endIapConnection().catch(() => undefined);
    };
  }, [bootstrap, dispatch, refreshProfile, t]);

  const accentColor = resolveAccent(selectedTariff);

  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={() => <NavigationAction />}
        title={t("Get Premium")}
        alignment="center"
      />
      <Content contentContainerStyle={styles.content}>
        <LayoutCustom itemsCenter>
          <Image source={Images.cash_wallet} style={size} />
          <LinearGradientText
            text={selectedTariff ? getStorePriceLabel(selectedTariff) : "$0.00"}
            category="h3"
          />
        </LayoutCustom>

        <LayoutCustom style={styles.heroCard} mt={16}>
          <Text category="h3">{ctaTitle}</Text>
          {ctaSubtitle ? (
            <Text status="note" marginTop={8}>
              {ctaSubtitle}
            </Text>
          ) : null}
          {trialInfoText ? (
            <Text status="warning" marginTop={8}>
              {trialInfoText}
            </Text>
          ) : null}
          <LayoutCustom horizontal wrap gap={8} mt={12}>
            {selectedTariff?.trial_days ? (
              <LayoutCustom style={[styles.badgePill, { borderColor: accentColor }]}>
                <Text category="c1">
                  {selectedTariff.badge_text || `${selectedTariff.trial_days} days free`}
                </Text>
              </LayoutCustom>
            ) : null}
            {selectedTariff?.discount_percent ? (
              <LayoutCustom style={[styles.badgePill, { borderColor: accentColor }]}>
                <Text category="c1">
                  {selectedTariff.discount_label ||
                    `SAVE ${selectedTariff.discount_percent}%`}
                </Text>
              </LayoutCustom>
            ) : null}
          </LayoutCustom>
        </LayoutCustom>

        {bootLoading ? (
          <LayoutCustom style={styles.loaderBlock} itemsCenter justify="center">
            <ActivityIndicator size="large" color={accentColor} />
          </LayoutCustom>
        ) : null}

        {!bootLoading && tariffs.length > 0 ? (
          <View style={styles.cardsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardsContent}
            >
              {tariffs.map((item) => {
                const selected = item.id === selectedTariffId;
                const itemAccent = resolveAccent(item);
                const surface = resolveSurface(item);
                const priceLabel = getStorePriceLabel(item);
                return (
                  <LayoutCustom
                    key={item.id}
                    style={[
                      styles.tariffCard,
                      { backgroundColor: surface },
                      selected && [styles.tariffCardSelected, { borderColor: itemAccent }],
                    ]}
                    onPress={() => setSelectedTariffId(item.id)}
                  >
                    {item.discount_percent > 0 ? (
                      <LayoutCustom
                        style={[styles.discountBadge, { backgroundColor: itemAccent }]}
                      >
                        <Text category="c1" style={styles.discountText}>
                          {item.discount_label || `SAVE ${item.discount_percent}%`}
                        </Text>
                      </LayoutCustom>
                    ) : null}
                    <Text category="subhead" status="note">
                      {item.title}
                    </Text>
                    <Text category="h3" marginTop={6}>
                      {priceLabel}
                    </Text>
                    {item.price_sub_label ? (
                      <Text status="note" marginTop={6}>
                        {item.price_sub_label}
                      </Text>
                    ) : null}
                    {item.trial_days > 0 ? (
                      <Text category="c1" marginTop={8}>
                        {item.badge_text || `${item.trial_days} days free`}
                      </Text>
                    ) : null}
                    {item.description ? (
                      <Text category="c1" status="note" marginTop={8}>
                        {item.description}
                      </Text>
                    ) : null}
                  </LayoutCustom>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {!bootLoading && tariffs.length === 0 ? (
          <LayoutCustom style={styles.emptyState} itemsCenter>
            <Icon
              pack="assets"
              name="crown"
              style={{ width: 28, height: 28, tintColor: accentColor }}
            />
            <Text category="h4" marginTop={10}>
              No tariffs available
            </Text>
            <Text status="note" center marginTop={8}>
              Please configure tariffs from admin panel.
            </Text>
          </LayoutCustom>
        ) : null}

        <LayoutCustom style={styles.contentPremium} mt={24}>
          <Text category="h3" marginBottom={12}>
            {t("Premium Account")}
          </Text>
          <Text status="note" marginBottom={24}>
            {t(
              "Upgrade your premium account to unlock all the special functions of the app."
            )}
          </Text>
          <LayoutCustom gap={24}>
            {options.map((item, index) => {
              return <OptionButton data={item} key={index} />;
            })}
          </LayoutCustom>
        </LayoutCustom>
        <LayoutCustom style={styles.bottomContent} />
      </Content>
      <LayoutCustom level="2" ph={16} pv={4} pb={bottom+4}>
        <Button
          children={buttonTitle}
          onPress={onSubmit}
          disabled={bootLoading || !iapReady || loading || !canSubmit}
        />
      </LayoutCustom>
      <Modal
        style={styles.modal}
        animationType="slide"
        transparent={true}
        visible={visible}
      >
        <Container>
        <SuccessPay onClose={closeModal} />
        </Container>
      </Modal>
    </Container>
  );
});

export default GetPremium;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingBottom: 0,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "background-basic-color-2",
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  badgePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  loaderBlock: {
    minHeight: 180,
  },
  cardsContainer: {
    marginTop: 12,
  },
  cardsContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  tariffCard: {
    width: 170,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tariffCardSelected: {
    borderWidth: 2,
    transform: [{ translateY: -4 }],
  },
  discountBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  discountText: {
    color: "white",
    fontWeight: "700",
  },
  emptyState: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: "background-basic-color-2",
  },
  contentPremium: {
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 24,
    backgroundColor: "background-basic-color-2",
  },
  bottomContent: {
    height: "30%",
    width: "100%",
    position: "absolute",
    backgroundColor: "background-basic-color-2",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: -100,
  },
  modal: {
    width: "100%",
    height: "100%",
  },
});
