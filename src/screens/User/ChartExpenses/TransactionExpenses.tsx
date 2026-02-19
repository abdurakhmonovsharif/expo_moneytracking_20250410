import React from 'react';
import { Image, StyleSheet, ImageSourcePropType } from 'react-native';

import { Text, LayoutCustom } from 'components';
import { useLayout } from 'hooks';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from 'types/navigation-types';

interface TransactionExpensesProps {
  data: {
    image: ImageSourcePropType;
    title: string;
    amount: string;
  };
  label: string;
}

const TransactionExpenses: React.FC<TransactionExpensesProps> = ({ data, label }) => {
  const { image, title, amount } = data;
  const { width } = useLayout();
  const {navigate}=useNavigation<NavigationProp<RootStackParamList>>()
  return (
    <LayoutCustom style={[styles.container, { width: (width - 40) / 2 }]} level="2" onPress={()=>{navigate('CategoryTransaction',{title:data.title,amount:data.amount})}}>
      <LayoutCustom horizontal itemsCenter gap={8} mb={24}>
        <Image source={image} style={styles.icon} />
        <Text>{title}</Text>
      </LayoutCustom>
      <Text category="h4" status="caption" marginBottom={4}>
        {amount}
      </Text>
      <Text category="h5" status="warning">
        {label}
      </Text>
    </LayoutCustom>
  );
};

export default TransactionExpenses;

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
