import React from 'react';
import { appSelector } from 'reduxs/reducers/app-reducer';
import { useAppSelector } from 'reduxs/store';
import { CurrencyEnumType } from 'types/redux-types';

const normalizeCode = (code?: CurrencyEnumType | string | null) =>
  (code ?? '').toString().trim().toUpperCase();

export const useCurrencyConversion = () => {
  const { currency, fxRates } = useAppSelector(appSelector);
  const targetCurrency = normalizeCode(currency);

  const convert = React.useCallback(
    (amount: number, fromCurrency?: CurrencyEnumType | string | null) => {
      const from = normalizeCode(fromCurrency || targetCurrency);
      const to = targetCurrency;
      if (!amount || from === to || !fxRates) {
        return amount;
      }

      const fromRate = from === 'UZS' ? 1 : fxRates[from];
      const toRate = to === 'UZS' ? 1 : fxRates[to];
      if (!fromRate || !toRate) {
        return amount;
      }
      return (Number(amount) * fromRate) / toRate;
    },
    [fxRates, targetCurrency]
  );

  return { convert, currency: targetCurrency, fxRates };
};
