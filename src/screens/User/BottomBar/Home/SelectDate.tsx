import React from "react";
// ----------------------------- UI kitten -----------------------------------
import {
  StyleService,
  useStyleSheet,
  Icon,
  useTheme,
} from "@ui-kitten/components";
// ----------------------------- Hooks ---------------------------------------
import { useModalize } from "hooks";
// ----------------------------- Components && Elements -----------------------
import { Modalize } from "react-native-modalize";
import { LayoutCustom, Text } from "components";
import { Portal } from "react-native-portalize";
import { useAppSelector } from "reduxs/store";
import { appSelector } from "reduxs/reducers/app-reducer";
import dayjs from "dayjs";
import { useTranslation } from "i18n/useTranslation";

const SelectDate = () => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const wallets = useAppSelector(appSelector).wallets;
  const { t } = useTranslation();

  const toDate = (value: any): Date => {
    if (!value) return new Date(0);
    if (value instanceof Date) return value;
    if (typeof value === "string") return new Date(value);
    if (typeof value === "object" && typeof value.toDate === "function") {
      return value.toDate();
    }
    return new Date(value);
  };

  const monthOptions = React.useMemo(() => {
    const unique = new Set<string>();
    wallets.forEach((wallet) => {
      (wallet.transaction ?? []).forEach((tx) => {
        unique.add(dayjs(toDate(tx.date)).format("MM/YYYY"));
      });
    });
    const sorted = Array.from(unique).sort(
      (a, b) => dayjs(b, "MM/YYYY").valueOf() - dayjs(a, "MM/YYYY").valueOf()
    );
    return [t("All time"), ...sorted];
  }, [wallets, t]);

  const [month, setMonth] = React.useState(monthOptions[0]);

  React.useEffect(() => {
    setMonth(monthOptions[0]);
  }, [monthOptions]);

  const showSelectMonth = () => {
    openMonth();
  };

  const {
    modalizeRef: modalSelectMonth,
    open: openMonth,
    close: closeMonth,
  } = useModalize();

  return (
    <>
      <LayoutCustom
        style={styles.selectDate}
        horizontal
        itemsCenter
        onPress={showSelectMonth}
      >
        <Text category="subhead">{month}</Text>
        <Icon pack="assets" name={"caret-down"} style={styles.caretDown} />
      </LayoutCustom>
      <Portal>
        <Modalize
          ref={modalSelectMonth}
          withHandle={false}
          snapPoint={260}
          modalStyle={{
            backgroundColor: theme["background-basic-color-1"],
            paddingTop: 32,
          }}
        >
          <LayoutCustom level="1" gap={30} itemsCenter>
            {monthOptions.map((item, index) => {
              return (
                <LayoutCustom
                  key={index}
                  onPress={() => {
                    setMonth(item);
                    closeMonth();
                  }}
                >
                  <Text category="h4">{item}</Text>
                </LayoutCustom>
              );
            })}
          </LayoutCustom>
        </Modalize>
      </Portal>
    </>
  );
};

export default SelectDate;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  caret: {
    width: 16,
    height: 16,
    tintColor: "text-platinum-color",
  },
  selectDate: {
    backgroundColor: "background-basic-color-2",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 99,
    gap: 8,
    height: 40,
  },
  caretDown: {
    width: 16,
    height: 16,
    tintColor: "text-basic-color",
  },
  contentContainer: {
    width: "100%",
    paddingBottom: 40,
  },
  modalStyle: {
    backgroundColor: "background-basic-color-1",
    padding: 24,
  },
});
