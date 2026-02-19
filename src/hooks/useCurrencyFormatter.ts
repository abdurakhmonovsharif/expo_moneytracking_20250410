import React from 'react';
import { appSelector } from 'reduxs/reducers/app-reducer';
import { useAppSelector } from 'reduxs/store';
import convertPrice from 'utils/convertPrice';

const useCurrencyFormatter = () => {
  const currency = useAppSelector(appSelector).currency;
  return React.useCallback(
    (num: number, maxDigits: number = 2) => {
      return convertPrice({ num, maxDigits, currency });
    },
    [currency],
  );
};

export default useCurrencyFormatter;
