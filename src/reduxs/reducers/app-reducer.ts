import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../store";
import {
  IAppAlert,
  CurrencyEnumType,
  IAppState,
  IPlanBudgetProps,
  ITransactionProps,
  IWalletProps,
  IUserProfile,
} from "types/redux-types";
import { DEFAULT_LANGUAGE, LanguageCode } from "i18n/translations";

export const initialState: IAppState = {
  appLoading: false,
  pendingRequests: 0,
  alert: null,
  wallets: [],
  currency: CurrencyEnumType.USD,
  language: DEFAULT_LANGUAGE,
  fxRates: undefined,
  fxRatesUpdatedAt: undefined,
  fxRatesDate: undefined,
  fxPreviousDate: undefined,
  fxPreviousRates: undefined,
  fxRateDiffs: undefined,
  budget: undefined,
  user: undefined,
  permissions: undefined,
  permissionsPlan: undefined,
};

export const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    resetAppState: (state: IAppState) => ({
      ...initialState,
      appLoading: state.appLoading,
      pendingRequests: state.pendingRequests,
    }),
    setAppLoading: (state: IAppState, { payload }: PayloadAction<boolean>) => {
      state.appLoading = payload;
      if (!payload) {
        state.pendingRequests = 0;
      } else if (state.pendingRequests === 0) {
        state.pendingRequests = 1;
      }
    },
    beginAppRequest: (state: IAppState) => {
      state.pendingRequests += 1;
      state.appLoading = true;
    },
    endAppRequest: (state: IAppState) => {
      state.pendingRequests = Math.max(0, state.pendingRequests - 1);
      state.appLoading = state.pendingRequests > 0;
    },
    setAppAlert: (state: IAppState, { payload }: PayloadAction<IAppAlert | null>) => {
      state.alert = payload;
    },
    clearAlert: (state: IAppState) => {
      state.alert = null;
    },
    setUserProfile: (state, action: PayloadAction<IUserProfile | undefined>) => {
      state.user = action.payload;
    },
    setPermissions: (
      state,
      action: PayloadAction<
        {
          plan: string;
          permissions: Record<string, boolean | number | string>;
        } | undefined
      >
    ) => {
      state.permissions = action.payload?.permissions;
      state.permissionsPlan = action.payload?.plan;
    },
    setWallets: (state, action: PayloadAction<IWalletProps[]>) => {
      state.wallets = action.payload;
    },
    addWallet: (state, action: PayloadAction<IWalletProps>) => {
      state.wallets.push(action.payload);
    },
    setCurrency: (state, { payload }: PayloadAction<CurrencyEnumType>) => {
      state.currency = payload;
    },
    setLanguage: (state, { payload }: PayloadAction<LanguageCode>) => {
      state.language = payload;
    },
    setFxRates: (
      state,
      {
        payload,
      }: PayloadAction<{
        rates: Record<string, number>;
        updatedAt?: string;
        date?: string;
        previousDate?: string;
        previousRates?: Record<string, number>;
        deltaRates?: Record<string, number>;
      }>
    ) => {
      state.fxRates = payload.rates;
      state.fxRatesUpdatedAt = payload.updatedAt ?? new Date().toISOString();
      state.fxRatesDate = payload.date;
      state.fxPreviousDate = payload.previousDate;
      state.fxPreviousRates = payload.previousRates;
      state.fxRateDiffs = payload.deltaRates;
    },
    updateWallet: (
      state,
      action: PayloadAction<{ wallet: IWalletProps }>
    ) => {
      const { wallet } = action.payload;
      const walletIndex = state.wallets.findIndex(
        (w) => w.id === wallet.id
      );
      if (walletIndex !== -1) {
        state.wallets[walletIndex] = wallet;
      }
    },
    creatBudget: (state, { payload }: PayloadAction<IPlanBudgetProps>) => {
      state.budget = payload;
    },
    addTransaction: (
      state,
      action: PayloadAction<{
        walletIndex: number;
        transaction: ITransactionProps;
      }>
    ) => {
      const { walletIndex, transaction } = action.payload;
      const wallet = state.wallets[walletIndex];
      if (!wallet) {
        return;
      }
      if (!wallet.transaction) {
        wallet.transaction = [];
      }
      wallet.transaction.push(transaction);
    },
    updateTransaction: (
      state,
      action: PayloadAction<{
        walletIndex: number;
        transactionIndex: number;
        transaction: ITransactionProps;
      }>
    ) => {
      const { walletIndex, transactionIndex, transaction } = action.payload;
      const wallet = state.wallets[walletIndex];
      if (!wallet?.transaction?.[transactionIndex]) {
        return;
      }
      wallet.transaction[transactionIndex] = transaction;
    },
    removeWallet: (state, action: PayloadAction<number | string>) => {
      const walletId = action.payload;
      state.wallets = state.wallets.filter((wallet) => wallet.id !== walletId);
    },
  },
});

export const {
  resetAppState,
  setAppLoading,
  beginAppRequest,
  endAppRequest,
  setAppAlert,
  clearAlert,
  setUserProfile,
  setPermissions,
  setWallets,
  addWallet,
  updateWallet,
  updateTransaction,
  removeWallet,
  addTransaction,
  setCurrency,
  setLanguage,
  setFxRates,
  creatBudget,
} = appSlice.actions;

export const appSelector = (state: RootState) => state.app;

export default appSlice.reducer;
