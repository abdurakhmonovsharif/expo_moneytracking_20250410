import React from "react";
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
// ----------------------------- UI kitten -----------------------------------
import { StyleService, useStyleSheet, Icon, Button } from "@ui-kitten/components";
// ----------------------------- Navigation -----------------------------------
import { NavigationProp, useFocusEffect, useNavigation } from "@react-navigation/native";
// ----------------------------- Assets ---------------------------------------
// ----------------------------- Components && Elements -----------------------
import _ from "lodash";
import dayjs from "dayjs";
import {
  AdInterstitial,
  Container,
  Content,
  LayoutCustom,
  LinearGradientText,
  Text,
} from "components";
import EmptyWallet from "./EmptyWallet";
import { RootStackParamList } from "types/navigation-types";
import { useAppDispatch, useAppSelector } from "reduxs/store";
import { addTransaction, appSelector } from "reduxs/reducers/app-reducer";
import WalletSelect from "./WalletSelect";
import BalanceField from "./BalanceField";
import LatestTransaction from "./LatestTransaction";
import SelectDate from "./SelectDate";
import { BudgetEnumType, IWalletProps, TransactionEnumType } from "types/redux-types";
import { Modalize, useModalize } from "react-native-modalize";
import { Portal } from "react-native-portalize";
import WalletSelectItem from "./WalletSelectItem";
import VoiceAssistant from "./VoiceAssistant";
import CurrencyRatesCard from "./CurrencyRatesCard";
import { commitVoiceTransaction, analyzeVoiceText, VoiceAnalysis } from "services/voiceAiService";
import { expenseCategories, incomeCategories } from "screens/User/NewTransaction/data";
import { Audio } from "expo-av";
import { transcribeVoice } from "services/voiceSttService";
import { useTranslation } from "i18n/useTranslation";
import { useCurrencyConversion } from "hooks";
import {
  getWalletNetBalance,
  getPermissionBoolean,
  getPermissionNumber,
  getWalletsNetBalance,
} from "utils";
import { fetchAdsConfig, AdsConfig } from "services/adsService";
import {
  createOverspendingNotification,
  getMyNotificationUnreadCount,
} from "services/notificationsService";

