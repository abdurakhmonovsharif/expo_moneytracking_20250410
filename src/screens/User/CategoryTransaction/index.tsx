import React from 'react';
// ----------------------------- UI kitten -----------------------------------
import { TopNavigation, StyleService, useStyleSheet, Spinner } from '@ui-kitten/components';
// ----------------------------- Navigation -----------------------------------
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
// ----------------------------- Hooks ---------------------------------------
import { useLayout } from 'hooks';
// ----------------------------- Elements  -----------------------
import TransactionField from '../WalletChart/TransactionField';
import TabBar from '../ChartIncome/TabBar';
// ----------------------------- Components  -----------------------
import { Container, Content, NavigationAction, Text, LayoutCustom } from 'components';
// ----------------------------- Others  -----------------------
import dayjs from 'dayjs';
import { formatDate, waitUtil } from 'utils';
import { VictoryChart, VictoryBar, VictoryAxis, VictoryLabel } from 'victory-native';
// ----------------------------- Types  -----------------------
import { RootStackParamList } from 'types/navigation-types';
import { useTranslation } from 'i18n/useTranslation';

const CategoryTransaction = React.memo(() => {
  const styles = useStyleSheet(themedStyles);
  const { goBack } = useNavigation();
  const { height } = useLayout();
  const { t } = useTranslation();

  const [activeIndex, setActiveIndex] = React.useState(8);
  const [loading, setLoading] = React.useState(false);

  const data = useRoute<RouteProp<RootStackParamList, 'CategoryTransaction'>>().params;
  const barWidth = 48;
  const betweenBarPadding = 12;
  const _heightChart = 162 * (height / 812);
  const dateLabels = React.useMemo(
    () => ({
      today: t('Today'),
      yesterday: t('Yesterday'),
      lastWeek: t('Last week'),
    }),
    [t]
  );

  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={() => <NavigationAction icon="close" />}
        title={t(data.title)}
      />
      <LayoutCustom>
        <TabBar
          tabs={tabs}
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
        <LayoutCustom justify="center" itemsCenter pt={120}>
          <Spinner size="giant" />
        </LayoutCustom>
      ) : (
        <Content contentContainerStyle={styles.content}>
          <LayoutCustom gap={4} ph={24}>
            <Text category="c1" status="fade">
              Total
            </Text>
            <Text category="h4" status="basic">
              {data.amount}
            </Text>
          </LayoutCustom>
          <Content horizontal>
            <LayoutCustom mt={8} mb={24}>
              {DATA && (
                <VictoryChart
                  height={_heightChart}
                  padding={{ left: 48, bottom: 0, right: 40, top: 0 }}
                  width={DATA.length * (barWidth + betweenBarPadding)}>
                  <VictoryAxis label={t("Time (ms)")} />
                  <VictoryBar
                    events={[
                      {
                        target: 'data',
                        eventHandlers: {
                          onPressIn: () => {
                            return [
                              {
                                target: 'data',
                                eventKey: 'all',
                                mutation: () => ({
                                  style: { fill: '#414F5B' },
                                }),
                              },
                              {
                                target: 'labels',
                                eventKey: 'all',
                                mutation: () => ({
                                  style: {
                                    fill: 'transparent',
                                    fontSize: 12,
                                  },
                                }),
                              },
                              {
                                target: 'data',
                                mutation: () => ({
                                  style: { fill: '#FFFFFF' },
                                }),
                              },
                              {
                                target: 'labels',
                                mutation: () => ({
                                  style: {
                                    fill: '#122332',
                                    fontSize: 12,
                                  },
                                }),
                              },
                            ];
                          },
                          onPressOut: () => {
                            return [];
                          },
                        },
                      },
                    ]}
                    barWidth={barWidth}
                    data={DATA}
                    labelComponent={<VictoryLabel y={_heightChart} />}
                    labels={({ datum }) => dayjs(datum.x).format('DD')}
                    colorScale={'qualitative'}
                    x="fuk"
                    cornerRadius={{ bottom: 8, top: 8 }}
                    style={{
                      data: {
                        fill: '#414F5B',
                      },
                      labels: {
                        fill: 'transparent',
                        fontSize: 12,
                      },
                    }}
                  />
                </VictoryChart>
              )}
            </LayoutCustom>
          </Content>
          <LayoutCustom ph={16} gap={5}>
            <TransactionField
              dateLabel={formatDate(new Date(), { labels: dateLabels })}
              transactions={[]}
            />
            <TransactionField
              dateLabel={formatDate(dayjs().subtract(1, 'day').toDate(), {
                labels: dateLabels,
              })}
              transactions={[]}
            />
          </LayoutCustom>
        </Content>
      )}
    </Container>
  );
});

export default CategoryTransaction;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 24,
    paddingBottom: 60,
  },
});

const DATA = [
  { x: new Date(2023, 12, 5), y: 146 },
  { x: new Date(2023, 12, 6), y: 257 },
  { x: new Date(2023, 12, 7), y: 340 },
  { x: new Date(2023, 12, 8), y: 515 },
  { x: new Date(2023, 12, 9), y: 262 },
  { x: new Date(2023, 12, 10), y: 365 },
  { x: new Date(2023, 12, 11), y: 270 },
  { x: new Date(2023, 12, 12), y: 370 },
  { x: new Date(2023, 12, 13), y: 270 },
  { x: new Date(2023, 12, 14), y: 170 },
  { x: new Date(2023, 12, 15), y: 270 },
];
const tickes = DATA.map((item) => {
  return dayjs(item.x).format('DD');
  // return item/.x;
});
const tabs = [
  '01/2023',
  '02/2023',
  '03/2023',
  '04/2023',
  '05/2023',
  '06/2023',
  '07/2023',
  '08/2023',
  '09/2023',
  '10/2023',
  '11/2023',
  '12/2023',
];
