import React from 'react';
import { Image } from 'react-native';

import { LayoutCustom, Text } from 'components';
import { IBudgetProps } from 'types/redux-types';
import { useStyleSheet, StyleService } from '@ui-kitten/components';
import { useCurrencyFormatter } from 'hooks';

const CustomBudget: React.FC<{ budget: IBudgetProps }> = ({ budget }) => {
  const { id, parentId, image, title, amount, balance, create_at } = budget;
  const styles = useStyleSheet(themedStyles);
  const formatCurrency = useCurrencyFormatter();
  const size = { width: 24, height: 24 };

  return (
    <LayoutCustom horizontal style={styles.container}>
      <LayoutCustom horizontal gap={12} itemsCenter>
        <Image source={image} style={size} />
        <Text category="h6">{title}</Text>
      </LayoutCustom>
      <LayoutCustom horizontal gap={12} itemsCenter style={styles.balance}>
        <Text category="subhead">{formatCurrency(balance, 2)}</Text>
      </LayoutCustom>
    </LayoutCustom>
  );
};

export default CustomBudget;

const themedStyles = StyleService.create({
  container: {
    paddingBottom: 17,
    justifyContent: 'space-between',
    flex: 1,
    marginBottom: 24,
  },
  balance: {
    backgroundColor: 'background-basic-color-2',
    padding: 8,
    borderRadius: 8,
  },
});
