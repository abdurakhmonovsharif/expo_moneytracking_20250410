import { NavigatorScreenParams } from "@react-navigation/native";
import { IWalletProps } from "./redux-types";

export type RootStackParamList = {
  SplashScreen: undefined;
  BottomBar: NavigatorScreenParams<BottomBarStackParamList> | undefined;
  EmailLogin: undefined;
  EmailSignUp: undefined;

  // --------------- Budget ----------------
  NewBudget: undefined;
  // --------------- Wallet ----------------
  NewWallet: undefined;
  NewTransaction: undefined;
  // --------------- Profile ----------------
  RemoveProfileWallet: undefined;
  CurrencyScreen: undefined;
  LanguageScreen: undefined;
  Notifications: undefined;
  GetPremium: undefined;
  SuccessBudget: undefined;
  WalletChart: { walletId: number | string };
  ChartExpenses: undefined;
  ChartIncome: undefined;
  CategoryTransaction: { title: string; amount: string };
  DetailsWallet: { wallet: IWalletProps };
  RecurringBilling: undefined;
};

export type BottomBarStackParamList = {
  Home: undefined;
  Profile: undefined;
  Budget: undefined;
  Wallet: undefined;
};

export type NewWalletStackParamList = {
  AuthIntro: undefined;
};
