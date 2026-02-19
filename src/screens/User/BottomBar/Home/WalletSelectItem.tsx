import React from 'react';
import { Image } from 'react-native';
import { LayoutCustom, LinearGradientText, Text } from 'components';
import { IWalletProps } from 'types/redux-types';
import { StyleService, Icon, useStyleSheet } from '@ui-kitten/components';
import { useCurrencyConversion, useCurrencyFormatter } from 'hooks';
import { getWalletNetBalance } from 'utils';

interface IWalletPropsProps {
  item: IWalletProps;
  onPress?():void
}

const WalletSelectItem: React.FC<IWalletPropsProps> = ({ item ,onPress}) => {
  const styles = useStyleSheet(themedStyles);
  const formatCurrency = useCurrencyFormatter();
  const { convert } = useCurrencyConversion();
  const walletBalance = getWalletNetBalance(item, convert);

  const { title } = item;
  return (
    <LayoutCustom style={styles.container} horizontal justify="center"onPress={onPress}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.image as any} />
      ) : (
        <Icon pack="assets" name={'cardholder'} />
      )}
      <LayoutCustom style={{ flex: 1, gap: 4 }}>
        <LinearGradientText text={title} category="h5" />
        <Text category="subhead">{formatCurrency(walletBalance)}</Text>
      </LayoutCustom>
    </LayoutCustom>
  );
};

export default WalletSelectItem;

const themedStyles = StyleService.create({
  container: {
    width: '100%',
    backgroundColor: 'background-basic-color-2',
    borderRadius: 16,
    marginBottom: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  icon: {
    width: 28,
    height: 28,
    tintColor: '#B1CEDE',
  },
  image: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});
