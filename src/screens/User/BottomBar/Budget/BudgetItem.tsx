import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

import { LayoutCustom, Text } from 'components';
import { IBudgetProps } from 'types/redux-types';
import { useStyleSheet, StyleService } from '@ui-kitten/components';
import { useCurrencyFormatter } from 'hooks';
import AnimatedCircularProgress from 'elements/CircleProgress/AnimatedCircularProgress';

const BudgetItem: React.FC<{ budget: IBudgetProps }> = ({ budget }) => {
  const { id, parentId, image, title, amount, balance, create_at } = budget;
  const styles = useStyleSheet(themedStyles);
  const formatCurrency = useCurrencyFormatter();
  const size = { width: 24, height: 24 };

  const fill = (amount / balance) * 100;

  const colors = ['#106AF3', '#00CD50', '#FFC107', '#C0A975', '#B1CEDE', '#DCDBB8'];

  function getRandomColor(colors: string[]) {
    const randomIndex = Math.floor(Math.random() * colors.length);
    return colors[randomIndex];
  }

  const randomColor = getRandomColor(colors);
  return (
    <LayoutCustom horizontal style={styles.container}>
      <LayoutCustom horizontal gap={12} itemsCenter>
        <Image source={image} style={size} />
        <Text category="h6">{title}</Text>
      </LayoutCustom>
      <LayoutCustom horizontal gap={12} itemsCenter>
        <Text category="subhead">{formatCurrency(balance, 2)}</Text>
        <AnimatedCircularProgress
          size={32}
          width={4}
          backgroundWidth={4}
          fill={fill}
          tintColor={randomColor}
          tintColorSecondary="#106AF3"
          backgroundColor="#2A3947"
          rotation={1}
          lineCap="round"
        />
      </LayoutCustom>
    </LayoutCustom>
  );
};

export default BudgetItem;

const themedStyles = StyleService.create({
  container: {
    paddingBottom: 17,
    justifyContent: 'space-between',
    flex: 1,
    marginBottom: 24,
  },
});
