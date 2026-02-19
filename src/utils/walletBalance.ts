import {
  ITransactionProps,
  IWalletProps,
  TransactionEnumType,
} from "types/redux-types";

type ConvertAmount = (amount: number, fromCurrency?: string | null) => number;

const toSafeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getWalletNetBalance = (
  wallet: IWalletProps,
  convert: ConvertAmount
): number => {
  const baseBalance = convert(toSafeNumber(wallet.balance), wallet.currency as string);
  const transactionDelta = (wallet.transaction ?? []).reduce((sum, transaction) => {
    const convertedAmount = convert(
      toSafeNumber(transaction.balance),
      transaction.currency as string
    );

    if (transaction.type === TransactionEnumType.INCOME) {
      return sum + convertedAmount;
    }
    if (transaction.type === TransactionEnumType.EXPENSESE) {
      return sum - convertedAmount;
    }
    return sum;
  }, 0);

  return baseBalance + transactionDelta;
};

export const getWalletsNetBalance = (
  wallets: IWalletProps[],
  convert: ConvertAmount
): number => {
  return wallets.reduce((sum, wallet) => {
    return sum + getWalletNetBalance(wallet, convert);
  }, 0);
};

