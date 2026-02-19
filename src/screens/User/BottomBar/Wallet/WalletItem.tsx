import React from "react";
import { Alert, Image, Modal } from "react-native";
// ----------------------------- UI kitten -----------------------------------
import {
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
  Button,
} from "@ui-kitten/components";
// ----------------------------- Navigation -----------------------------------
import { NavigationProp, useNavigation } from "@react-navigation/native";
// ----------------------------- Hooks ---------------------------------------
import { useCurrencyConversion, useCurrencyFormatter, useLayout } from "hooks";
// ----------------------------- Components && Elements -----------------------
import { Container, Content, LayoutCustom, Text } from "components";
import { IWalletProps } from "types/redux-types";
import { LinearGradient } from "expo-linear-gradient";
import { isArray } from "lodash";
import { IMAGE_ICON_CATEGORY } from "assets/IconCategory";
import { getWalletNetBalance, waitUtil } from "utils";
import { RootStackParamList } from "types/navigation-types";
import { RectButton, Swipeable } from "react-native-gesture-handler";
import { removeWallet } from "reduxs/reducers/app-reducer";
import { useAppDispatch } from "reduxs/store";
import { Images } from "assets/images";
import { deleteWalletForUser } from "services/userData";
import { useTranslation } from "i18n/useTranslation";

interface WalletItemProps {
  wallet: IWalletProps;
  backgroundColor: string[] | string;
  isFirst: boolean;
}

const WalletItem: React.FC<WalletItemProps> = ({
  isFirst,
  wallet,
  backgroundColor,
}) => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const formatCurrency = useCurrencyFormatter();
  const { convert } = useCurrencyConversion();
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const { height, width, top, bottom } = useLayout();
  const { t } = useTranslation();
  const size = { height: 127, width: width - 32 };
  const sizeModal = { width: 160 * (width / 375), height: 160 * (width / 375) };
  const gradientColors =
    isArray(backgroundColor) && backgroundColor.length >= 2
      ? (backgroundColor as [string, string, ...string[]])
      : null;
  const hasWalletBackground = Boolean(wallet.image);
  const textStatus = hasWalletBackground ? "white" : isFirst ? "black" : "basic";

  const swipeableRef = React.useRef<Swipeable>(null);
  const [visible, setVisible] = React.useState(false);

  const _sumBalance = getWalletNetBalance(wallet, convert);
  const size_icon = { width: 24, height: 24 };

  const renderWalletLogo = () => {
    if (wallet.image) {
      return (
        <LayoutCustom style={styles.logoWrap}>
          <Image
            source={{ uri: wallet.image }}
            style={[size_icon, styles.walletImage as any]}
          />
        </LayoutCustom>
      );
    }

    if ((wallet.transaction ?? []).length > 0) {
      return (
        <LayoutCustom style={styles.logoWrap}>
          <Image
            source={IMAGE_ICON_CATEGORY[(wallet.transaction ?? [])[0].category.icon]}
            style={size_icon}
          />
        </LayoutCustom>
      );
    }

    return (
      <LayoutCustom style={styles.logoWrap}>
        <Text category="h6" status={textStatus}>
          {wallet.symbol}
        </Text>
      </LayoutCustom>
    );
  };

  const dispath = useAppDispatch();
  const handleRemove = async (index: number | string) => {
    try {
      await deleteWalletForUser(index);
      dispath(removeWallet(index));
    } catch (err: any) {
      Alert.alert(t("Delete wallet failed"), err?.message ?? t("Please try again."));
    }
  };
  const _onYes = async () => {
    swipeableRef.current?.close();
    await handleRemove(wallet.id);
    waitUtil(750).then(() => {
      setVisible(false);
    });
  };
  return (
    <>
      <Swipeable
        ref={swipeableRef}
        renderLeftActions={() => (
          <LayoutCustom minWidth={width}>
            <Text> </Text>
          </LayoutCustom>
        )}
        renderRightActions={() => (
          <LayoutCustom minWidth={width}>
            <Text> </Text>
          </LayoutCustom>
        )}
        containerStyle={{ paddingHorizontal: 16 }}
        onSwipeableOpen={() => {
          // setCurrentWallet(wallet);
          setVisible(true);
        }}
      >
        <RectButton
          onPress={() => {
            wallet.id && navigate("WalletChart", { walletId: wallet.id });
          }}
        >
          <LayoutCustom style={[styles.container, size]} onLongPress={() => {}}>
            {hasWalletBackground && (
              <>
                <Image
                  source={{ uri: wallet.image! }}
                  style={[styles.walletBackground as any, size]}
                />
                <LayoutCustom style={styles.walletBackgroundOverlay} />
              </>
            )}
            {!hasWalletBackground && gradientColors && (
              <LinearGradient
                colors={gradientColors}
                start={{ x: 1, y: 1 }}
                end={{ x: 0.3, y: 0 }}
                style={[styles.linear, size]}
              />
            )}
            <LayoutCustom
              horizontal
              itemsCenter
              pv={4}
              mb={16}
              justify="flex-start"
              gap={10}
            >
              {renderWalletLogo()}
              <Text status={textStatus}>{wallet.title}</Text>
            </LayoutCustom>
            <LayoutCustom>
              <Text category="h2" status={textStatus}>
                {formatCurrency(_sumBalance, 2)}
              </Text>
            </LayoutCustom>
          </LayoutCustom>
        </RectButton>
      </Swipeable>
      <Modal visible={visible}>
        <Container>
          <Content contentContainerStyle={styles.contentModal}>
            <Image source={Images.wallet_delete} style={sizeModal} />
            <Text category="h3" marginHorizontal={32} center>
              Remove this wallet?
            </Text>
            <Text category="body" center>
              This will delete all wallet data and transactions. Are you sure?
            </Text>
          </Content>
          <LayoutCustom ph={16} gap={8} horizontal itemsCenter pv={6}>
            <Button
              children={t("Yes")}
              style={[styles.button, { backgroundColor: "#3E517A" }]}
              onPress={_onYes}
            />
            <Button
              children={t("No")}
              style={styles.button}
              onPress={() => {
                setVisible(false);
                swipeableRef.current?.close();
              }}
            />
          </LayoutCustom>
        </Container>
      </Modal>
    </>
  );
};

export default WalletItem;

const themedStyles = StyleService.create({
  container: {
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderRadius: 24,
    overflow: "hidden",
    justifyContent: "center",
  },
  content: {},
  linear: {
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: -100,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderRadius: 24,
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
  walletImage: {
    borderRadius: 12,
  },
  walletBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
  },
  walletBackgroundOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    backgroundColor: "#0000004D",
  },
  logoWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF33",
  },
});
