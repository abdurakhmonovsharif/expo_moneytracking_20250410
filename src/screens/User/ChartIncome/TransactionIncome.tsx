import React from 'react';
import { Image, StyleSheet, ImageSourcePropType } from 'react-native';

import { Text, LayoutCustom } from 'components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from 'types/navigation-types';

interface TransactionIncomeProps {
  label: string;
  data: {
    image: ImageSourcePropType;
    title: string;
    amount: string;
  };
}

const TransactionIncome: React.FC<TransactionIncomeProps> = ({ data, label }) => {
  const { image, title, amount } = data;
  const {navigate}=useNavigation<NavigationProp<RootStackParamList>>()
  return (
    <LayoutCustom style={styles.container} level="2" onPress={()=>{navigate('CategoryTransaction',{title:data.title,amount:data.amount})}}>
      <LayoutCustom horizontal itemsCenter justify="space-between" mb={4}>
        <LayoutCustom horizontal itemsCenter gap={8}>
          <Image source={image} style={styles.icon} />
          <Text>{title}</Text>
        </LayoutCustom>
        <Text category="h4" status='caption'>{amount}</Text>
      </LayoutCustom>
      <LayoutCustom horizontal itemsCenter justify="space-between">
        <Text category="h5"></Text>
        <Text category="h5" status="warning">
          {label}
        </Text>
      </LayoutCustom>
    </LayoutCustom>
  );
};

export default TransactionIncome;

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
  },
  icon: {
    width: 20,
    height: 20,
  },
});
