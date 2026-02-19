import React from "react";
import { Icon, Spinner, StyleService, useStyleSheet } from "@ui-kitten/components";
import { LayoutCustom, Text } from "components";
import { CURRENCY_NAME_BY_CODE } from "constants/currencies";
import { useTranslation } from "i18n/useTranslation";
import { appSelector, setFxRates } from "reduxs/reducers/app-reducer";
import { useAppDispatch, useAppSelector } from "reduxs/store";
import { loadFxRates } from "services/fxRates";
import { formatNumber } from "utils";

const BASE_CURRENCY = "UZS";

const normalizeCode = (value?: string | null) =>
  (value ?? "").toString().trim().toUpperCase();

const resolveRate = (
  fromCode: string,
  toCode: string,
  fxRates?: Record<string, number>
): number | null => {
  if (!fromCode || !toCode) {
    return null;
  }
  if (fromCode === toCode) {
    return 1;
  }
  if (!fxRates) {
    return null;
  }
  const fromRate = fromCode === BASE_CURRENCY ? 1 : fxRates[fromCode];
  const toRate = toCode === BASE_CURRENCY ? 1 : fxRates[toCode];
  if (!fromRate || !toRate) {
    return null;
  }
  return fromRate / toRate;
};

const formatRate = (value: number): string => {
  const absValue = Math.abs(value);
  const fractionDigits = absValue >= 1 ? 2 : 4;
  const fixed = value.toFixed(fractionDigits);
  const normalized = fixed.replace(/(\.\d*?[1-9])0+$/g, "$1").replace(/\.0+$/g, "");
  return formatNumber({ num: Number(normalized), thousandSeparator: ".", decimalSeparator: "." });
};

const EPSILON = 1e-9;

const CurrencyRatesCard = React.memo(() => {
  const styles = useStyleSheet(themedStyles);
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { currency, fxRates, fxPreviousRates, fxRateDiffs } = useAppSelector(appSelector);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (fxRates && Object.keys(fxRates).length > 0) {
      return;
    }
    let isMounted = true;
    setLoading(true);
    loadFxRates()
      .then((payload) => {
        if (!isMounted || !payload?.rates) {
          return;
        }
        dispatch(
          setFxRates({
            rates: payload.rates,
            updatedAt: payload.updatedAt,
            date: payload.date,
            previousDate: payload.previousDate,
            previousRates: payload.previousRates,
            deltaRates: payload.deltaRates,
          })
        );
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [dispatch, fxRates]);

  const targetCode = React.useMemo(() => {
    return normalizeCode(currency) || "USD";
  }, [currency]);

  const visibleCodes = React.useMemo(() => {
    const ordered = [targetCode, "USD", "EUR"]
      .map((code) => normalizeCode(code))
      .filter(Boolean);
    return Array.from(new Set(ordered));
  }, [targetCode]);

  return (
    <LayoutCustom style={styles.container} level="2">
      <LayoutCustom horizontal justify="space-between" itemsCenter>
        <Text category="h6">Currency rates</Text>
        {loading ? (
          <Spinner size="tiny" />
        ) : (
          <Text category="c2" status="content">
            {visibleCodes.length}
          </Text>
        )}
      </LayoutCustom>

      <LayoutCustom style={styles.rows} gap={12}>
        {visibleCodes.map((code) => {
          const rate = resolveRate(code, targetCode, fxRates);
          const previousRate = resolveRate(code, targetCode, fxPreviousRates);
          let oneDayDiff: number | null = null;
          if (typeof rate === "number" && typeof previousRate === "number") {
            oneDayDiff = rate - previousRate;
          } else if (targetCode === BASE_CURRENCY) {
            const baseDiff = fxRateDiffs?.[code];
            if (typeof baseDiff === "number") {
              oneDayDiff = baseDiff;
            }
          }
          const hasDiff = typeof oneDayDiff === "number" && Math.abs(oneDayDiff) > EPSILON;
          const isUp = hasDiff && (oneDayDiff as number) > 0;
          const rateText = typeof rate === "number" ? formatRate(rate) : "—";
          const diffText =
            typeof oneDayDiff === "number" ? formatRate(Math.abs(oneDayDiff)) : "—";
          const title =
            code === targetCode
              ? `${t("Current currency")} (${code})`
              : CURRENCY_NAME_BY_CODE[code] ?? code;

          return (
            <LayoutCustom key={code} horizontal justify="space-between" itemsCenter style={styles.row}>
              <LayoutCustom horizontal itemsCenter gap={10} style={styles.left}>
                <LayoutCustom style={[styles.codeTag, code === targetCode && styles.codeTagActive]}>
                  <Text category="c2" status={code === targetCode ? "white" : "content"}>
                    {code}
                  </Text>
                </LayoutCustom>
                <LayoutCustom style={styles.titleWrap}>
                  <Text category="subhead" numberOfLines={1}>
                    {title}
                  </Text>
                  <Text category="c2" status="content" numberOfLines={1}>
                    {`1 ${code} = ${rateText} ${targetCode}`}
                  </Text>
                </LayoutCustom>
              </LayoutCustom>
              <LayoutCustom itemsCenter style={styles.right} gap={4}>
                {hasDiff ? (
                  <LayoutCustom horizontal itemsCenter gap={4}>
                    <Icon
                      pack="assets"
                      name={isUp ? "arrow-up" : "arrow-down"}
                      style={isUp ? styles.upIcon : styles.downIcon}
                    />
                    <Text category="c2" status={isUp ? "success" : "danger"}>
                      {diffText}
                    </Text>
                  </LayoutCustom>
                ) : (
                  <Text category="c2" status="content">
                    {diffText}
                  </Text>
                )}
                <Text category="c2" status="content">
                  {t("Yesterday")}
                </Text>
              </LayoutCustom>
            </LayoutCustom>
          );
        })}
      </LayoutCustom>
    </LayoutCustom>
  );
});

export default CurrencyRatesCard;

const themedStyles = StyleService.create({
  container: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  rows: {
    gap: 12,
  },
  row: {
    width: "100%",
  },
  left: {
    flex: 1,
  },
  right: {
    minWidth: 84,
    alignItems: "flex-end",
  },
  codeTag: {
    minWidth: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "border-basic-color-4",
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  codeTagActive: {
    backgroundColor: "color-primary-default",
    borderColor: "color-primary-default",
  },
  titleWrap: {
    flex: 1,
  },
  upIcon: {
    width: 14,
    height: 14,
    tintColor: "color-success-default",
  },
  downIcon: {
    width: 14,
    height: 14,
    tintColor: "color-danger-default",
  },
});
