import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';

import Text from './Text';
import { LinearGradient } from 'expo-linear-gradient';
import { appSelector } from 'reduxs/reducers/app-reducer';
import { useAppSelector } from 'reduxs/store';

interface TagCurrencyProps {
  style?: StyleProp<ViewStyle>;
}

const TagCurrency: React.FC<TagCurrencyProps> = ({ style }) => {
  const _currency = useAppSelector(appSelector).currency;
  const state = {
    colors: ['#CFE1FD', '#FFFDE1'] as [string, string],
    start: { x: 1, y: 1 },
    end: { x: 0, y: 0.33 },
  };
  return (
    <View style={style}>
      <LinearGradient {...state} style={styles.container}>
        <Text status="black" category="h6">
          {_currency}
        </Text>
      </LinearGradient>
    </View>
  );
};

export default TagCurrency;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
});
