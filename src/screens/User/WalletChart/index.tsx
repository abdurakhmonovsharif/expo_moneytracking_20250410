import React from "react";
import { Modal } from "react-native";
// ----------------------------- UI kitten -----------------------------------
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Spinner,
} from "@ui-kitten/components";
// ----------------------------- Navigation -----------------------------------
import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
// ----------------------------- Hooks ---------------------------------------
// ----------------------------- Assets ---------------------------------------
// ----------------------------- Components && Elements -----------------------
import {
  Container,
  Content,
  LayoutCustom,
  NavigationAction,
  Text,
} from "components";
import TransactionField from "./TransactionField";
import BalanceField from "../BottomBar/Home/BalanceField";
import { appSelector } from "reduxs/reducers/app-reducer";
import { useAppSelector } from "reduxs/store";
import { formatDate, waitUtil } from "utils";
import { useCurrencyConversion, useCurrencyFormatter } from "hooks";
import TabBar from "./TabBar";
import { RootStackParamList } from "types/navigation-types";
import dayjs from "dayjs";
import { TransactionEnumType } from "types/redux-types";
import { useTranslation } from "i18n/useTranslation";

const WalletChart = React.memo(() => {
  const styles = useStyleSheet(themedStyles);
  const formatCurrency = useCurrencyFormatter();
  const { convert } = useCurrencyConversion();
  const { navigate } =
    useNavigation<NavigationProp<RootStackParamList>>();
  const { t } = useTranslation();

  const [loading, setLoading] = React.useState(false);
  const [visibleOption, setVisibleOption] = React.useState(false);
  const toggleOption = () => {
    setVisibleOption(!visibleOption);
  };
  const [option, setOption] = React.useState(0);
  const data = useAppSelector(appSelector).wallets;
  const [selected, setSelected] = React.useState(0);

  const findWalletById = (walletId: string | number) => {
    return data.find((wallet) => wallet.id === walletId);
  };
  const router = useRoute<RouteProp<RootStackParamList, "WalletChart">>().params
    .walletId;

  const wallet = React.useMemo(() => findWalletById(router), [router, data]);
  const walletTransactions = wallet?.transaction ?? [];

  const toDate = (value: any): Date => {
    if (!value) return new Date(0);
    if (value instanceof Date) return value;
    if (typeof value === "string") return new Date(value);
    if (typeof value === "object" && typeof value.toDate === "function") {
      return value.toDate();
    }
    return new Date(value);
  };

  const monthTabs = React.useMemo(() => {
    const unique = new Set<string>();
    walletTransactions.forEach((tx) => {
      unique.add(dayjs(toDate(tx.date)).format("MM/YYYY"));
    });
    const sorted = Array.from(unique).sort(
      (a, b) => dayjs(b, "MM/YYYY").valueOf() - dayjs(a, "MM/YYYY").valueOf()
    );
    return sorted.length > 0 ? sorted : [dayjs().format("MM/YYYY")];
  }, [walletTransactions]);

  const yearTabs = React.useMemo(() => {
    const unique = new Set<string>();
    walletTransactions.forEach((tx) => {
      unique.add(dayjs(toDate(tx.date)).format("YYYY"));
    });
    const sorted = Array.from(unique).sort(
      (a, b) => dayjs(b, "YYYY").valueOf() - dayjs(a, "YYYY").valueOf()
    );
    return sorted.length > 0 ? sorted : [dayjs().format("YYYY")];
  }, [walletTransactions]);

  const DATA = React.useMemo(
    () => [
      { title: "All Time", tabs: ["All Time"] },
      { title: "Monthly", tabs: monthTabs },
      { title: "Yearly", tabs: yearTabs },
    ],
    [monthTabs, yearTabs]
  );

  React.useEffect(() => {
    if (selected >= DATA[option].tabs.length) {
      setSelected(0);
    }
  }, [option, selected, DATA]);

  const selectedTab = DATA[option].tabs[selected] ?? DATA[option].tabs[0];

  const filteredTransactions = React.useMemo(() => {
    if (option === 1) {
      return walletTransactions.filter((tx) =>
        dayjs(toDate(tx.date)).format("MM/YYYY") === selectedTab
      );
    }
    if (option === 2) {
      return walletTransactions.filter((tx) =>
        dayjs(toDate(tx.date)).format("YYYY") === selectedTab
      );
    }
    return walletTransactions;
  }, [walletTransactions, option, selectedTab]);

  const groupedByDate = React.useMemo(() => {
    const map = new Map<string, typeof walletTransactions>();
    filteredTransactions.forEach((tx) => {
      const key = dayjs(toDate(tx.date)).format("YYYY-MM-DD");
      const list = map.get(key) ?? [];
      list.push(tx);
      map.set(key, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => dayjs(b[0]).valueOf() - dayjs(a[0]).valueOf())
      .map(([key, transactions]) => ({
        dateLabel: formatDate(dayjs(key).toDate(), {
          labels: {
            today: t("Today"),
            yesterday: t("Yesterday"),
            lastWeek: t("Last week"),
          },
        }),
        transactions,
      }));
  }, [filteredTransactions, t]);

  const totalIncome = filteredTransactions.reduce((sum, tx) => {
    if (tx.type !== TransactionEnumType.INCOME) return sum;
    return sum + convert(tx.balance, tx.currency);
  }, 0);
  const totalExpenses = filteredTransactions.reduce((sum, tx) => {
    if (tx.type !== TransactionEnumType.EXPENSESE) return sum;
    return sum + convert(tx.balance, tx.currency);
  }, 0);
  const netBalance =
    convert(wallet?.balance ?? 0, wallet?.currency) +
    totalIncome -
    totalExpenses;

  const onDetailsWallet = () => {
    if (wallet) {
      navigate("DetailsWallet", { wallet });
    }
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={() => <NavigationAction />}
        title={
          <LayoutCustom itemsCenter>
            <Text category="c1">{wallet?.title ?? "Wallet"}</Text>
            <Text category="h6">{formatCurrency(netBalance, 2)}</Text>
          </LayoutCustom>
        }
        accessoryRight={() => (
          <LayoutCustom horizontal gap={4}>
            <NavigationAction icon="calendar" onPress={toggleOption} />
            <NavigationAction
              icon="dots-three-vertical"
              onPress={onDetailsWallet}
            />
          </LayoutCustom>
        )}
      />
      <TabBar
        tabs={DATA[option].tabs}
        selected={selected}
        onSelect={(index) => {
          setSelected(index);
          setLoading(true);
          waitUtil(1000).then(() => {
            setLoading(false);
          });
        }}
      />
      {loading ? (
        <LayoutCustom itemsCenter justify="center" mt={80}>
          <Spinner size="giant" />
        </LayoutCustom>
      ) : (
        <LayoutCustom style={{ flex: 1 }}>
          <Content contentContainerStyle={styles.content}>
            <LayoutCustom mb={8}>
              <BalanceField data={wallet ? [wallet] : data} />
            </LayoutCustom>
            {groupedByDate.length === 0 ? (
              <LayoutCustom level="2" style={{ padding: 16, borderRadius: 16 }}>
                <Text category="c1" status="content">
                  No transactions yet.
                </Text>
              </LayoutCustom>
            ) : (
              groupedByDate.map((group) => (
                <TransactionField
                  key={group.dateLabel}
                  dateLabel={group.dateLabel}
                  transactions={group.transactions}
                  walletTitle={wallet ? `${wallet.symbol} ${wallet.title}` : undefined}
                />
              ))
            )}
          </Content>
        </LayoutCustom>
      )}
      <Modal visible={visibleOption} transparent>
        <LayoutCustom justify="flex-end" style={styles.modal}>
          <LayoutCustom
            style={styles.backdrop}
            onPress={() => {
              setVisibleOption(false);
            }}
          />
          <LayoutCustom style={styles.modalContent} level="1" pt={32}>
            {DATA.map((item, index) => {
              const isActive = index === option;
              return (
                <LayoutCustom
                  key={index}
                  onPress={() => {
                    if (isActive) {
                      setVisibleOption(false);
                    } else {
                      setOption(index);
                      setVisibleOption(false);
                      setLoading(true);
                      waitUtil(1000).then(() => {
                        setLoading(false);
                      });
                      setSelected(0);
                    }
                  }}
                >
                  <Text
                    center
                    category="h4"
                    status={isActive ? "basic" : "platinum"}
                  >
                    {item.title}
                  </Text>
                </LayoutCustom>
              );
            })}
          </LayoutCustom>
        </LayoutCustom>
      </Modal>
    </Container>
  );
});

export default WalletChart;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingBottom: 0,
  },
  content: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 60,
    paddingTop: 16,
  },
  modal: {
    backgroundColor: "#2A394750",
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 4,
    gap: 32,
    shadowColor: "#FFFFFF",
    shadowOffset: {
      width: 8,
      height: 8,
    },
    shadowOpacity: 0.9,
    shadowRadius: 5.84,
    elevation: 5,
  },
  buttonConfirm: {
    marginHorizontal: 16,
    marginBottom: 4,
  },
  backdrop: {
    backgroundColor: "transparent",
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: -10,
  },
});
