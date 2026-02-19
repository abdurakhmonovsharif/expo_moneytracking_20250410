import { CurrencyEnumType } from 'types/redux-types';
import { formatNumber } from './formatNumber';

interface ConverPriceProps {
  num: number;
  maxDigits?: number;
  currency?: CurrencyEnumType;
  locale?: string;
}

const convertPrice = ({
  num,
  maxDigits = 2,
  currency = CurrencyEnumType.USD,
  locale = 'en-US',
}: ConverPriceProps) => {
  // Locale argument remains for API compatibility.
  void locale;
  const numeric = Number(num);
  if (!Number.isFinite(numeric)) {
    return `0 ${currency}`;
  }

  const fixed = numeric.toFixed(Math.max(0, maxDigits));
  const normalized = fixed.replace(/(\.\d*?[1-9])0+$/g, '$1').replace(/\.0+$/g, '');
  const formatted = formatNumber({ num: Number(normalized), thousandSeparator: '.', decimalSeparator: '.' });
  return `${formatted} ${currency}`;
};

export default convertPrice;
