import React from "react";
import { Alert, Image } from "react-native";
// ----------------------------- UI kitten -----------------------------------
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Input,
  ViewPager,
  Button,
  Icon,
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
  LinearGradientText,
  NavigationAction,
  Text,
} from "components";
import { Formik } from "formik";
import { useAppDispatch, useAppSelector } from "reduxs/store";
import TagCurrency from "components/TagCurrency";
import * as Yup from "yup";
import { formatNumber, waitUtil } from "utils";
import { RootStackParamList } from "types/navigation-types";
import { addWallet, appSelector } from "reduxs/reducers/app-reducer";
import { createWalletForUser } from "services/userData";
import { useTranslation } from "i18n/useTranslation";
import { getPermissionBoolean, getPermissionNumber } from "utils";
import { pickImageFromCamera, pickImageFromLibrary } from "services/mediaPicker";

type FormikForm = {
  title: string;
  symbol: string;
  balance: string;
  image: string | null;
};

const NewWallet = React.memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { goBack, navigate } =
    useNavigation<NavigationProp<RootStackParamList>>();
  const { height, width, top, bottom } = useLayout();
  const { t } = useTranslation();

  const [activeIndex, setActiveIndex] = React.useState(0);

  const initValues: FormikForm = {
    title: "",
    balance: "1234.00",
    symbol: "👛️",
    image: null,
  };

  const dispatch = useAppDispatch();

  const refBalance = React.useRef<Input>(null);
  const refName = React.useRef<Input>(null);
  const currency = useAppSelector(appSelector).currency;
  const permissions = useAppSelector(appSelector).permissions;
  const wallets = useAppSelector(appSelector).wallets;
  const canCreateWallet = getPermissionBoolean(permissions, "wallet_create", true);
  const canUnlimitedWallets = getPermissionBoolean(permissions, "wallet_unlimited", false);
  const walletLimit = getPermissionNumber(permissions, "wallet_limit", 5);

  React.useEffect(() => {
    if (
      !canCreateWallet ||
      (!canUnlimitedWallets && walletLimit > 0 && wallets.length >= walletLimit)
    ) {
      Alert.alert(
        t("Get Premium"),
        t("Upgrade your premium account to unlock all the special functions of the app.")
      );
      goBack();
    }
  }, [canCreateWallet, canUnlimitedWallets, wallets.length, goBack, t]);

  const _goBack = () => {
    switch (activeIndex) {
      case 0:
        goBack();
      case 1:
        setActiveIndex(activeIndex - 1);
        refBalance.current?.blur();
        waitUtil(350).then(() => {
          refName.current?.focus();
        });
      case 2:
        setActiveIndex(activeIndex - 1);
      case 3:
        setActiveIndex(activeIndex - 1);
        refBalance.current?.focus();
      default:
        return console.log(activeIndex);
    }
  };
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
        try {
          const wallet = await createWalletForUser({
            title: values.title,
            balance: Number(values.balance),
            symbol: values.symbol,
            currency,
            image: values.image ?? null,
          });
          dispatch(addWallet(wallet));
          waitUtil(750).then(() => {
            navigate("BottomBar", { screen: "Home" });
          });
        } catch (err: any) {
          Alert.alert(t("Create wallet failed"), err?.message ?? t("Please try again."));
        }
      }}
    >
      {({
        handleChange,
        handleBlur,
        handleSubmit,
        setFieldValue,
        values,
        errors,
      }) => {
        const numericBalance = Number(values.balance || 0);
        const displayBalance = Number.isFinite(numericBalance)
          ? formatNumber({ num: numericBalance, thousandSeparator: ".", decimalSeparator: "." })
          : "0";

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
            <TopNavigation
              alignment="center"
              title={t("Create Wallet")}
              style={styles.topNavigation}
              accessoryLeft={() => <NavigationAction onPress={_goBack} />}
            />
            <Content contentContainerStyle={styles.content}>
              <ViewPager
                style={styles.viewpager}
                selectedIndex={activeIndex}
                onSelect={setActiveIndex}
              >
                {/* Page 1 */}
                <LayoutCustom style={styles.page}>
                  <LayoutCustom itemsCenter mb={12} gap={8}>
                    <LayoutCustom
                      style={styles.walletPhoto}
                      onPress={onSelectWalletImage}
                    >
                      {values.image ? (
                        <Image
                          source={{ uri: values.image }}
                          style={styles.walletPhotoImage as any}
                        />
                      ) : (
                        <Text category="h2">{values.symbol}</Text>
                      )}
                    </LayoutCustom>
                    <Text category="c1" status="content">
                      {values.image
                        ? t("Tap to change wallet photo")
                        : t("Tap to add wallet photo")}
                    </Text>
                  </LayoutCustom>
                  <Input
                    ref={refName}
                    accessoryLeft={() => (
                      <Text category="h3">{values.symbol}</Text>
                    )}
                    placeholder={t("Enter your wallet name")}
                    style={styles.input}
                    value={`${values.title}`}
                    keyboardType="email-address"
                    onBlur={handleBlur("title")}
                    autoFocus={false}
                    onChangeText={handleChange("title")}
                  />
                  {errors.title && (
                    <Text
                      status="warning"
                      category="c1"
                      marginLeft={4}
                      marginTop={4}
                    >
                      {errors.title}
                    </Text>
                  )}

                  <LayoutCustom
                    wrap
                    horizontal
                    rowGap={12}
                    columnGap={8}
                    mt={16}
                  >
                    {DEFAULT_WALLET_PRESETS.map((item, index) => {
                      const active = item.symbol === values.symbol;
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
                            handleChange("symbol")(item.symbol);
                            handleChange("title")(t(item.title));
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
                  {errors.symbol && (
                    <Text
                      status="warning"
                      category="c1"
                      marginLeft={4}
                      marginTop={4}
                    >
                      {errors.symbol}
                    </Text>
                  )}
                </LayoutCustom>
                {/* Page 2 */}
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
                  {errors.balance && (
                    <Text center status="warning" category="c1" marginTop={8}>
                      {errors.balance}
                    </Text>
                  )}
                  <Input
                    ref={refBalance}
                    style={{ opacity: 0, position: "absolute" }}
                    keyboardType="numeric"
                    onBlur={handleBlur("balance")}
                    onChangeText={(text) => {
                      const sanitizedValue = text.replace(/[^\d.]/g, "");
                      const segments = sanitizedValue.split(".");
                      const normalizedValue =
                        segments.length > 1
                          ? `${segments[0]}.${segments.slice(1).join("")}`
                          : segments[0];

                      if (normalizedValue === "") {
                        setFieldValue("balance", "");
                        return;
                      }

                      if (!Number.isNaN(Number(normalizedValue))) {
                        setFieldValue("balance", normalizedValue);
                      }
                    }}
                  />
                </LayoutCustom>
                {/* Page 3 */}
                <LayoutCustom style={styles.page3} level="2">
                  <LayoutCustom
                    horizontal
                    itemsCenter
                    justify="space-between"
                    padding={16}
                  >
                    <LayoutCustom horizontal itemsCenter gap={16}>
                      {values.image ? (
                        <Image
                          source={{ uri: values.image }}
                          style={styles.walletSummaryImage as any}
                        />
                      ) : (
                        <Text category="h3">{values.symbol}</Text>
                      )}
                      <Text category="body">
                        {values.title.replace(values.symbol, "")}
                      </Text>
                    </LayoutCustom>
                    <Icon pack="assets" name="caret-right" />
                  </LayoutCustom>
                  <LayoutCustom
                    horizontal
                    itemsCenter
                    justify="space-between"
                    padding={16}
                  >
                    <LayoutCustom horizontal itemsCenter gap={16}>
                      <Icon
                        pack="assets"
                        name="money"
                        style={styles.iconMoney}
                      />
                      <Text category="body">
                        {displayBalance} {currency}
                      </Text>
                    </LayoutCustom>
                    <Icon pack="assets" name="caret-right" />
                  </LayoutCustom>
                </LayoutCustom>
              </ViewPager>
            </Content>
            <Button
              children={activeIndex === 2 ? t("Create a New Wallet") : t("Next")}
              onPress={() => {
                if (
                  activeIndex === 0 &&
                  values.title.length > 3 &&
                  !errors.title
                ) {
                  setActiveIndex(1);
                  refBalance.current?.focus();
                } else {
                }
                if (
                  activeIndex === 1 &&
                  Number(values.balance) > 0 &&
                  !errors.balance
                ) {
                  setActiveIndex(2);
                }
                if (activeIndex === 2) {
                  handleSubmit();
                }
              }}
              style={styles.buttonNext}
            />
          </Container>
        );
      }}
    </Formik>
  );
});

export default NewWallet;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  topNavigation: {
    paddingHorizontal: 8,
  },
  content: {},
  viewpager: {
    flex: 1,
  },
  page: {
    flex: 1,
    paddingHorizontal: 16,
  },
  page3: {
    marginHorizontal: 20,
    borderRadius: 16,
    marginTop: 16,
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
  buttonNext: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  linearText: {
    fontSize: 36,
    lineHeight: 44,
    fontFamily: "SpaceGrotesk-Bold",
    textAlign: "center",
  },
  tagCurrency: {
    top: 0,
    position: "absolute",
    right: 0,
  },
  iconMoney: {
    width: 28,
    height: 28,
    tintColor: "text-basic-color",
  },
  walletPhoto: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "background-basic-color-2",
    overflow: "hidden",
  },
  walletPhotoImage: {
    width: 96,
    height: 96,
  },
  walletSummaryImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});

const DEFAULT_WALLET_PRESETS = [
  { symbol: "💵️", title: "Cash" },
  { symbol: "👛️", title: "E-Wallet" },
  { symbol: "🏦️", title: "Bank" },
  { symbol: "🪙️", title: "Crypto" },
  { symbol: "💳️", title: "Card" },
];
