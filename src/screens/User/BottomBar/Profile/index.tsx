import React from "react";
import { Alert, Modal, Share } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
// ----------------------------- UI kitten -----------------------------------
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Avatar,
  Button,
  Icon,
} from "@ui-kitten/components";
// ----------------------------- Navigation -----------------------------------
import { NavigationProp, useNavigation } from "@react-navigation/native";
// ----------------------------- Hooks ---------------------------------------
// ----------------------------- Assets ---------------------------------------
import { Images } from "assets/images";
// ----------------------------- Components && Elements -----------------------
import { Container, Content, LayoutCustom, Text } from "components";
import CustomButton from "./CustomButton";
import EditProfileModal from "./EditProfileModal";
// ----------------------------- Reduxs ---------------------------------------
import {
  appSelector,
  resetAppState,
  setUserProfile,
} from "reduxs/reducers/app-reducer";
import { useAppDispatch, useAppSelector } from "reduxs/store";
// ----------------------------- Utils ---------------------------------------
import { useCurrencyConversion, useCurrencyFormatter } from "hooks";
// ----------------------------- Types ---------------------------------------
import { RootStackParamList } from "types/navigation-types";
import { auth } from "lib/firebase";
import { sendPasswordResetEmail, signOut } from "firebase/auth";
import {
  clearUserDataForUser,
  syncUserData,
  updateUserProfile,
} from "services/userData";
import { runWithAppRequest } from "reduxs/requestLoading";
import { useTranslation } from "i18n/useTranslation";
import { LANGUAGES } from "i18n/translations";
import { getPermissionBoolean, getWalletsNetBalance } from "utils";
import { unregisterPushNotificationsForCurrentUser } from "services/pushNotifications";

