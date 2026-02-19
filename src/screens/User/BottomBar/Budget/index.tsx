import React from 'react';
// ----------------------------- UI kitten -----------------------------------
import { TopNavigation, StyleService, useStyleSheet } from '@ui-kitten/components';
// ----------------------------- Components && Elements -----------------------
import { Container, Content, IDivider, LayoutCustom, LinearGradientText, Text } from 'components';
import TabBar from 'components/TabBar';
// ----------------------------- Reduxs --------------------------------------
import { useAppSelector } from 'reduxs/store';
import { appSelector } from 'reduxs/reducers/app-reducer';
// ----------------------------- Others --------------------------------------
import dayjs from 'dayjs';
import { useCurrencyConversion, useCurrencyFormatter } from 'hooks';
import { IMAGE_ICON_CATEGORY } from 'assets/IconCategory';
import { Image } from 'react-native';
import { TransactionEnumType } from 'types/redux-types';
import { formatDate } from 'utils';
import { useTranslation } from 'i18n/useTranslation';

const BudgetScreen = React.memo(() => {
  const styles = useStyleSheet(themedStyles);
  const formatCurrency = useCurrencyFormatter();
  const { convert } = useCurrencyConversion();
  const { t } = useTranslation();
  const wallets = useAppSelector(appSelector).wallets;
  const [rangeIndex, setRangeIndex] = React.useState(1);

  const walletById = React.useMemo(() => {
    const map = new Map<string, (typeof wallets)[number]>();
    wallets.forEach((wallet) => map.set(String(wallet.id), wallet));
    return map;
  }, [wallets]);

  const toDate = (value: any): Date => {
    if (!value) return new Date(0);
    if (value instanceof Date) return value;
    if (typeof value === 'string') return new Date(value);
    if (typeof value === 'object' && typeof value.toDate === 'function') {
      return value.toDate();
    }
    return new Date(value);
  };

  const allTransactions = React.useMemo(() => {
    return wallets.flatMap((wallet) => wallet.transaction ?? []);
  }, [wallets]);

  const range = React.useMemo(() => {
    const now = dayjs();
    if (rangeIndex === 0) {
      return {
        label: t('This Week'),
        start: now.startOf('week'),
        end: now.endOf('week'),
      };
    }
    if (rangeIndex === 1) {
      return {
        label: t('This Month'),
        start: now.startOf('month'),
        end: now.endOf('month'),
      };
    }
    return {
      label: t('This Year'),
      start: now.startOf('year'),
      end: now.endOf('year'),
    };
  }, [rangeIndex, t]);

  const filteredTransactions = React.useMemo(() => {
    if (allTransactions.length === 0) return [];
    const start = range.start.valueOf();
    const end = range.end.valueOf();
    return allTransactions.filter((tx) => {
      const value = toDate(tx.date).getTime();
      return value >= start && value <= end;
    });
  }, [allTransactions, range]);

  const totalIncome = filteredTransactions.reduce((sum, tx) => {
    if (tx.type !== TransactionEnumType.INCOME) return sum;
    return sum + convert(tx.balance, tx.currency);
  }, 0);
  const totalExpenses = filteredTransactions.reduce((sum, tx) => {
    if (tx.type !== TransactionEnumType.EXPENSESE) return sum;
    return sum + convert(tx.balance, tx.currency);
  }, 0);
  const netBalance = totalIncome - totalExpenses;

  const groupedByDate = React.useMemo(() => {
    const map = new Map<string, typeof filteredTransactions>();
    filteredTransactions.forEach((tx) => {
      const key = dayjs(toDate(tx.date)).format('YYYY-MM-DD');
      const list = map.get(key) ?? [];
      list.push(tx);
      map.set(key, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => dayjs(b[0]).valueOf() - dayjs(a[0]).valueOf())
      .map(([key, transactions]) => ({
        key,
        dateLabel: formatDate(dayjs(key).toDate(), {
          labels: {
            today: t('Today'),
            yesterday: t('Yesterday'),
            lastWeek: t('Last week'),
          },
        }),
        transactions,
      }));
  }, [filteredTransactions, t]);

  return (
    <Container style={styles.container}>
      <TopNavigation title={t('Budget')} alignment="center" />
      <Content contentContainerStyle={styles.content}>
        <LayoutCustom gap={16}>
          <TabBar
            tabs={[t('Week'), t('Month'), t('Year')]}
            tabActive={rangeIndex}
            onChangeTab={setRangeIndex}
            capitalize
            uppercase={false}
          />
          <LayoutCustom itemsCenter>
            <LinearGradientText category="body" text={range.label} />
          </LayoutCustom>
          <LayoutCustom horizontal gap={12}>
            <LayoutCustom style={styles.cardIncome}>
              <Text category="subhead">Income</Text>
              <Text category="h5">{formatCurrency(totalIncome, 2)}</Text>
            </LayoutCustom>
            <LayoutCustom style={styles.cardExpense}>
              <Text category="subhead">Expense</Text>
              <Text category="h5">{formatCurrency(totalExpenses, 2)}</Text>
            </LayoutCustom>
          </LayoutCustom>
          <LayoutCustom style={styles.cardNet} level="2">
            <LayoutCustom horizontal justify="space-between" itemsCenter>
              <Text category="h6">Net</Text>
              <Text category="h5" status="warning">
                {formatCurrency(netBalance, 2)}
              </Text>
            </LayoutCustom>
          </LayoutCustom>
          {groupedByDate.length === 0 ? (
            <LayoutCustom level="2" style={styles.emptyState}>
              <Text category="c1" status="content">
                No transactions for this period.
              </Text>
            </LayoutCustom>
          ) : (
            groupedByDate.map((group) => {
              const dayBalance = group.transactions.reduce((sum, tx) => {
                const converted = convert(tx.balance, tx.currency);
                return sum + (tx.type === TransactionEnumType.INCOME ? converted : -converted);
              }, 0);
              return (
                <LayoutCustom key={group.key} style={styles.group} level="2">
                  <LayoutCustom horizontal itemsCenter justify="space-between">
                    <LinearGradientText text={group.dateLabel} category="h5" />
                    <Text category="h5" status="warning">
                      {formatCurrency(dayBalance, 2)}
                    </Text>
                  </LayoutCustom>
                  <IDivider marginVertical={16} />
                  <LayoutCustom gap={16}>
                    {group.transactions.map((trans, index) => {
                      const wallet = walletById.get(String(trans.walletId));
                      return (
                        <LayoutCustom key={`${trans.id}-${index}`}>
                          <LayoutCustom gap={12} horizontal>
                            <Image
                              source={
                                IMAGE_ICON_CATEGORY[trans.category?.icon] ??
                                IMAGE_ICON_CATEGORY.ic001
                              }
                              style={styles.categoryImg as any}
                            />
                            <LayoutCustom style={{ flex: 1 }} gap={8}>
                              <LayoutCustom horizontal justify="space-between">
                                <Text category="subhead">
                                  {trans.category?.name ?? t('Category')}
                                </Text>
                                <Text category="h6">
                                  {formatCurrency(convert(trans.balance, trans.currency), 2)}
                                </Text>
                              </LayoutCustom>
                              <LayoutCustom horizontal justify="space-between">
                                <Text category="c1" status="content">
                                  {wallet ? `${wallet.symbol} ${wallet.title}` : t('Wallet')}
                                </Text>
                                <Text category="c2" opacity={0.5}>
                                  {dayjs(toDate(trans.date)).format('DD/MM/YYYY HH:mm')}
                                </Text>
                              </LayoutCustom>
                            </LayoutCustom>
                          </LayoutCustom>
                          {index < group.transactions.length - 1 && (
                            <IDivider marginLeft={44} marginTop={16} />
                          )}
                        </LayoutCustom>
                      );
                    })}
                  </LayoutCustom>
                </LayoutCustom>
              );
            })
          )}
        </LayoutCustom>
      </Content>
    </Container>
  );
});

export default BudgetScreen;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingBottom:0
  },
  content: {
    paddingBottom: 80,
    gap: 16,
    paddingHorizontal: 16,
  },
  cardIncome: {
    flex: 1,
    backgroundColor: 'color-primary-default',
    borderRadius: 16,
    gap: 12,
    padding: 16,
  },
  cardExpense: {
    flex: 1,
    backgroundColor: 'color-danger-default',
    borderRadius: 16,
    gap: 12,
    padding: 16,
  },
  cardNet: {
    borderRadius: 16,
    padding: 16,
  },
  emptyState: {
    borderRadius: 16,
    padding: 16,
  },
  group: {
    borderRadius: 16,
    padding: 16,
  },
  categoryImg: {
    width: 32,
    height: 32,
  },
});
