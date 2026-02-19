import Text from 'components/Text';
import React from 'react';
import { View, ViewStyle, StyleProp, TouchableOpacity } from 'react-native';
import { StyleService, useStyleSheet } from '@ui-kitten/components';

interface Props {
  style?: StyleProp<ViewStyle>;
  tabStyle?: StyleProp<ViewStyle>;
  onChangeTab: (index: number) => void;
  tabActive: number;
}
const TabBarWallet = ({ onChangeTab, style, tabStyle, tabActive }: Props) => {
  const _onChangeTab = React.useCallback(
    (number: number) => {
      onChangeTab(number);
    },
    [onChangeTab],
  );
  const styles = useStyleSheet(themedStyles);
  const tabs = ['Expense', 'Income'];
  const activeColors = ['#E30147', '#106AF3'];
  return (
    <View style={[styles.container, style]}>
      {tabs?.map((item, index) => {
        const backgroundTabActive = activeColors[index];
        const backgroundColor = {
          backgroundColor: tabActive === index ? backgroundTabActive : undefined,
        };
        return (
          <TouchableOpacity
            onPress={() => _onChangeTab(index)}
            key={index}
            style={[styles.tabStyle, backgroundColor, tabStyle]}>
            <Text capitalize center category="subhead" children={item} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
export default TabBarWallet;

const themedStyles = StyleService.create({
  container: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 2,
    backgroundColor: 'background-basic-color-2',
  },
  tabStyle: {
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    flex: 1,
    borderWidth: 0,
  },
});
