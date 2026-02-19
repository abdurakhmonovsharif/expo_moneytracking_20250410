import React from 'react';
import { Alert } from 'react-native';

// ----------------------------- UI kitten -----------------------------------
import { TopNavigation, Input, StyleService, Icon, useStyleSheet, useTheme } from '@ui-kitten/components';

// ----------------------------- Components && Elements -----------------------
import { Container, Content, LayoutCustom, NavigationAction, Text } from 'components';

// ----------------------------- Reduxs ---------------------------------------
import { useAppDispatch, useAppSelector } from 'reduxs/store';
import { appSelector, setCurrency, setFxRates } from 'reduxs/reducers/app-reducer';

// ----------------------------- Types -----------------------------------
import { useNavigation } from '@react-navigation/native';
import { setUserCurrency } from 'services/userData';
import { CURRENCIES } from 'constants/currencies';
import { useTranslation } from 'i18n/useTranslation';
import { CurrencyEnumType } from 'types/redux-types';
import { loadFxRates } from 'services/fxRates';
import { runWithAppRequest } from 'reduxs/requestLoading';

const CurrencyScreen = React.memo(() => {
  const theme = useTheme();
  const {goBack}=useNavigation()
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation();
  const [query, setQuery] = React.useState('');
  const [updating, setUpdating] = React.useState(false);

  const currency = useAppSelector(appSelector).currency;
  const dispatch = useAppDispatch();
  const handleSelectCurrency = async (nextCurrency: CurrencyEnumType) => {
    if (updating || currency === nextCurrency) {
      return;
    }
    setUpdating(true);
    try {
      await runWithAppRequest(async () => {
        await setUserCurrency(nextCurrency);
        dispatch(setCurrency(nextCurrency));
        const rates = await loadFxRates(true).catch(() => null);
        if (rates?.rates) {
          dispatch(
            setFxRates({
              rates: rates.rates,
              updatedAt: rates.updatedAt,
              date: rates.date,
              previousDate: rates.previousDate,
              previousRates: rates.previousRates,
              deltaRates: rates.deltaRates,
            })
          );
        }
      });
      goBack();
    } catch (err: any) {
      Alert.alert(t('Update currency failed'), err?.message ?? t('Please try again.'));
    } finally {
      setUpdating(false);
    }
  };
  const normalizedQuery = query.trim().toLowerCase();
  const filteredData = normalizedQuery
    ? CURRENCIES.filter((item) => {
        return (
          item.name.toLowerCase().includes(normalizedQuery) ||
          item.code.toLowerCase().includes(normalizedQuery)
        );
      })
    : CURRENCIES;

  return (
    <Container style={styles.container}>
      <TopNavigation
        alignment="center"
        title={t('Currency')}
        accessoryLeft={() => <NavigationAction />}
      />
      <Content contentContainerStyle={styles.content}>
        <Input
          style={styles.input}
          placeholder={t('Search currency')}
          accessoryLeft={<Icon pack="assets" name="search" />}
          value={query}
          onChangeText={setQuery}
        />
        <LayoutCustom gap={24} mh={8}>
          {filteredData.map((item, index) => {
            const isActive = currency === item.code;
            return (
              <LayoutCustom
                key={index}
                horizontal
                justify="space-between"
                onPress={() => handleSelectCurrency(item.code)}
              >
                <LayoutCustom>
                  <Text category="h4" status={isActive ? 'primary' : 'basic'}>
                    {item.name}
                  </Text>
                  <Text category="c1" style={{ color: theme['color-basic-1000'] }}>
                    {t('Currency code')}: {item.code}
                  </Text>
                </LayoutCustom>
                <Text category="h4" status={isActive ? 'primary' : 'basic'}>
                  {item.code}
                </Text>
              </LayoutCustom>
            );
          })}
        </LayoutCustom>
      </Content>
    </Container>
  );
});

export default CurrencyScreen;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    gap: 24,
    paddingHorizontal: 16,
  },
  input: {},
});
