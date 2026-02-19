import React from "react";
import { Alert, Image, Modal } from "react-native";
// ----------------------------- UI kitten -----------------------------------
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Button,
  Icon,
  Input,
} from "@ui-kitten/components";
// ----------------------------- Hooks ---------------------------------------
import { useCurrencyFormatter, useLayout } from "hooks";
// ----------------------------- Assets ---------------------------------------
import { Images } from "assets/images";
// ----------------------------- Components && Elements -----------------------
import {
  Container,
  Content,
  LayoutCustom,
  LoadingScreen,
  NavigationAction,
  Text,
} from "components";
import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { RootStackParamList } from "types/navigation-types";
import { waitUtil } from "utils";
import { useAppDispatch } from "reduxs/store";
import { removeWallet, updateWallet } from "reduxs/reducers/app-reducer";
import { deleteWalletForUser, updateWalletForUser } from "services/userData";
import { Formik } from "formik";
import * as Yup from "yup";
import ModalUpdateName from "./ModalUpdateName";
import ModalBalance from "./ModalBalance";
import { useTranslation } from "i18n/useTranslation";
import { pickImageFromCamera, pickImageFromLibrary } from "services/mediaPicker";

const DetailsWallet = React.memo(() => {
  const styles = useStyleSheet(themedStyles);
  const { height, width, bottom } = useLayout();
  const { goBack, navigate } =
    useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const formatCurrency = useCurrencyFormatter();
  const { t } = useTranslation();

  const [visible, setVisible] = React.useState(false);
  const [visibleName, setVisibleName] = React.useState(false);
  const [visibleBalance, setVisibleBalance] = React.useState(false);

  const dispatch = useAppDispatch();
  const sizeModal = { width: 160 * (width / 375), height: 160 * (width / 375) };

  const route = useRoute<RouteProp<RootStackParamList, "DetailsWallet">>();
  const wallet = route.params.wallet;

  const handleRemove = async () => {
    try {
      await deleteWalletForUser(wallet.id);
      dispatch(removeWallet(wallet.id));
    } catch (err: any) {
      Alert.alert(t("Delete wallet failed"), err?.message ?? t("Please try again."));
    }
  };

  const _onDelete = () => {
    setVisible(true);
  };
  const _onUpdate = () => {};
  const initValues = wallet;
  const validationWallet = React.useMemo(
    () =>
      Yup.object().shape({
        title: Yup.string()
          .required(t("Wallet name required"))
          .min(3, t("Invalid title. Wallet name must more than 3 characters")),
        balance: Yup.number()
          .required(t("Balance is required"))
          .min(0.1, t("Balance must more than 0")),
        symbol: Yup.string().required(t("Select one type")),
      }),
    [t]
  );

  return (
    <Formik
      initialValues={initValues}
      validationSchema={validationWallet}
      onSubmit={async (values) => {
        const updatedWallet = {
          ...wallet,
          id: values.id,
          title: values.title,
          balance: Number(values.balance),
          symbol: values.symbol,
          transaction: wallet.transaction ?? [],
          image: values.image ?? null,
        };
        try {
          await updateWalletForUser(updatedWallet);
          dispatch(
            updateWallet({
              wallet: updatedWallet,
            })
          );
          waitUtil(750).then(() => {
            navigate("BottomBar", { screen: "Home" });
          });
        } catch (err: any) {
          Alert.alert(t("Update wallet failed"), err?.message ?? t("Please try again."));
        }
      }}
    >
      {({ handleSubmit, setFieldValue, values, errors }) => {
        const onSelectWalletImage = () => {
          const setImage = (uri: string | null) => setFieldValue("image", uri);
          const handleCameraPick = async () => {
            try {
              const uri = await pickImageFromCamera();
              if (uri) {
                setImage(uri);
              }
            } catch (error: unknown) {
              Alert.alert(
                t("Permission needed"),
                error instanceof Error ? error.message : t("Please try again.")
              );
            }
          };
          const handleGalleryPick = async () => {
            try {
              const uri = await pickImageFromLibrary();
              if (uri) {
                setImage(uri);
              }
            } catch (error: unknown) {
              Alert.alert(
                t("Permission needed"),
                error instanceof Error ? error.message : t("Please try again.")
              );
            }
          };

          const buttons: {
            text: string;
            onPress?: () => void;
            style?: "default" | "cancel" | "destructive";
          }[] = [
            { text: t("Use camera"), onPress: () => void handleCameraPick() },
            {
              text: t("Choose from gallery"),
              onPress: () => void handleGalleryPick(),
            },
          ];

          if (values.image) {
            buttons.push({
              text: t("Remove photo"),
              style: "destructive",
              onPress: () => setImage(null),
            });
          }

          buttons.push({ text: t("Cancel"), style: "cancel" });

          Alert.alert(t("Wallet image"), t("Choose image source"), buttons);
        };

        return (
          <Container style={styles.container}>
            <TopNavigation accessoryLeft={() => <NavigationAction />} />
            <Content contentContainerStyle={styles.content}>
              {!wallet ? (
                <>
                  <LoadingScreen />
                </>
              ) : (
                <LayoutCustom style={styles.layout} level="2">
                  <LayoutCustom
                    horizontal
                    justify="space-between"
                    padding={16}
                    itemsCenter
                    onPress={onSelectWalletImage}
                  >
                    <LayoutCustom horizontal itemsCenter gap={16}>
                      {values.image ? (
                        <Image
                          source={{ uri: values.image }}
                          style={styles.walletImage as any}
                        />
                      ) : (
                        <Text category="h3">{values.symbol}</Text>
                      )}
                      <Text category="body">{t("Wallet image")}</Text>
                    </LayoutCustom>
                    <Icon
                      style={styles.arrow}
                      name="caret-right"
                      pack="assets"
                    />
                  </LayoutCustom>
                  <LayoutCustom
                    horizontal
                    justify="space-between"
                    padding={16}
                    itemsCenter
                  >
                    <LayoutCustom
                      horizontal
                      itemsCenter
                      gap={16}
                      onPress={() => {
                        setVisibleName(true);
                      }}
                    >
                      <Text category="h3">{values.symbol}</Text>
                      <Text category="body">{values.title}</Text>
                    </LayoutCustom>
                    <Icon
                      style={styles.arrow}
                      name="caret-right"
                      pack="assets"
                    />
                  </LayoutCustom>
                  <LayoutCustom
                    horizontal
                    justify="space-between"
                    padding={16}
                    itemsCenter
                    onPress={() => {
                      setVisibleBalance(true);
                    }}
                  >
                    <LayoutCustom horizontal itemsCenter gap={16}>
                      <Icon pack="assets" name="money" style={styles.money} />
                      <Text category="body">
                        {formatCurrency(values.balance)}
                      </Text>
                    </LayoutCustom>
                    <Icon
                      style={styles.arrow}
                      name="caret-right"
                      pack="assets"
                    />
                  </LayoutCustom>
                </LayoutCustom>
              )}
            </Content>
            <LayoutCustom ph={16} gap={8} horizontal itemsCenter pv={6}>
            <Button
                children={t("Delete")}
                style={[styles.button, { backgroundColor: "#3E517A" }]}
                onPress={_onDelete}
              />
              <Button
                children={t("Update")}
                style={styles.button}
                onPress={() => handleSubmit()}
              />
            </LayoutCustom>
            <Modal visible={visible} animationType="slide">
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
                    onPress={handleRemove}
                  />
                  <Button
                    children={t("No")}
                    style={styles.button}
                    onPress={() => {
                      setVisible(false);
                    }}
                  />
                </LayoutCustom>
              </Container>
            </Modal>
            <Modal visible={visibleName} animationType="slide">
              <ModalUpdateName
                onClose={() => {
                  setVisibleName(false);
                }}
                name={values.title}
                handleChangeName={(t: string) => setFieldValue("title", t)}
                handleChangeSymbol={(t: string) => setFieldValue("symbol", t)}
                symbol={values.symbol}
              />
            </Modal>
            <Modal visible={visibleBalance} animationType="slide">
              <ModalBalance
                onClose={() => {
                  setVisibleBalance(false);
                }}
                balance={values.balance}
                handleChangeBalance={(t: string) => setFieldValue("balance", t)}
              />
            </Modal>
          </Container>
        );
      }}
    </Formik>
  );
});

export default DetailsWallet;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  layout: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: "hidden",
  },
  arrow: {
    tintColor: "text-placeholder-color",
    width: 20,
    height: 20,
  },
  money: {
    width: 28,
    height: 28,
    tintColor: "text-basic-color",
  },
  button: {
    flex: 1,
  },
  contentModal: {
    gap: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  page: {
    flex: 1,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
  },
  walletImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});
