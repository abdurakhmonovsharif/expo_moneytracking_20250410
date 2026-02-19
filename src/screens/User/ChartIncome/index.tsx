import React from 'react';
// ----------------------------- UI kitten -----------------------------------
import {
  TopNavigation,
  Spinner,
  StyleService,
  useStyleSheet,
  useTheme,
} from '@ui-kitten/components';
// ----------------------------- Navigation -----------------------------------
// ----------------------------- Assets ---------------------------------------
import { IMAGE_ICON_CATEGORY } from 'assets/IconCategory';
// ----------------------------- Hooks ---------------------------------------
import { useCurrencyConversion, useCurrencyFormatter, useLayout } from 'hooks';
// ----------------------------- Components && Elements -----------------------
import { VictoryPie } from 'victory-native';
import TransactionIncome from './TransactionIncome';
import {
  Container,
  Content,
  LayoutCustom,
  LinearGradientText,
  NavigationAction,
  Text,
} from 'components';
import { waitUtil } from 'utils';
import TabBar from './TabBar';
import { useAppSelector } from 'reduxs/store';
import { appSelector } from 'reduxs/reducers/app-reducer';
import dayjs from 'dayjs';
import { TransactionEnumType } from 'types/redux-types';

const ChartIncome = React.memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { height } = useLayout();
  const formatCurrency = useCurrencyFormatter();
  const { convert } = useCurrencyConversion();
  const wallets = useAppSelector(appSelector).wallets;

  const toDate = (value: any): Date => {
    if (!value) return new Date(0);
    if (value instanceof Date) return value;
    if (typeof value === 'string') return new Date(value);
    if (typeof value === 'object' && typeof value.toDate === 'function') {
      return value.toDate();
    }
    return new Date(value);
  };

  const allTransactions = React.useMemo(
    () => wallets.flatMap((wallet) => wallet.transaction ?? []),
    [wallets]
  );

  const monthTabs = React.useMemo(() => {
    const unique = new Set<string>();
    allTransactions.forEach((tx) => {
      unique.add(dayjs(toDate(tx.date)).format('MM/YYYY'));
    });
    const sorted = Array.from(unique).sort(
      (a, b) => dayjs(b, 'MM/YYYY').valueOf() - dayjs(a, 'MM/YYYY').valueOf()
    );
    return sorted.length > 0 ? sorted : [dayjs().format('MM/YYYY')];
  }, [allTransactions]);

  const [activeIndex, setActiveIndex] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (activeIndex >= monthTabs.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, monthTabs]);

  const selectedMonth = monthTabs[activeIndex] ?? monthTabs[0];

  const incomeTransactions = React.useMemo(() => {
    return allTransactions.filter(
      (tx) =>
        tx.type === TransactionEnumType.INCOME &&
        dayjs(toDate(tx.date)).format('MM/YYYY') === selectedMonth
    );
  }, [allTransactions, selectedMonth]);

  const totalIncome = incomeTransactions.reduce(
    (sum, tx) => sum + convert(tx.balance, tx.currency),
    0
  );

  const pieData = React.useMemo(() => {
    const byCategory = new Map<string, { sum: number; name: string; icon: string }>();
    incomeTransactions.forEach((tx) => {
      const key = String(tx.category?.id ?? tx.categoryId ?? 'unknown');
      const entry = byCategory.get(key);
      const converted = convert(tx.balance, tx.currency);
      if (entry) {
        entry.sum += converted;
      } else {
        byCategory.set(key, {
          sum: converted,
          name: tx.category?.name ?? 'Unknown',
          icon: tx.category?.icon ?? 'ic001',
        });
      }
    });
    const items = Array.from(byCategory.values()).sort((a, b) => b.sum - a.sum);
    const total = items.reduce((sum, item) => sum + item.sum, 0);
    const colors = ['#106AF3', '#F6D938', '#C0A975', '#B1CEDE', '#4AC0FF', '#FF8A34', '#7B61FF', '#23C16B'];
    return items.map((item, index) => {
      const percent = total > 0 ? Math.round((item.sum / total) * 100) : 0;
      return {
        x: index + 1,
        y: item.sum,
        color: colors[index % colors.length],
        label: `${percent}%`,
        data: {
          image: IMAGE_ICON_CATEGORY[item.icon] ?? IMAGE_ICON_CATEGORY.ic001,
          title: item.name,
          amount: formatCurrency(item.sum, 2),
        },
      };
    });
  }, [incomeTransactions, formatCurrency]);

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={() => (
          <LayoutCustom itemsCenter>
            <LinearGradientText text={'Income'} category="c1" />
            <Text category="h6">{formatCurrency(totalIncome, 2)}</Text>
          </LayoutCustom>
        )}
        accessoryLeft={() => <NavigationAction icon={'close'} />}
      />
      <LayoutCustom>
        <TabBar
          tabs={monthTabs}
          selected={activeIndex}
          onSelect={(index) => {
            setActiveIndex(index);
            setLoading(true);
            waitUtil(750).then(() => {
              setLoading(false);
            });
          }}
        />
      </LayoutCustom>
      {loading ? (
        <LayoutCustom itemsCenter justify="center" mt={80}>
          <Spinner size="giant" />
        </LayoutCustom>
      ) : (
        <Content contentContainerStyle={styles.content}>
          {pieData.length === 0 ? (
            <LayoutCustom itemsCenter justify="center" mt={40}>
              <Text category="c1" status="content">
                No income transactions for this period.
              </Text>
            </LayoutCustom>
          ) : (
            <>
              <LayoutCustom mb={40} mt={32}>
                <VictoryPie
                  height={280 * (height / 812)}
                  padding={{ top: 0 }}
                  data={pieData}
                  labelRadius={95 * (height / 812)}
                  radius={({ datum }) => (3 === datum.x ? 160 * (height / 812) : 140 * (height / 812))}
                  innerRadius={80 * (height / 812)}
                  style={{
                    data: { fill: ({ datum }) => datum.color },
                    labels: {
                      fill: theme['text-white-color'],
                      fontSize: 14,
                      lineHeight: 22,
                      fontWeight: '700',
                    },
                  }}
                />
              </LayoutCustom>
              <LayoutCustom gap={8} ph={16}>
                {pieData.map((item, index) => {
                  return <TransactionIncome key={index} data={item.data} label={item.label} />;
                })}
              </LayoutCustom>
            </>
          )}
        </Content>
      )}
    </Container>
  );
});

export default ChartIncome;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingBottom:0
  },
  content: {
    paddingBottom: 40,
  },
});
