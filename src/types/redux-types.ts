import { ImageSourcePropType } from 'react-native';
import { LanguageCode } from 'i18n/translations';

export enum BudgetEnumType {
  MONTHLY = 'Monthly',
  YEARLY = 'Yearly',
  WEEKLY = 'Weekly',
}

export enum TransactionEnumType {
  INCOME = 'income',
  EXPENSESE = 'expensese',
}
export const CurrencyEnumType = {
  USD: 'USD',
  ARS: 'ARS',
  GBP: 'GBP',
  JPY: 'JPY',
  INR: 'INR',
  VND: 'VND',
} as const;

export type CurrencyEnumType =
  | (typeof CurrencyEnumType)[keyof typeof CurrencyEnumType]
  | string;

export interface IUserProfile {
  uid: string;
  name: string;
  email?: string | null;
  photo_url?: string | null;
  plan?: string;
  is_premium?: boolean;
  premium_until?: string | null;
  premium_status?: string | null;
  premium_since?: string | null;
  premium_source?: string | null;
}

export type AppAlertType = 'notification' | 'success' | 'error';

export interface IAppAlert {
  type: AppAlertType;
  title: string;
  message: string;
}

export interface INoteTransactionProps {
  textNote?: string;
  images?: ImageSourcePropType | undefined;
  imageKey?: string;
}
export interface SimpleCategoryProps {
  id: number | string;
  parentId: number | string;
  name: string;
  icon: string;
}

export interface ICategoryProps extends SimpleCategoryProps {
  children?: SimpleCategoryProps[] | undefined;
}

export interface ITransactionProps {
  id: number | string;
  userId: number | string;
  walletId: number | string;
  categoryId: number | string;
  balance: number;
  date: string | Date;
  type: TransactionEnumType;
  currency?: CurrencyEnumType;
  note?: INoteTransactionProps | undefined;
  category: ICategoryProps;
}
export interface IWalletProps {
  id: number | string;
  symbol: string;
  title: string;
  image?: string | null;
  balance: number;
  currency?: CurrencyEnumType;
  transaction?: ITransactionProps[] | undefined;
}

export interface IBudgetProps {
  id: string | number;
  parentId: string | number;
  image: ImageSourcePropType;
  imageKey?: string;
  title: string;
  amount: number;
  balance: number;
  create_at: Date;
}
export interface IPlanBudgetProps {
  id: string | number;
  type: BudgetEnumType;
  transactions: ITransactionProps[];
  budgets: IBudgetProps[];
  create_at: Date;
}

export interface IAppState {
  appLoading: boolean;
  pendingRequests: number;
  alert: IAppAlert | null;
  wallets: Array<IWalletProps>;
  currency: CurrencyEnumType;
  language: LanguageCode;
  fxRates?: Record<string, number>;
  fxRatesUpdatedAt?: string;
  fxRatesDate?: string;
  fxPreviousDate?: string;
  fxPreviousRates?: Record<string, number>;
  fxRateDiffs?: Record<string, number>;
  budget?: IPlanBudgetProps | undefined;
  user?: IUserProfile;
  permissions?: Record<string, boolean | number | string>;
  permissionsPlan?: string;
}
