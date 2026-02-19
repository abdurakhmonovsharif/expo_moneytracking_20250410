import React from "react";
// ----------------------------- UI kitten -----------------------------------
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Icon,
  Button,
} from "@ui-kitten/components";
// ----------------------------- Navigation -----------------------------------
import { NavigationProp, useNavigation } from "@react-navigation/native";
// ----------------------------- Hooks ---------------------------------------
import { useLayout } from "hooks";
// ----------------------------- Components && Elements -----------------------
import {
  Container,
  Content,
  LayoutCustom,
  NavigationAction,
  Text,
} from "components";
import { IWalletProps } from "types/redux-types";
// ----------------------------- Types && Utils -----------------------
import { RootStackParamList } from "types/navigation-types";
import { waitUtil } from "utils";
import { useTranslation } from "i18n/useTranslation";

interface ISelectCategoryProps {
  data: IWalletProps[];
  onClose(): void;
  current_wallet: IWalletProps;
  onSelect: React.Dispatch<React.SetStateAction<IWalletProps>>;
}

const SelectWalletScreen: React.FC<ISelectCategoryProps> = ({
  current_wallet,
  data,
  onClose,
  onSelect,
}) => {
  const styles = useStyleSheet(themedStyles);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const { bottom } = useLayout();
  const { t } = useTranslation();

  const [selectWallet, setWallet] =
    React.useState<IWalletProps>(current_wallet);

  const _onAdd = () => {
    navigate("NewWallet");
    onClose();
  };
  const _onConfirm = () => {
    selectWallet && onSelect(selectWallet);
    waitUtil(750).then(() => {
      onClose();
    });
  };

  return (
    <Container style={styles.container} level="1">
      <TopNavigation
        alignment="center"
        title={t("Choose Wallet")}
        accessoryLeft={() => <NavigationAction onPress={onClose} />}
        accessoryRight={() => (
          <Text category="h5" status="warning" onPress={_onAdd}>
            Add
          </Text>
        )}
      />
      <Content contentContainerStyle={styles.content}>
        <LayoutCustom style={styles.selectField}>
          {data &&
            data.map((wallet, index) => {
              const key = index.toFixed(0) + wallet.id;
              const isActive =
                selectWallet?.id != undefined && selectWallet.id === wallet.id;
              return (
                <LayoutCustom
                  horizontal
                  itemsCenter
                  key={key}
                  justify="space-between"
                  padding={16}
                  onPress={() => {
                    setWallet(wallet);
                  }}
                >
                  <LayoutCustom horizontal itemsCenter gap={16}>
                    <Text category="h3">{wallet.symbol}</Text>
                    <Text>{wallet.title}</Text>
                  </LayoutCustom>
                  <Icon
                    pack="assets"
                    name={isActive ? "checkmark" : "checkmark_linear"}
                    style={styles.icon}
                  />
                </LayoutCustom>
              );
            })}
        </LayoutCustom>
      </Content>
      {selectWallet && (
        <Button
          children={t("Confirm")}
          style={[styles.buttonConfirm]}
          onPress={_onConfirm}
        />
      )}
    </Container>
  );
};

export default SelectWalletScreen;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
    gap: 8,
    paddingHorizontal: 19,
  },
  selectField: {
    borderRadius: 16,
    backgroundColor: "background-basic-color-2",
  },
  icon: {
    width: 20,
    height: 20,
  },
  buttonConfirm: {
    marginHorizontal: 20,
  },
});
