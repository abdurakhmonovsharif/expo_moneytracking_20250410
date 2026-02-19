import React from 'react';
import { Image } from 'react-native';
// ----------------------------- UI kitten -----------------------------------
import { StyleService, useStyleSheet, Button } from '@ui-kitten/components';
// ----------------------------- Navigation -----------------------------------
import { NavigationProp, useNavigation } from '@react-navigation/native';
// ----------------------------- Hooks ---------------------------------------
import { useLayout } from 'hooks';
// ----------------------------- Assets ---------------------------------------
import { Images } from 'assets/images';
// ----------------------------- Components && Elements -----------------------
import { LayoutCustom, Text } from 'components';
import { RootStackParamList } from 'types/navigation-types';
import { useTranslation } from 'i18n/useTranslation';

const EmptyBudget = React.memo(() => {
  const styles = useStyleSheet(themedStyles);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const { width } = useLayout();
  const { t } = useTranslation();

  const size = 155 * (width / 375);
  const size_img = { width: size, height: size, alignSelf: 'center' as const };

  return (
    <LayoutCustom style={styles.container}>
      <Image source={Images.budget} style={size_img} />
      <Text category="h3" center marginTop={12}>
        Create your budget
      </Text>
      <Text status="content" center>
        A budget app that helps you plan your income and expenses and achieve your financial goals
      </Text>
      <Button
        style={styles.button}
        children={t('Create new budget')}
        onPress={() => {
          navigate('NewBudget');
        }}
      />
    </LayoutCustom>
  );
});

export default EmptyBudget;

const themedStyles = StyleService.create({
  container: {
    paddingTop: 40,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  button: {
    flex: 1,
    marginTop: 24,
  },
});
