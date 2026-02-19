import React from "react";
// ----------------------------- UI kitten -----------------------------------
import {
  StyleService,
  useStyleSheet,
  Icon,
} from "@ui-kitten/components";
import { LayoutCustom, LinearGradientText, Text } from "components";
import { useCurrencyConversion, useCurrencyFormatter } from "hooks";
import { IWalletProps } from "types/redux-types";
import { getWalletNetBalance } from "utils";

interface WalletSelectProps {
  wallet: IWalletProps;
  onOpen(): void;
  onClose(): void;
}

const WalletSelect = ({ wallet, onClose, onOpen }: WalletSelectProps) => {
  const styles = useStyleSheet(themedStyles);
  const formatCurrency = useCurrencyFormatter();
  const { convert } = useCurrencyConversion();
  const walletBalance = getWalletNetBalance(wallet, convert);
  return (
    <>
      <LayoutCustom gap={4} onPress={onOpen}>
        <LayoutCustom itemsCenter horizontal gap={8}>
          <LinearGradientText text={wallet.title} category="h5" />
          <Icon pack="assets" name={"caret-down"} style={styles.caret} />
        </LayoutCustom>
        <Text category="h3">
          {formatCurrency(walletBalance, 2)}
        </Text>
      </LayoutCustom>
    </>
  );
};

export default WalletSelect;

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
