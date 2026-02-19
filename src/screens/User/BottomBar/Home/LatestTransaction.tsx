import React from "react";
import { Image } from "react-native";
// ----------------------------- UI kitten -----------------------------------
import { StyleService, useStyleSheet } from "@ui-kitten/components";
// ----------------------------- Navigation -----------------------------------
import { useNavigation } from "@react-navigation/native";
// ----------------------------- Hooks ---------------------------------------
import { useLayout } from "hooks";
// ----------------------------- Components && Elements -----------------------
import { IDivider, LayoutCustom, LinearGradientText, Text } from "components";
// ----------------------------- Types ---------------------------------------
import { TransactionEnumType } from "types/redux-types";
// ----------------------------- Assets ---------------------------------------
import { IMAGE_ICON_CATEGORY } from "assets/IconCategory";
import { formatDate } from "utils";
import { useCurrencyConversion, useCurrencyFormatter } from "hooks";
import dayjs from "dayjs";
// ----------------------------- Reduxs ---------------------------------------
import { useAppSelector } from "reduxs/store";
import { appSelector } from "reduxs/reducers/app-reducer";
import { IWalletProps } from "types/redux-types";
import { useTranslation } from "i18n/useTranslation";

type LatestTransactionProps = {
  wallets?: IWalletProps[];
};

const LatestTransaction = React.memo(({ wallets: walletsProp }: LatestTransactionProps) => {
  const styles = useStyleSheet(themedStyles);
  const formatCurrency = useCurrencyFormatter();
  const { convert } = useCurrencyConversion();
  const { t } = useTranslation();

  const storeWallets = useAppSelector(appSelector).wallets;
  const wallets = walletsProp ?? storeWallets;
  const walletById = React.useMemo(() => {
    const map = new Map<string, (typeof wallets)[number]>();
    wallets.forEach((wallet) => map.set(String(wallet.id), wallet));
    return map;
  }, [wallets]);

  const toDate = (value: any): Date => {
    if (!value) return new Date(0);
    if (value instanceof Date) return value;
    if (typeof value === "string") return new Date(value);
    if (typeof value === "object" && typeof value.toDate === "function") {
      return value.toDate();
    }
    return new Date(value);
  };

  const allTransactions = React.useMemo(() => {
    return wallets.flatMap((wallet) => wallet.transaction ?? []);
  }, [wallets]);

  const sortedTransactions = React.useMemo(() => {
    return [...allTransactions].sort((a, b) => {
      return toDate(b.date).getTime() - toDate(a.date).getTime();
    });
  }, [allTransactions]);

  const latestTransaction = sortedTransactions[0];
  const dateLabels = React.useMemo(
    () => ({
      today: t("Today"),
      yesterday: t("Yesterday"),
      lastWeek: t("Last week"),
    }),
    [t]
  );

  const headerDate = latestTransaction
    ? formatDate(toDate(latestTransaction.date), { labels: dateLabels })
    : t("No transactions");

  const dayTransactions = React.useMemo(() => {
    if (!latestTransaction) return [];
    const targetDay = dayjs(toDate(latestTransaction.date));
    return sortedTransactions.filter((tx) =>
      dayjs(toDate(tx.date)).isSame(targetDay, "day")
    );
  }, [latestTransaction, sortedTransactions]);

  const dayBalance = dayTransactions.reduce((sum, tx) => {
    const converted = convert(tx.balance, tx.currency);
    return sum + (tx.type === TransactionEnumType.INCOME ? converted : -converted);
  }, 0);

  return (
    <LayoutCustom style={styles.container} level="2">
      <LayoutCustom horizontal itemsCenter justify="space-between">
        <LinearGradientText text={headerDate} category="h5" />
        <Text category="h5" status="warning">
          {formatCurrency(dayBalance, 2)}
        </Text>
      </LayoutCustom>
      <IDivider marginVertical={16} />
      <LayoutCustom gap={16}>
        {dayTransactions.length === 0 ? (
          <Text category="c1" status="content">
            No transactions yet.
          </Text>
        ) : (
          dayTransactions.map((trans, index) => {
            const wallet = walletById.get(String(trans.walletId));
            return (
              <LayoutCustom key={`${trans.id}-${index}`}>
                <LayoutCustom gap={12} horizontal>
                  <Image
                    source={IMAGE_ICON_CATEGORY[trans.category.icon]}
                    //@ts-ignore
                    style={styles.categoryImg}
                  />
                  <LayoutCustom style={{ flex: 1 }} gap={8}>
                    <LayoutCustom horizontal justify="space-between">
                      <Text category="subhead">{trans.category.name}</Text>
                      <Text category="h6">
                        {formatCurrency(convert(trans.balance, trans.currency), 2)}
                      </Text>
                    </LayoutCustom>
                    <LayoutCustom horizontal justify="space-between">
                      <Text category="c1" status="content">
                        {wallet ? `${wallet.symbol} ${wallet.title}` : t("Wallet")}
                      </Text>
                      <Text category="c2" opacity={0.5}>
                        {dayjs(toDate(trans.date)).format("DD/MM/YYYY HH:mm")}
                      </Text>
                    </LayoutCustom>
                  </LayoutCustom>
                </LayoutCustom>
                {index < dayTransactions.length - 1 && (
                  <IDivider marginLeft={44} marginTop={16} />
                )}
              </LayoutCustom>
            );
          })
        )}
      </LayoutCustom>
    </LayoutCustom>
  );
});

export default LatestTransaction;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
  },
  categoryImg: {
    width: 32,
    height: 32,
  },
});
