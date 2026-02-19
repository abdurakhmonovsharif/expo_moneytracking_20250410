import React from "react";
import { View, Image, StyleSheet, Animated, Modal } from "react-native";
// ----------------------------- UI kitten -----------------------------------
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Button,
} from "@ui-kitten/components";
// ----------------------------- Navigation -----------------------------------
import { NavigationProp, useNavigation } from "@react-navigation/native";
// ----------------------------- Hooks ---------------------------------------
import { useCurrencyConversion, useCurrencyFormatter, useLayout } from "hooks";
// ----------------------------- Assets ---------------------------------------
import { Images } from "assets/images";
// ----------------------------- Components && Elements -----------------------

import {
  Container,
  Content,
  LayoutCustom,
  LinearGradientText,
  Text,
} from "components";
import { RootStackParamList } from "types/navigation-types";
import { appSelector, removeWallet } from "reduxs/reducers/app-reducer";
import { useAppDispatch, useAppSelector } from "reduxs/store";
import WalletItem from "./WalletItem";
import { getWalletsNetBalance, waitUtil } from "utils";
import { RectButton, Swipeable } from "react-native-gesture-handler";
import { IWalletProps } from "types/redux-types";

const WalletScreen = React.memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const formatCurrency = useCurrencyFormatter();
  const { convert } = useCurrencyConversion();
  const { goBack, navigate } =
    useNavigation<NavigationProp<RootStackParamList>>();
  const { height, width, top, bottom } = useLayout();
  const [currentWallet, setCurrentWallet] = React.useState<IWalletProps>();
  const [swipeActive, setSwipeActive] = React.useState(false);

  const _addNewWallet = () => {
    navigate("NewWallet");
  };

  const list_wallet = useAppSelector(appSelector).wallets;
  const total_balance = getWalletsNetBalance(list_wallet, convert);
  const formattedNumber = formatCurrency(total_balance, 2);
  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryRight={() => (
          <Text status="warning" category="h5" onPress={_addNewWallet}>
            Add
          </Text>
        )}
      />
      <Content contentContainerStyle={styles.content}>
        <LayoutCustom gap={4} itemsCenter>
          <LinearGradientText text={"Totals balance"} category="h5" />
          <LinearGradientText text={formattedNumber} category="h2" />
        </LayoutCustom>
        <LayoutCustom gap={4}>
          {list_wallet &&
            list_wallet.map((wallet, index) => {
              const colors = [
                ["#106AF3", "#106AF3"],
                ["#00CD50", "#00CD50"],
                ["#E30147", "#106AF3"],
                ["#00CD50", "#106AF3"],
              ];
              function getRandomColor() {
                const randomIndex = Math.floor(Math.random() * colors.length);
                return colors[randomIndex];
              }
              // Get a random color from the list
              const randomColor = getRandomColor();
              return (
                <WalletItem
                  backgroundColor={
                    index === 0 ? ["#FFFDE1", "#CFE1FD"] : randomColor
                  }
                  wallet={wallet}
                  key={index}
                  isFirst={index === 0}
                />
              );
            })}
        </LayoutCustom>
      </Content>
    </Container>
  );
});

export default WalletScreen;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingBottom: 0,
  },
  content: {
    gap: 32,
  },
  rightActions: {
    width: "50%",
    height: "100%",
    marginRight: 16,
    marginLeft: -48,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "text-danger-color",
  },
  contentModal: {
    gap: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  button: {
    flex: 1,
  },
});
