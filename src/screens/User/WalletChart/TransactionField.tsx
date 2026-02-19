import React from 'react';
import { Image } from 'react-native';
// ----------------------------- UI kitten -----------------------------------
import { StyleService, useStyleSheet } from '@ui-kitten/components';
// ----------------------------- Components && Elements -----------------------
import { LayoutCustom, LinearGradientText, IDivider, Text } from 'components';
import { useCurrencyConversion, useCurrencyFormatter } from 'hooks';
import { IMAGE_ICON_CATEGORY } from 'assets/IconCategory';
import { ITransactionProps, TransactionEnumType } from 'types/redux-types';
import dayjs from 'dayjs';

interface TransactionFieldProps {
  dateLabel: string;
  transactions: ITransactionProps[];
  walletTitle?: string;
}

const TransactionField = React.memo(({ dateLabel, transactions, walletTitle }: TransactionFieldProps) => {
  const styles = useStyleSheet(themedStyles);
  const formatCurrency = useCurrencyFormatter();
  const { convert } = useCurrencyConversion();
  const toDate = (value: any): Date => {
    if (!value) return new Date(0);
    if (value instanceof Date) return value;
    if (typeof value === 'string') return new Date(value);
    if (typeof value === 'object' && typeof value.toDate === 'function') {
      return value.toDate();
    }
    return new Date(value);
  };

  const totalExpenses = transactions.reduce((sum, transaction) => {
    return transaction.type === TransactionEnumType.EXPENSESE
      ? sum + convert(transaction.balance, transaction.currency)
      : sum;
  }, 0);
  const totalIncome = transactions.reduce((sum, transaction) => {
    return transaction.type === TransactionEnumType.INCOME
      ? sum + convert(transaction.balance, transaction.currency)
      : sum;
  }, 0);

  const netTotal = totalIncome - totalExpenses;

  return (
    <LayoutCustom style={styles.container} level="2">
      <LayoutCustom horizontal itemsCenter justify="space-between">
        <LinearGradientText text={dateLabel} category="h5" />
        <Text category="h5" status="warning">
          {formatCurrency(netTotal, 2)}
        </Text>
      </LayoutCustom>
      <IDivider marginVertical={16} />
      <LayoutCustom gap={16}>
        {transactions.length === 0 ? (
          <Text category="c1" status="content">
            No transactions.
          </Text>
        ) : (
          transactions.map((trans, index) => {
            return (
              <LayoutCustom key={`${trans.id}-${index}`}>
                <LayoutCustom gap={12} horizontal>
                  <Image
                    source={IMAGE_ICON_CATEGORY[trans.category.icon]}
                    //@ts-ignore
                    style={styles.categoryImg}
                  />
                  <LayoutCustom style={{ flex: 1 }} gap={8}>
                    <LayoutCustom horizontal justify="space-between">
                      <Text category="subhead">{trans.category.name}</Text>
                      <Text category="h6">
                        {formatCurrency(convert(trans.balance, trans.currency), 2)}
                      </Text>
                    </LayoutCustom>
                    <LayoutCustom horizontal justify="space-between">
                      {walletTitle && (
                        <Text category="c1" status="content">
                          {walletTitle}
                        </Text>
                      )}
                      <Text category="c2" opacity={0.5}>
                        {dayjs(toDate(trans.date)).format('DD/MM/YYYY HH:mm')}
                      </Text>
                    </LayoutCustom>
                  </LayoutCustom>
                </LayoutCustom>
                {index < transactions.length - 1 && (
                  <IDivider marginLeft={44} marginTop={16} />
                )}
              </LayoutCustom>
            );
          })
        )}
      </LayoutCustom>
    </LayoutCustom>
  );
});

export default TransactionField;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
  },
  content: {},
});
