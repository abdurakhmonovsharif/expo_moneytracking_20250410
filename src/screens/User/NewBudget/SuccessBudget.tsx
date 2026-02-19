import React from 'react';
import { Image } from 'react-native';
// ----------------------------- UI kitten -----------------------------------
import {
  TopNavigation,
  Button,
  StyleService,
  useStyleSheet,
  useTheme,
} from '@ui-kitten/components';
// ----------------------------- Navigation -----------------------------------
import { NavigationProp, useNavigation } from '@react-navigation/native';
// ----------------------------- Hooks ---------------------------------------
import { useLayout } from 'hooks';
// ----------------------------- Assets ---------------------------------------
import { Images } from 'assets/images';
// ----------------------------- Components && Elements -----------------------

import { Container, Content, LayoutCustom, NavigationAction, Text } from 'components';
import { useAppSelector } from 'reduxs/store';
import { appSelector } from 'reduxs/reducers/app-reducer';
import CustomBudget from './CustomBudget';
import { RootStackParamList } from 'types/navigation-types';
import { useTranslation } from 'i18n/useTranslation';

const SuccessBudget = React.memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const { height, width, top, bottom } = useLayout();
  const budget = useAppSelector(appSelector).budget;
  const { t } = useTranslation();

  const _onAddTransaction = () => {navigate('BottomBar',{screen:"Home"})};
  return (
    <Container style={styles.container}>
      <Image
        source={Images.firework}
        //@ts-ignore
        style={{ width: width, height: 250 * (height / 812), ...styles.firework }}
      />
      <TopNavigation
        alignment="center"
        appearance="control"
        accessoryRight={() => <NavigationAction icon={'close'} marginRight={8} />}
      />
      <Content contentContainerStyle={styles.content}>
        <LayoutCustom gap={12} mt={40}>
          <Text category="h3" center>
            Plan created!
          </Text>
          <LayoutCustom itemsCenter horizontal gap={2} alignSelfCenter>
            <Text category="body" status="content">
              Your planned spending
            </Text>
            <Text category="h5">Monthly</Text>
            <Text category="body" status="content">
              is $2,468
            </Text>
          </LayoutCustom>
        </LayoutCustom>
        <LayoutCustom mh={24} mt={48}>
          {budget?.budgets &&
            budget.budgets.map((budget, index) => {
              return <CustomBudget key={index} budget={budget} />;
            })}
        </LayoutCustom>
      </Content>
      <LayoutCustom pv={4} ph={16}>
        <Button children={t("Add transaction")} onPress={_onAddTransaction} />
      </LayoutCustom>
    </Container>
  );
});

export default SuccessBudget;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {},
  firework: {
    position: 'absolute',
  },
});
