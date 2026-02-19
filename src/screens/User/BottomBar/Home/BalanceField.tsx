import React from 'react';
import { LayoutCustom, Text } from 'components';
import { IWalletProps, TransactionEnumType } from 'types/redux-types';
import { Icon, StyleService, useStyleSheet } from '@ui-kitten/components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from 'types/navigation-types';
import { useCurrencyFormatter } from 'hooks';
import { useCurrencyConversion } from 'hooks';

interface BalanceFieldProps {
  data: IWalletProps[];
}

const BalanceField: React.FC<BalanceFieldProps> = ({ data }) => {
  const styles = useStyleSheet(themedStyles);
  const {navigate}=useNavigation<NavigationProp<RootStackParamList>>()
  const formatCurrency = useCurrencyFormatter();
  const { convert } = useCurrencyConversion();

  const sumTransactionsByType = (wallets: IWalletProps[], type: TransactionEnumType): number => {
    return wallets.reduce((total, wallet) => {
      const transactionsOfType = (wallet.transaction ?? []).filter(
        (transaction) => transaction.type === type,
      );
      const sumOfType = transactionsOfType.reduce(
        (subtotal, transaction) =>
          subtotal + convert(transaction.balance, transaction.currency),
        0,
      );
      return total + sumOfType;
    }, 0);
  };
  const totalIncome = sumTransactionsByType(data, TransactionEnumType.INCOME);
  const totalExpenses = sumTransactionsByType(data, TransactionEnumType.EXPENSESE);
  return (
    <LayoutCustom style={styles.container} horizontal>
      <LayoutCustom style={styles.income} onPress={()=>{navigate('ChartIncome')}}>
        <Icon pack="assets" name={'arrow-up'} />
        <LayoutCustom>
          <Text category="subhead">Income</Text>
          <Text category="h5">{formatCurrency(totalIncome, 2)}</Text>
        </LayoutCustom>
      </LayoutCustom>
      <LayoutCustom style={styles.outcome} onPress={()=>{navigate('ChartExpenses')}}>
        <Icon pack="assets" name={'arrow-down'} />
        <LayoutCustom>
          <Text category="subhead">Expenses</Text>
          <Text category="h5">{formatCurrency(totalExpenses, 2)}</Text>
        </LayoutCustom>
      </LayoutCustom>
    </LayoutCustom>
  );
};

export default BalanceField;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    gap: 11,
  },
  income: {
    flex: 1,
    backgroundColor: 'color-primary-default',
    borderRadius: 16,
    gap: 32,
    padding: 16,
  },
  outcome: {
    flex: 1,
    backgroundColor: 'color-danger-default',
    borderRadius: 16,
    gap: 32,
    padding: 16,
  },
});
