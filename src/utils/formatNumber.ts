interface IFormatNumberProps {
  num: number;
  decimalSeparator?: string;
  thousandSeparator?: string;
  locale?: string;
}

const countSeparator = (value: string, separator: string): number => {
  return (value.match(new RegExp(`\\${separator}`, 'g')) || []).length;
};

const normalizeFromSingleSeparator = (value: string, separator: '.' | ','): string => {
  const parts = value.split(separator);
  if (parts.length === 1) {
    return parts[0];
  }
  if (parts.length > 2) {
    return parts.join('');
  }
  const integerPart = parts[0];
  const decimalPart = parts[1];
  if (decimalPart.length === 3 && integerPart.length > 0) {
    // Treat `1.000` / `1,000` as thousand-grouped value.
    return `${integerPart}${decimalPart}`;
  }
  return `${integerPart}.${decimalPart}`;
};

const toNumber = (value: number | string): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const compact = String(value).trim().replace(/\s/g, '');
  if (!compact) {
    return 0;
  }

  const negative = compact.startsWith('-');
  const unsigned = compact.replace(/-/g, '').replace(/[^\d.,]/g, '');
  if (!unsigned) {
    return 0;
  }

  const dotCount = countSeparator(unsigned, '.');
  const commaCount = countSeparator(unsigned, ',');

  let normalized = unsigned;
  if (dotCount > 0 && commaCount === 0) {
    normalized = normalizeFromSingleSeparator(unsigned, '.');
  } else if (commaCount > 0 && dotCount === 0) {
    normalized = normalizeFromSingleSeparator(unsigned, ',');
  } else if (dotCount > 0 && commaCount > 0) {
    const decimalSeparator = unsigned.lastIndexOf('.') > unsigned.lastIndexOf(',') ? '.' : ',';
    const chunks = unsigned.split(decimalSeparator);
    const decimalPart = (chunks.pop() || '').replace(/[^\d]/g, '');
    const integerPart = chunks.join(decimalSeparator).replace(/[.,]/g, '');
    normalized = `${integerPart || '0'}${decimalPart ? `.${decimalPart}` : ''}`;
  } else {
    normalized = unsigned;
  }

  const parsed = Number(`${negative ? '-' : ''}${normalized}`);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function formatNumber({
  num,
  decimalSeparator = '.',
  thousandSeparator = '.',
  locale,
}: IFormatNumberProps): string {
  // Kept for backwards compatibility, but display format is now standardized.
  void locale;

  if (!Number.isFinite(num)) {
    return '0';
  }

  const sign = num < 0 ? '-' : '';
  const [integerPartRaw, decimalPartRaw] = Math.abs(num).toString().split('.');
  const shouldGroup = !(thousandSeparator === decimalSeparator && decimalPartRaw);
  const groupedInteger = shouldGroup
    ? integerPartRaw.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator)
    : integerPartRaw;

  return sign + groupedInteger + (decimalPartRaw ? `${decimalSeparator}${decimalPartRaw}` : '');
}

export const formatDefault = (
  value: number | string,
  currencySymbol = '',
  locale?: string
) => {
  const num = toNumber(value);
  const formatted = formatNumber({ num, locale });
  return currencySymbol ? `${formatted} ${currencySymbol}` : formatted;
};

export const formatLimit = (
  value: number | string,
  currencySymbol = '',
  locale?: string
) => {
  const num = toNumber(value);
  const abs = Math.abs(num);
  let display = '';
  if (abs >= 1_000_000_000) {
    display = `${(num / 1_000_000_000).toFixed(1)}B`;
  } else if (abs >= 1_000_000) {
    display = `${(num / 1_000_000).toFixed(1)}M`;
  } else if (abs >= 1_000) {
    display = `${(num / 1_000).toFixed(1)}K`;
  } else {
    display = formatNumber({ num, locale });
  }
  return currencySymbol ? `${display} ${currencySymbol}` : display;
};

export const formatSecure = () => '••••';