const HomeScreen = React.memo(() => {
  const styles = useStyleSheet(themedStyles);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const dispatch = useAppDispatch();
  const { t, locale, language } = useTranslation();
  const permissions = useAppSelector(appSelector).permissions;
  const permissionsPlan = useAppSelector(appSelector).permissionsPlan;
  const user = useAppSelector(appSelector).user;
  const budget = useAppSelector(appSelector).budget;
  const isPremium =
    permissionsPlan === "premium" || user?.plan === "premium" || user?.is_premium === true;
  const canUseVoice = isPremium && getPermissionBoolean(permissions, "voice_ai", true);
  const canCreateWallet = getPermissionBoolean(permissions, "wallet_create", true);
  const canUnlimitedWallets = getPermissionBoolean(permissions, "wallet_unlimited", false);
  const walletLimit = getPermissionNumber(permissions, "wallet_limit", 5);
  const canShowAds = Platform.OS === "ios" && !isPremium && Boolean(user);

  const _onNewWallet = () => {
    if (
      !canCreateWallet ||
      (!canUnlimitedWallets && walletLimit > 0 && data.length >= walletLimit)
    ) {
      Alert.alert(
        t("Get Premium"),
        t("Upgrade your premium account to unlock all the special functions of the app."),
        [
          { text: t("Cancel"), style: "cancel" },
          { text: t("Upgrade"), onPress: () => navigate("GetPremium") },
        ]
      );
      return;
    }
    navigate("NewWallet");
  };
  const { ref: modalizeRef, open, close } = useModalize();

  const data = useAppSelector(appSelector).wallets;
  const currency = useAppSelector(appSelector).currency;
  const { convert } = useCurrencyConversion();
  const sumBalance = React.useMemo(() => getWalletsNetBalance(data, convert), [data, convert]);
  const [voiceText, setVoiceText] = React.useState("");
  const [savingVoice, setSavingVoice] = React.useState(false);
  const [analyzingVoice, setAnalyzingVoice] = React.useState(false);
  const [voiceAnalysis, setVoiceAnalysis] = React.useState<VoiceAnalysis | null>(null);
  const [analysisTypeHint, setAnalysisTypeHint] = React.useState<"income" | "expense" | null>(null);
  const [recording, setRecording] = React.useState(false);
  const [transcribing, setTranscribing] = React.useState(false);
  const [metering, setMetering] = React.useState(0);
  const recordingRef = React.useRef<Audio.Recording | null>(null);
  const [selectedWalletId, setSelectedWalletId] = React.useState<string>("AllWallet");
  const [adConfig, setAdConfig] = React.useState<AdsConfig | null>(null);
  const [adVisible, setAdVisible] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const adTriggeredRef = React.useRef(false);
  const overspendingTriggerDayRef = React.useRef<string | null>(null);
  const overspendingPendingRef = React.useRef(false);

  const allWallet = React.useMemo<IWalletProps>(
    () => ({
      title: "All Wallet",
      balance: sumBalance,
      id: "AllWallet",
      symbol: "",
    }),
    [sumBalance]
  );

  const selectedWallet = React.useMemo<IWalletProps>(() => {
    if (selectedWalletId === "AllWallet") {
      return allWallet;
    }
    const wallet = data.find((item) => String(item.id) === selectedWalletId);
    return wallet ?? allWallet;
  }, [allWallet, data, selectedWalletId]);

  React.useEffect(() => {
    if (selectedWalletId !== "AllWallet") {
      const exists = data.some((item) => String(item.id) === selectedWalletId);
      if (!exists) {
        setSelectedWalletId("AllWallet");
      }
    }
  }, [data, selectedWalletId]);

  const refreshUnreadCount = React.useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const nextCount = await getMyNotificationUnreadCount();
      setUnreadCount(nextCount);
    } catch {
      // keep UI responsive when notifications endpoint is unavailable
    }
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      refreshUnreadCount().catch(() => {});
      return () => {};
    }, [refreshUnreadCount])
  );

  const toDate = React.useCallback((value: any): Date => {
    if (!value) return new Date(0);
    if (value instanceof Date) return value;
    if (typeof value === "string") return new Date(value);
    if (typeof value === "object" && typeof value.toDate === "function") {
      return value.toDate();
    }
    return new Date(value);
  }, []);

  const monthlyBudgetLimit = React.useMemo(() => {
    if (!budget?.budgets?.length) {
      return 0;
    }
    const rawTotal = budget.budgets.reduce((sum, item) => {
      return sum + Number(item.amount ?? 0);
    }, 0);
    if (!Number.isFinite(rawTotal) || rawTotal <= 0) {
      return 0;
    }
    switch (budget.type) {
      case BudgetEnumType.YEARLY:
        return rawTotal / 12;
      case BudgetEnumType.WEEKLY:
        return rawTotal * 4.345;
      case BudgetEnumType.MONTHLY:
      default:
        return rawTotal;
    }
  }, [budget]);

  const monthExpense = React.useMemo(() => {
    const currentMonth = dayjs();
    return data.reduce((total, wallet) => {
      const walletExpenses = (wallet.transaction ?? []).reduce((sum, tx) => {
        if (tx.type !== TransactionEnumType.EXPENSESE) {
          return sum;
        }
        const txDate = dayjs(toDate(tx.date));
        if (!txDate.isValid() || !txDate.isSame(currentMonth, "month")) {
          return sum;
        }
        return sum + convert(Number(tx.balance ?? 0), tx.currency);
      }, 0);
      return total + walletExpenses;
    }, 0);
  }, [convert, data, toDate]);

  React.useEffect(() => {
    if (!user || monthlyBudgetLimit <= 0) {
      return;
    }
    const now = dayjs();
    const elapsedRatio = Math.min(1, Math.max(0, now.date() / now.daysInMonth()));
    const expectedSpent = monthlyBudgetLimit * elapsedRatio;
    if (expectedSpent <= 0) {
      return;
    }
    const threshold = expectedSpent * 1.05;
    if (monthExpense <= threshold) {
      return;
    }
    const dayKey = now.format("YYYY-MM-DD");
    if (overspendingTriggerDayRef.current === dayKey) {
      return;
    }
    if (overspendingPendingRef.current) {
      return;
    }
    overspendingPendingRef.current = true;

    createOverspendingNotification({
      periodKey: dayKey,
      actualSpent: Number(monthExpense.toFixed(2)),
      expectedSpent: Number(expectedSpent.toFixed(2)),
      currency: currency?.toString?.() ?? "USD",
      language,
    })
      .then(() => {
        overspendingTriggerDayRef.current = dayKey;
        refreshUnreadCount().catch(() => {});
      })
      .catch(() => {})
      .finally(() => {
        overspendingPendingRef.current = false;
      });
  }, [currency, language, monthExpense, monthlyBudgetLimit, refreshUnreadCount, user]);

  React.useEffect(() => {
    if (!canShowAds) {
      return;
    }
    fetchAdsConfig("ios")
      .then((response) => {
        if (response?.config) {
          setAdConfig(response.config);
        }
      })
      .catch(() => {});
  }, [canShowAds]);

  React.useEffect(() => {
    if (!canShowAds || !adConfig?.enabled) {
      return;
    }
    const showOn = adConfig.show_on ?? [];
    const shouldShow =
      showOn.includes("home") || showOn.includes("app_open") || showOn.includes("app-open");
    if (!shouldShow || adTriggeredRef.current) {
      return;
    }
    adTriggeredRef.current = true;
    const minIntervalSec = Math.max(0, Number(adConfig.min_interval_sec ?? 0));
    const storageKey = "ads:last_shown:ios";
    AsyncStorage.getItem(storageKey)
      .then((value) => {
        const lastShown = value ? Number(value) : 0;
        const now = Date.now();
        if (!lastShown || now - lastShown >= minIntervalSec * 1000) {
          setAdVisible(true);
        }
      })
      .catch(() => {});
  }, [adConfig, canShowAds]);

  const recordingOptions: Audio.RecordingOptions = React.useMemo(
    () => ({
      android: {
        extension: ".m4a",
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 128000,
        isMeteringEnabled: true,
      },
      ios: {
        extension: ".wav",
        audioQuality: Audio.IOSAudioQuality.HIGH,
        outputFormat: Audio.IOSOutputFormat.LINEARPCM,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
        isMeteringEnabled: true,
      },
      web: {
        mimeType: "audio/wav",
        bitsPerSecond: 128000,
      },
    }),
    []
  );

  const startRecording = async () => {
    if (recording) return;
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t("Permission needed"), t("Microphone permission is required."));
        return;
      }
      setVoiceAnalysis(null);
      setAnalysisTypeHint(null);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const nextRecording = new Audio.Recording();
      nextRecording.setOnRecordingStatusUpdate((status: any) => {
        if (typeof status?.metering === "number") {
          const normalized = Math.max(
            0,
            Math.min(1, (status.metering + 160) / 160)
          );
          setMetering(normalized);
        }
      });
      nextRecording.setProgressUpdateInterval(150);
      await nextRecording.prepareToRecordAsync(recordingOptions);
      await nextRecording.startAsync();
      recordingRef.current = nextRecording;
      setRecording(true);
    } catch (err: any) {
      Alert.alert(t("Recording failed"), err?.message ?? t("Please try again."));
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setMetering(0);
      if (!uri) {
        Alert.alert(t("No audio"), t("Unable to read recorded audio."));
        return;
      }
      setTranscribing(true);
      const result = await transcribeVoice(uri);
      if (result.text) {
        setVoiceText(result.text);
        setVoiceAnalysis(null);
      } else {
        Alert.alert(t("No speech detected"), t("Please try again."));
      }
    } catch (err: any) {
      Alert.alert(t("Transcription failed"), err?.message ?? t("Please try again."));
    } finally {
      setRecording(false);
      setTranscribing(false);
    }
  };

  const expenseCategoryList = React.useMemo(() => {
    const list: Array<any> = [];
    expenseCategories.forEach((category) => {
      list.push(category);
      if (category.children) {
        list.push(...category.children);
      }
    });
    return list;
  }, []);

  const incomeCategoryNames = React.useMemo(
    () => incomeCategories.map((category) => category.name),
    []
  );
  const expenseCategoryNames = React.useMemo(
    () => expenseCategoryList.map((category) => category.name),
    [expenseCategoryList]
  );

  const normalizeName = (value?: string | null) =>
    (value ?? "").toString().trim().toLowerCase();

  const resolveCategory = (
    type: "income" | "expense",
    name?: string | null
  ) => {
    const list = type === "income" ? incomeCategories : expenseCategoryList;
    if (!list.length) return undefined;
    if (!name) return list[0];
    const needle = normalizeName(name);
    const exact = list.find((item) => normalizeName(item.name) === needle);
    if (exact) return exact;
    const partial = list.find((item) =>
      normalizeName(item.name).includes(needle)
    );
    return partial ?? list[0];
  };

  const getTargetWallet = () => {
    if (!data || data.length === 0) {
      return null;
    }
    if (selectedWalletId === "AllWallet") {
      return data[0];
    }
    const wallet = data.find((item) => String(item.id) === selectedWalletId);
    return wallet ?? data[0];
  };

  const handleAnalyzeVoice = async (type: "income" | "expense") => {
    if (analyzingVoice || transcribing || recording) return;
    if (!voiceText.trim()) {
      Alert.alert(t("Missing fields"), t("Please try again."));
      return;
    }
    setAnalyzingVoice(true);
    setAnalysisTypeHint(type);
    try {
      const analysis = await analyzeVoiceText({
        text: voiceText,
        typeHint: type,
        categories: type === "income" ? incomeCategoryNames : expenseCategoryNames,
        locale,
        currency,
      });
      setVoiceAnalysis(analysis);
    } catch (err: any) {
      Alert.alert(t("Unexpected error, try again."), err?.message ?? t("Please try again."));
    } finally {
      setAnalyzingVoice(false);
    }
  };

  const handleVoiceTextChange = (text: string) => {
    setVoiceText(text);
    if (voiceAnalysis) {
      setVoiceAnalysis(null);
      setAnalysisTypeHint(null);
    }
  };

  const handleApproveVoice = async () => {
    if (savingVoice || !voiceAnalysis) return;
    const amount = Number(voiceAnalysis.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert(t("Missing amount"), t("Say an amount like: income 120 or expense 15."));
      return;
    }
    const wallet = getTargetWallet();
    if (!wallet) {
      Alert.alert(t("No wallet"), t("Create a wallet first."));
      return;
    }
    const walletIndex = data.findIndex((item) => item.id === wallet.id);
    if (walletIndex < 0) {
      Alert.alert(t("Wallet not found"), t("Please select a wallet."));
      return;
    }

    const detectedType =
      voiceAnalysis.type === "income" || voiceAnalysis.type === "expense"
        ? voiceAnalysis.type
        : analysisTypeHint ?? "expense";
    const category = resolveCategory(detectedType, voiceAnalysis.category);
    if (!category) {
      Alert.alert(t("Category"), t("Please try again."));
      return;
    }

    const transactionType =
      detectedType === "income"
        ? TransactionEnumType.INCOME
        : TransactionEnumType.EXPENSESE;
    const transactionCurrency =
      (voiceAnalysis.currency ?? currency)?.toString().toUpperCase();
    if (transactionType === TransactionEnumType.EXPENSESE) {
      const requestedAmount = convert(amount, transactionCurrency);
      const availableBalance = Math.max(0, getWalletNetBalance(wallet, convert));
      if (!Number.isFinite(requestedAmount) || requestedAmount > availableBalance + 1e-9) {
        Alert.alert(t("Invalid amount"), t("Expense amount exceeds wallet balance."));
        return;
      }
    }

    setSavingVoice(true);
    try {
      const transaction = await commitVoiceTransaction({
        walletId: String(wallet.id),
        category,
        balance: amount,
        type: transactionType,
        currency: transactionCurrency,
        note: voiceText
          ? { textNote: voiceAnalysis.description ?? voiceText }
          : undefined,
      });
      dispatch(
        addTransaction({
          walletIndex,
          transaction,
        })
      );
      setVoiceText("");
      setVoiceAnalysis(null);
      setAnalysisTypeHint(null);
    } catch (err: any) {
      Alert.alert(t("Add failed"), err?.message ?? t("Please try again."));
    } finally {
      setSavingVoice(false);
    }
  };

  const handleCancelVoice = () => {
    setVoiceAnalysis(null);
    setAnalysisTypeHint(null);
  };

  const handleCloseAd = React.useCallback(() => {
    setAdVisible(false);
    AsyncStorage.setItem("ads:last_shown:ios", String(Date.now())).catch(() => {});
  }, []);

  const openNotifications = React.useCallback(() => {
    navigate("Notifications");
  }, [navigate]);

  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <Container style={styles.container}>
      <Content contentContainerStyle={styles.content}>
        <LayoutCustom horizontal justify="space-between" itemsCenter mh={16}>
          {selectedWallet && (
            <WalletSelect
              wallet={selectedWallet}
              onOpen={open}
              onClose={close}
            />
          )}
          <LayoutCustom horizontal itemsCenter gap={12}>
            <SelectDate />
            <LayoutCustom
              style={styles.notificationButton}
              onPress={openNotifications}
            >
              <Icon pack="assets" name={"bell-simple"} style={styles.notificationIcon} />
              {unreadCount > 0 && (
                <LayoutCustom style={styles.notificationBadge}>
                  <Text category="c2" status="white" style={styles.notificationBadgeText}>
                    {badgeText}
                  </Text>
                </LayoutCustom>
              )}
            </LayoutCustom>
          </LayoutCustom>
        </LayoutCustom>
        <>
          {_.isEmpty(data) ? (
            <LayoutCustom justify="space-between">
              <EmptyWallet />
              <LayoutCustom style={styles.cardNewWallet} onPress={_onNewWallet}>
                <Icon pack="assets" name={"wallet"} style={styles.wallet} />
                <Text category="h4">Create new wallet</Text>
              </LayoutCustom>
            </LayoutCustom>
          ) : (
            <LayoutCustom mh={16} gap={24}>
              <BalanceField
                data={
                  selectedWalletId === "AllWallet"
                    ? data
                    : data.filter((item) => String(item.id) === selectedWalletId)
                }
              />
              {canUseVoice ? (
                <VoiceAssistant
                  value={voiceText}
                  onChange={handleVoiceTextChange}
                  loading={savingVoice}
                  analyzing={analyzingVoice}
                  recording={recording}
                  transcribing={transcribing}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  metering={metering}
                  analysis={voiceAnalysis}
                  analysisTypeHint={analysisTypeHint}
                  onAddIncome={() => handleAnalyzeVoice("income")}
                  onAddExpense={() => handleAnalyzeVoice("expense")}
                  onApprove={handleApproveVoice}
                  onCancel={handleCancelVoice}
                />
              ) : (
                <LayoutCustom
                  style={styles.lockedCard}
                  level="2"
                  horizontal
                  justify="space-between"
                  itemsCenter
                >
                  <LayoutCustom style={styles.lockedText} gap={4}>
                    <Text category="s1">{t("Voice AI")}</Text>
                    <Text category="c2" status="content" numberOfLines={2}>
                      {t(
                        "Upgrade your premium account to unlock all the special functions of the app."
                      )}
                    </Text>
                  </LayoutCustom>
                  <Button size="small" onPress={() => navigate("GetPremium")}>
                    {t("Upgrade")}
                  </Button>
                </LayoutCustom>
              )}
              <CurrencyRatesCard />
              <LinearGradientText text={"Latest transaction"} category="h3" />
              <LatestTransaction
                wallets={
                  selectedWalletId === "AllWallet"
                    ? data
                    : data.filter((item) => String(item.id) === selectedWalletId)
                }
              />
            </LayoutCustom>
          )}
        </>
      </Content>
      <AdInterstitial
        visible={adVisible}
        minViewSec={Math.max(0, Number(adConfig?.min_view_sec ?? 5))}
        onClose={handleCloseAd}
      />
      <Portal>
        <Modalize
          ref={modalizeRef}
          withHandle
          handlePosition="outside"
          snapPoint={(data.length + 2) * 100}
          modalStyle={styles.modalStyle}
        >
          <LayoutCustom style={styles.contentContainer}>
            <Text category="h4" marginBottom={24}>
              Select Wallet
            </Text>
            <WalletSelectItem
              item={allWallet}
              onPress={() => {
                close();
                setSelectedWalletId("AllWallet");
              }}
            />
            {data &&
              data.map((item, index) => {
                return (
                  <WalletSelectItem
                    key={index}
                    item={item}
                    onPress={() => {
                      close();
                      setSelectedWalletId(String(item.id));
                    }}
                  />
                );
              })}
          </LayoutCustom>
        </Modalize>
      </Portal>
    </Container>
  );
});

export default HomeScreen;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingBottom: 0,
  },
  wallet: {
    width: 28,
    height: 28,
    tintColor: "text-white-color",
  },
  cardNewWallet: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "color-primary-default",
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 16,
    gap: 9,
    marginTop: 80,
  },
  content: {
    gap: 16,
    paddingBottom: 80,
  },
  title: {},
  caret: {
    width: 24,
    height: 24,
    tintColor: "text-basic-color",
  },
  modalStyle: {
    backgroundColor: "background-basic-color-1",
    padding: 24,
  },
  contentContainer: {
    width: "100%",
    paddingBottom: 40,
  },
  lockedCard: {
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  lockedText: {
    flex: 1,
    paddingRight: 12,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 99,
    backgroundColor: "background-basic-color-2",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationIcon: {
    width: 20,
    height: 20,
    tintColor: "text-basic-color",
  },
  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 99,
    backgroundColor: "color-danger-default",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "700",
  },
});
