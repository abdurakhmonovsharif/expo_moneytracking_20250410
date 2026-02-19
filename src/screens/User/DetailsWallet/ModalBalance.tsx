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
  LinearGradientText,
} from "components";
import TagCurrency from "components/TagCurrency";
import { useTranslation } from "i18n/useTranslation";
import { formatNumber } from "utils";

const ModalBalance = ({
  onClose,
  balance,
  handleChangeBalance,
}: {
  onClose(): void;
  balance: number;
  handleChangeBalance: (t: string) => void;
}) => {
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation();
  const [isBalance, setIsBalance] = React.useState<number | string>(balance);
  const refBalance = React.useRef<Input>(null);
  const numericBalance = Number(isBalance || 0);
  const displayBalance = Number.isFinite(numericBalance)
    ? formatNumber({ num: numericBalance, thousandSeparator: ".", decimalSeparator: "." })
    : "0";

  return (
    <Container>
      <TopNavigation
        title={t("Update Balance")}
        accessoryLeft={() => <NavigationAction onPress={onClose} />}
      />
      <Content>
        <LayoutCustom style={styles.page} mt={56}>
          <LayoutCustom horizontal justify="center">
            <LayoutCustom
              gap={5}
              itemsCenter
              onPress={() => {
                refBalance.current?.focus();
              }}
            >
              <LinearGradientText text={displayBalance} category="h0" />
              <Text status="platinum" center>
                Initial balance
              </Text>
            </LayoutCustom>
            <LayoutCustom style={styles.tagCurrency}>
              <TagCurrency />
            </LayoutCustom>
          </LayoutCustom>
          <Input
            ref={refBalance}
            autoFocus
            style={{ opacity: 0, position: "absolute" }}
            keyboardType="numeric"
            onChangeText={(text) => {
              const sanitizedValue = text.replace(/[^\d.]/g, "");
              const segments = sanitizedValue.split(".");
              const normalizedValue =
                segments.length > 1
                  ? `${segments[0]}.${segments.slice(1).join("")}`
                  : segments[0];

              if (normalizedValue === "") {
                setIsBalance("");
                return;
              }

              if (!Number.isNaN(Number(normalizedValue))) {
                setIsBalance(normalizedValue);
              }
            }}
          />
        </LayoutCustom>
      </Content>
      <Button
        children={t("Confirm")}
        style={styles.buttonConfirm}
        onPress={() => {
          if (isBalance) {
            handleChangeBalance(isBalance.toString());
            onClose();
          }
        }}
      />
    </Container>
  );
};

export default ModalBalance;

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
  tagCurrency: {
    top: 0,
    position: "absolute",
    right: 0,
  },

  buttonConfirm: {
    marginHorizontal: 16,
    marginBottom: 4,
  },
});
