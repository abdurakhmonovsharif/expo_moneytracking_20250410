import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
// ----------------------------- UI kitten -----------------------------------
import { TopNavigation, StyleService, useStyleSheet, useTheme } from '@ui-kitten/components';
// ----------------------------- Navigation -----------------------------------
import { NavigationProp, useNavigation } from '@react-navigation/native';
// ----------------------------- Hooks ---------------------------------------
import { useLayout } from 'hooks';
// ----------------------------- Assets ---------------------------------------
import { Images } from 'assets/images';
// ----------------------------- Components && Elements -----------------------

import { LayoutCustom, Content, Text } from 'components';

const EmptyWallet = React.memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { goBack } = useNavigation();
  const { height, width, top, bottom } = useLayout();

  const size = { width: 160, height: 160 };
  return (
    <LayoutCustom style={styles.container}>
      <Image source={Images.empty_wallet} style={size} />
      <Text category="h3"center>Empty History</Text>
      <Text status="content" center>Please create new wallet or add expense manual</Text>
    </LayoutCustom>
  );
});

export default EmptyWallet;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 48,
  },
});