const ProfileScreen = React.memo(() => {
  const styles = useStyleSheet(themedStyles);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const dispatch = useAppDispatch();
  const formatCurrency = useCurrencyFormatter();
  const { convert } = useCurrencyConversion();
  const { t, language } = useTranslation();
  const [editVisible, setEditVisible] = React.useState(false);
  const [savingProfile, setSavingProfile] = React.useState(false);

  const data = useAppSelector(appSelector).wallets;
  const currency = useAppSelector(appSelector).currency;
  const user = useAppSelector(appSelector).user;
  const permissions = useAppSelector(appSelector).permissions;
  const permissionsPlan = useAppSelector(appSelector).permissionsPlan;
  const isPremium =
    permissionsPlan === "premium" || user?.plan === "premium" || user?.is_premium === true;
  const sumBalance = getWalletsNetBalance(data, convert);
  const authUser = auth.currentUser;
  const email = user?.email ?? authUser?.email ?? null;
  const profilePhotoUrl = user?.photo_url ?? authUser?.photoURL ?? null;
  const avatarSource = profilePhotoUrl ? { uri: profilePhotoUrl } : Images.avatar_01;
  const displayName =
    user?.name ??
    authUser?.displayName ??
    (email ? email.split("@")[0] : t("User"));
  const languageLabel =
    LANGUAGES.find((item) => item.code === language)?.nativeLabel ??
    language?.toUpperCase() ??
    "EN";

  const onUpgradePremium = () => {
    navigate("GetPremium");
  };
  const onNotification = () => {};
  const onCurrency = () => {
    navigate("CurrencyScreen");
  };
  const onLanguage = () => {
    navigate("LanguageScreen");
  };
  const onWallet = () => {
    navigate("BottomBar", { screen: "Wallet" });
  };
  const onResetPassword = async () => {
    if (!email) {
      Alert.alert(t("Reset failed"), t("Email not found for this account."));
      return;
    }
    try {
      await runWithAppRequest(async () => {
        await sendPasswordResetEmail(auth, email);
      });
      Alert.alert(t("Check your email"), t("Password reset link sent."));
    } catch (err: any) {
      Alert.alert(t("Reset failed"), err?.message ?? t("Please try again."));
    }
  };
  const onClearData = () => {
    Alert.alert(
      t("Clear all data?"),
      t("This will delete your wallets, transactions, budgets, and bills for this account."),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Clear"),
          style: "destructive",
          onPress: async () => {
            try {
              await clearUserDataForUser();
              dispatch(resetAppState());
              await syncUserData(dispatch);
              Alert.alert(t("Cleared"), t("Your data has been removed."));
            } catch (err: any) {
              Alert.alert(t("Clear failed"), err?.message ?? t("Please try again."));
            }
          },
        },
      ]
    );
  };
  const onLogout = () => {
    Alert.alert(
      t("Log out?"),
      t("You will need to sign in again to access your data."),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Log out"),
          style: "destructive",
          onPress: async () => {
            try {
              await runWithAppRequest(async () => {
                await unregisterPushNotificationsForCurrentUser().catch(() => {
                  // ignore push unregister errors on logout
                });
                await signOut(auth);
              });
              dispatch(resetAppState());
            } catch (err: any) {
              Alert.alert(t("Logout failed"), err?.message ?? t("Please try again."));
            }
          },
        },
      ]
    );
  };

  const onExport = async () => {
    const canExport = getPermissionBoolean(permissions, "export", true);
    if (!isPremium || !canExport) {
      navigate("GetPremium");
      return;
    }
    try {
      const csvEscape = (value: any) => {
        const raw = value === undefined || value === null ? "" : String(value);
        if (raw.includes('"') || raw.includes(",") || raw.includes("\n")) {
          return `"${raw.replace(/"/g, '""')}"`;
        }
        return raw;
      };

      const header = [
        "wallet_id",
        "wallet_title",
        "wallet_currency",
        "wallet_balance",
        "transaction_id",
        "transaction_type",
        "transaction_amount",
        "transaction_currency",
        "transaction_date",
        "category_id",
        "category_name",
        "note",
      ];

      const rows: string[] = [];
      data.forEach((wallet) => {
        const transactions = wallet.transaction ?? [];
        if (transactions.length === 0) {
          rows.push(
            [
              wallet.id,
              wallet.title,
              wallet.currency ?? "",
              wallet.balance ?? "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
            ]
              .map(csvEscape)
              .join(",")
          );
          return;
        }
        transactions.forEach((tx) => {
          rows.push(
            [
              wallet.id,
              wallet.title,
              wallet.currency ?? "",
              wallet.balance ?? "",
              tx.id,
              tx.type,
              tx.balance,
              tx.currency ?? "",
              typeof tx.date === "string" ? tx.date : tx.date?.toISOString?.() ?? "",
              tx.categoryId ?? "",
              tx.category?.name ?? "",
              tx.note?.textNote ?? "",
            ]
              .map(csvEscape)
              .join(",")
          );
        });
      });

      const csvContent = [header.join(","), ...rows].join("\n");
      const fileName = `moneytracking_${new Date().toISOString().slice(0, 10)}.csv`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          UTI: "public.comma-separated-values-text",
          dialogTitle: t("Export data"),
        });
      } else {
        await Share.share({ message: csvContent });
      }
    } catch (err: any) {
      Alert.alert(t("Export failed"), err?.message ?? t("Please try again."));
    }
  };
  const onSaveProfile = async (nextName: string, nextPhotoUrl: string | null) => {
    if (savingProfile) {
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await updateUserProfile({
        name: nextName,
        photo_url: nextPhotoUrl,
      });
      dispatch(setUserProfile({ ...(user ?? {}), ...updated }));
      setEditVisible(false);
      Alert.alert(t("Profile updated"), t("Your name has been updated."));
    } catch (err: any) {
      Alert.alert(t("Update failed"), err?.message ?? t("Please try again."));
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <Container style={styles.container}>
      <TopNavigation />
      <Content contentContainerStyle={styles.content}>
        <LayoutCustom itemsCenter gap={8}>
          <Avatar source={avatarSource} size="giant" />
          <Text category="h3" marginTop={8}>
            {displayName}
          </Text>
          <Text category="body" status="content">
            {email ?? t("No email")}
          </Text>
          <Button
            children={t("Premium Account")}
            onPress={onUpgradePremium}
            accessoryLeft={<Icon pack="assets" name="crown" />}
          />
        </LayoutCustom>
        <LayoutCustom gap={4}>
          <CustomButton
            icon="pencil"
            title={t("Edit Profile")}
            describe={t("Update your name")}
            onPress={() => setEditVisible(true)}
          />
          <CustomButton
            icon="bell"
            title={t("Notifications")}
            describe={t("Open all")}
            onPress={() => {}}
            showArrow
          />
          <CustomButton
            icon="gear-six"
            title={t("Currency")}
            describe={currency}
            onPress={onCurrency}
            showArrow
          />
          <CustomButton
            icon="globe"
            title={t("Language")}
            describe={languageLabel}
            onPress={onLanguage}
            showArrow
          />
          <CustomButton
            icon="lock-open"
            title={t("Reset Password")}
            describe={t("Send reset email")}
            onPress={onResetPassword}
          />
          <CustomButton
            icon="suitcase"
            title={t("Wallet")}
            describe={t("Total: {{amount}}", { amount: formatCurrency(sumBalance, 2) })}
            onPress={onWallet}
            showArrow
          />
          <CustomButton
            icon="download"
            title={t("Export data")}
            describe={t("Download your data")}
            onPress={onExport}
          />
          <CustomButton
            icon="delete"
            title={t("Clear All Data")}
            describe={t("Delete wallets, transactions, bills")}
            onPress={onClearData}
          />
          <CustomButton
            icon="sign-out"
            title={t("Logout")}
            describe={t("Sign out of this account")}
            onPress={onLogout}
            showArrow={false}
            mt={12}
          />
          <Text category="h6" style={styles.helpCenter}>
            {t("Help Center")}
          </Text>
          <LayoutCustom mt={12} itemsCenter justify="space-between" horizontal>
            <Text category="h6" style={styles.helpCenter}>
              {t("Version")}
            </Text>
            <Text category="subhead" style={styles.helpCenter}>
              v.05.2023
            </Text>
          </LayoutCustom>
        </LayoutCustom>
      </Content>
      {editVisible && (
        <Modal
          visible={editVisible}
          style={styles.modalStyle}
          presentationStyle="fullScreen"
        >
          <EditProfileModal
            name={displayName}
            email={email}
            photoUrl={profilePhotoUrl}
            saving={savingProfile}
            onClose={() => setEditVisible(false)}
            onSave={onSaveProfile}
          />
        </Modal>
      )}
    </Container>
  );
});

export default ProfileScreen;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingBottom: 0,
  },
  content: {
    gap: 32,
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  helpCenter: {
    color: "color-basic-700",
  },
  modalStyle: {
    width: "100%",
    height: "100%",
    backgroundColor: "background-basic-color-1",
  },
});
