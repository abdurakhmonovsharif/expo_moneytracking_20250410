import React from 'react';
import { Alert } from 'react-native';
import { TopNavigation, Input, StyleService, Icon, useStyleSheet, useTheme } from '@ui-kitten/components';
import { Container, Content, LayoutCustom, NavigationAction, Text } from 'components';
import { useAppDispatch, useAppSelector } from 'reduxs/store';
import { appSelector, setLanguage } from 'reduxs/reducers/app-reducer';
import { useNavigation } from '@react-navigation/native';
import { setUserLanguage } from 'services/userData';
import { LANGUAGES, LanguageCode } from 'i18n/translations';
import { useTranslation } from 'i18n/useTranslation';
import { runWithAppRequest } from 'reduxs/requestLoading';

const LanguageScreen = React.memo(() => {
  const theme = useTheme();
  const { goBack } = useNavigation();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation();
  const [query, setQuery] = React.useState('');
  const [updating, setUpdating] = React.useState(false);

  const language = useAppSelector(appSelector).language;
  const dispatch = useAppDispatch();

  const handleSelectLanguage = async (nextLanguage: LanguageCode) => {
    if (updating || language === nextLanguage) {
      return;
    }
    setUpdating(true);
    try {
      await runWithAppRequest(async () => {
        await setUserLanguage(nextLanguage);
        dispatch(setLanguage(nextLanguage));
      });
      goBack();
    } catch (err: any) {
      Alert.alert(
        t('Update language failed'),
        err?.message ?? t('Please try again.')
      );
    } finally {
      setUpdating(false);
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const filteredData = normalizedQuery
    ? LANGUAGES.filter((item) => {
        return (
          item.label.toLowerCase().includes(normalizedQuery) ||
          item.nativeLabel.toLowerCase().includes(normalizedQuery) ||
          item.code.toLowerCase().includes(normalizedQuery)
        );
      })
    : LANGUAGES;

  return (
    <Container style={styles.container}>
      <TopNavigation
        alignment="center"
        title={t('Language')}
        accessoryLeft={() => <NavigationAction />}
      />
      <Content contentContainerStyle={styles.content}>
        <Input
          style={styles.input}
          placeholder={t('Search language')}
          accessoryLeft={<Icon pack="assets" name="search" />}
          value={query}
          onChangeText={setQuery}
        />
        <LayoutCustom gap={24} mh={8}>
          {filteredData.map((item, index) => {
            const isActive = language === item.code;
            return (
              <LayoutCustom
                key={index}
                horizontal
                justify="space-between"
                onPress={() => handleSelectLanguage(item.code)}
              >
                <LayoutCustom>
                  <Text category="h4" status={isActive ? 'primary' : 'basic'}>
                    {item.nativeLabel}
                  </Text>
                  <Text category="c1" style={{ color: theme['color-basic-1000'] }}>
                    {item.label}
                  </Text>
                </LayoutCustom>
                <Text category="h4" status={isActive ? 'primary' : 'basic'}>
                  {item.code.toUpperCase()}
                </Text>
              </LayoutCustom>
            );
          })}
        </LayoutCustom>
      </Content>
    </Container>
  );
});

export default LanguageScreen;

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
