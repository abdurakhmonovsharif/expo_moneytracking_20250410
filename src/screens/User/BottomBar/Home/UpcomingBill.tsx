import React from 'react';
import { Image, ImageSourcePropType } from 'react-native';
// ----------------------------- UI kitten -----------------------------------
import { StyleService, useStyleSheet } from '@ui-kitten/components';
// ----------------------------- Components && Elements -----------------------
import { LayoutCustom, Text } from 'components';
import { useCurrencyFormatter } from 'hooks';

interface UpcomingBillProps {
  image: ImageSourcePropType;
  title: string;
  description: string;
  price: number;
}

const UpcomingBill: React.FC<{ data: UpcomingBillProps }> = ({ data }) => {
  const styles = useStyleSheet(themedStyles);
  const formatCurrency = useCurrencyFormatter();

  return (
    <LayoutCustom style={styles.container} horizontal justify="space-between">
      <LayoutCustom horizontal itemsCenter gap={8}>
        <Image source={data.image} />
        <LayoutCustom gap={5}>
          <Text category="h5" status="black">
            {data.title}
          </Text>
          <Text category="c1" status="chambrey">
            {data.description}
          </Text>
        </LayoutCustom>
      </LayoutCustom>
      <LayoutCustom style={styles.priceField}>
        <Text category="c1">{formatCurrency(data.price, 2)}</Text>
      </LayoutCustom>
    </LayoutCustom>
  );
};

export default UpcomingBill;

const themedStyles = StyleService.create({
  container: {
    padding: 24,
    backgroundColor: 'background-basic-color-12',
    borderRadius: 16,
    alignItems: 'flex-start',
  },
  priceField: {
    borderRadius: 99,
    backgroundColor: 'color-primary-default',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
