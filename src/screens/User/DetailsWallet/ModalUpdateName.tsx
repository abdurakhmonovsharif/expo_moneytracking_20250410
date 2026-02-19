import * as React from "react";
import {
  TopNavigation,
  Input,
  StyleService,
  useStyleSheet,
  Button,
  useTheme,
} from "@ui-kitten/components";
import {
  Container,
  NavigationAction,
  Text,
  Content,
  LayoutCustom,
} from "components";
import { useTranslation } from "i18n/useTranslation";

const ModalUpdateName = ({
  onClose,
  name,
  symbol,
  handleChangeName,
  handleChangeSymbol,
}: {
  onClose(): void;
  name: string;
  symbol: string;
  handleChangeName: (t: string) => void;
  handleChangeSymbol: (t: string) => void;
}) => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation();
  const [isSymbol, setIsSymbol] = React.useState(symbol);
  const [isName, setIsName] = React.useState(name);

  return (
    <Container>
      <TopNavigation
        title={t("Update Name")}
        accessoryLeft={() => <NavigationAction onPress={onClose} />}
      />
      <Content>
        <LayoutCustom style={styles.page}>
          <Input
            accessoryLeft={() => <Text category="h3">{isSymbol}</Text>}
            placeholder={t("Enter your wallet name")}
            style={styles.input}
            value={`${isName}`}
            keyboardType="email-address"
            autoFocus={true}
            onChangeText={(t) => {
              setIsName(t);
            }}
          />
          <LayoutCustom wrap horizontal rowGap={12} columnGap={8} mt={16}>
            {DEFAULT_WALLET_PRESETS.map((item, index) => {
              const active = item.symbol === isSymbol;
              return (
                <LayoutCustom
                  key={index}
                  style={[
                    styles.tag,
                    active && {
                      backgroundColor: theme["text-primary-color"],
                    },
                  ]}
                  onPress={() => {
                    setIsSymbol(item.symbol);
                  }}
                >
                  <LayoutCustom horizontal itemsCenter gap={6}>
                    <Text category="subhead">{item.symbol}</Text>
                    <Text>{item.title}</Text>
                  </LayoutCustom>
                </LayoutCustom>
              );
            })}
          </LayoutCustom>
        </LayoutCustom>
      </Content>
      <Button
        children={t("Confirm")}
        style={styles.buttonConfirm}
        onPress={() => {
          if (isName && isSymbol) {
            onClose();
            handleChangeName(isName);
            handleChangeSymbol(isSymbol);
          }
        }}
      />
    </Container>
  );
};

export default ModalUpdateName;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  page: {
    flex: 1,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
  },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "background-basic-color-2",
  },
  buttonConfirm: {
    marginHorizontal: 16,
    marginBottom: 4,
  },
});
const DEFAULT_WALLET_PRESETS = [
  { symbol: "💵️", title: "Cash" },
  { symbol: "👛️", title: "E-Wallet" },
  { symbol: "🏦️", title: "Bank" },
  { symbol: "🪙️", title: "Crypto" },
  { symbol: "💳️", title: "Card" },
];
