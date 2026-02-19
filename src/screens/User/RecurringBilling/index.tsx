import * as React from "react";
import {
  Container,
  Content,
  LayoutCustom,
  LinearGradientText,
  NavigationAction,
  Text,
} from "components";
import {
  Button,
  Datepicker,
  Icon,
  Input,
  StyleService,
  TopNavigation,
  useStyleSheet,
} from "@ui-kitten/components";
import _, { isEmpty } from "lodash";
import { Image, Modal } from "react-native";
import { Images } from "assets/images";
import { useCurrencyFormatter, useLayout } from "hooks";
import { Formik } from "formik";
import { formatDate, formatNumber } from "utils";
import TagCurrency from "components/TagCurrency";
import dayjs from "dayjs";
import {
  addRecurringBillForUser,
  loadRecurringBillsForUser,
} from "services/userData";
import { useTranslation } from "i18n/useTranslation";

enum IBillTimeEnum {
  Monthly = "Monthly",
  Yearly = "Yearly",
  Weekly = "Weekly",
}
interface IBillProps {
  id: string;
  date: string;
  title: string;
  time_type: IBillTimeEnum;
  balance: number;
  imageKey?: string;
}
const RecurringBilling = () => {
  const styles = useStyleSheet(themedStyles);
  const { width, bottom } = useLayout();
  const formatCurrency = useCurrencyFormatter();
  const { t } = useTranslation();

  const refBalance = React.useRef<Input>(null);
  const refName = React.useRef<Input>(null);
  const refDate = React.useRef<Datepicker>(null);

  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());

  const [visible, setVisible] = React.useState(false);
  const [bills, setBills] = React.useState<IBillProps[]>([]);
  const [loadingBills, setLoadingBills] = React.useState(false);
  const size = 155 * (width / 375);
  const size_img = { width: size, height: size, alignSelf: "center" };

  const onCreateBill = () => {
    setVisible(true);
  };

  React.useEffect(() => {
    let mounted = true;
    setLoadingBills(true);
    loadRecurringBillsForUser()
      .then((result) => {
        if (mounted) setBills(result as IBillProps[]);
      })
      .finally(() => {
        if (mounted) setLoadingBills(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const dateLabels = React.useMemo(
    () => ({
      today: t('Today'),
      yesterday: t('Yesterday'),
      lastWeek: t('Last week'),
    }),
    [t]
  );

  return (
    <Formik
      initialValues={{
        date: formatDate(new Date(), { labels: dateLabels }),
        time_type: IBillTimeEnum.Monthly,
        balance: "",
        title: "",
      }}
      onSubmit={async (values, { resetForm }) => {
        try {
          const newBill = await addRecurringBillForUser({
            title: values.title.trim() || "Bill",
            balance: Number(values.balance || 0),
            time_type: values.time_type,
            date: selectedDate,
            imageKey: "netflix",
          });
          setBills((prev) => [...prev, newBill as IBillProps]);
          resetForm();
          setVisible(false);
        } catch (err) {
          setVisible(false);
        }
      }}
    >
      {({
        handleSubmit,
        setFieldValue,
        handleChange,
        handleBlur,
        values,
      }) => {
        const parsedBalance = Number(values.balance || 0);
        const displayBalance = Number.isFinite(parsedBalance)
          ? formatNumber({ num: parsedBalance, thousandSeparator: ".", decimalSeparator: "." })
          : "0";

        React.useEffect(() => {
          setFieldValue("date", formatDate(selectedDate, { labels: dateLabels }));
        }, [selectedDate, dateLabels, setFieldValue]);
        return (
          <Container style={styles.container}>
            <TopNavigation
              title={t("Recurring billing")}
              accessoryLeft={() => <NavigationAction />}
            />
            <Content contentContainerStyle={styles.content}>
              {loadingBills ? (
                <LayoutCustom style={styles.layoutEmpty}>
                  <Text category="h3" center marginTop={24}>
                    Loading bills...
                  </Text>
                </LayoutCustom>
              ) : isEmpty(bills) ? (
                <LayoutCustom style={styles.layoutEmpty}>
                  {/* @ts-ignore */}
                  <Image source={Images.budget} style={size_img} />
                  <Text category="h3" center marginTop={24}>
                    Create your Bill
                  </Text>
                  <Text
                    status="content"
                    center
                    marginTop={12}
                    marginBottom={32}
                  >
                    A budget app that helps you plan your income and expenses
                    and achieve your financial goals
                  </Text>
                  <Button
                    style={styles.button}
                    children={t("Create new Bill")}
                    onPress={onCreateBill}
                  />
                </LayoutCustom>
              ) : (
                <LayoutCustom mh={16}>
                  <LayoutCustom itemsCenter justify="center" gap={4} mb={24}>
                    <LinearGradientText text={"Totals Bill"} category="h5" />
                    <Text category="h2">
                      {formatCurrency(_.sumBy(bills, (i) => i.balance), 0)}
                    </Text>
                  </LayoutCustom>
                  <LayoutCustom gap={16}>
                  {bills.map((bill, index) => {
                    const billDate = dayjs(bill.date).isValid()
                      ? dayjs(bill.date).format("DD MMM YYYY")
                      : bill.date;
                    return (
                      <LayoutCustom
                        key={index}
                        horizontal
                        padding={24}
                        border={16}
                        level="2"
                        justify="space-between"
                      >
                        <LayoutCustom horizontal gap={8} itemsCenter>
                          <Image source={(bill.imageKey && (Images as any)[bill.imageKey]) || Images.netflix} />
                          <LayoutCustom gap={5}>
                            <Text
                              status="basic"
                              category="h5"
                              maxWidth={160}
                              numberOfLines={1}
                            >
                              {bill.title}
                            </Text>
                            <Text
                              category="c1"
                              style={{ color: "#5A6570" }}
                            >{`${t("exp")} ${billDate}`}</Text>
                          </LayoutCustom>
                        </LayoutCustom>
                        <LayoutCustom style={styles.billBalance}>
                          <Text status="basic" category="c1">
                            {formatCurrency(bill.balance, 0)}
                          </Text>
                        </LayoutCustom>
                      </LayoutCustom>
                    );
                  })}
                  </LayoutCustom>
                </LayoutCustom>
              )}
            </Content>
            <Modal visible={visible} animationType="slide">
              <Container style={styles.container}>
                <TopNavigation
                  title={t("Create Bill")}
                  accessoryLeft={() => (
                    <NavigationAction
                      icon="close"
                      onPress={() => {
                        setVisible(false);
                      }}
                    />
                  )}
                />
                <Content contentContainerStyle={styles.contentModal}>
                  <LayoutCustom
                    horizontal
                    justify="center"
                    itemsCenter
                    alignSelfCenter
                    onPress={() => {
                      refBalance.current?.focus();
                    }}
                  >
                    <LinearGradientText
                      text={displayBalance}
                      category="h2"
                    />
                    <LayoutCustom style={styles.tagCurrency}>
                      <TagCurrency />
                    </LayoutCustom>
                    <Input
                      ref={refBalance}
                      style={styles.inputBalance}
                      keyboardType="numeric"
                      onBlur={handleBlur("balance")}
                      onChangeText={(text) => {
                        const sanitizedValue = text.replace(/[^\d.]/g, "");
                        const segments = sanitizedValue.split(".");
                        const normalizedValue =
                          segments.length > 1
                            ? `${segments[0]}.${segments.slice(1).join("")}`
                            : segments[0];
                        setFieldValue("balance", normalizedValue);
                      }}
                    />
                  </LayoutCustom>
                  <LayoutCustom style={styles.layout} level="2">
                    <LayoutCustom
                      horizontal
                      justify="space-between"
                      padding={16}
                      itemsCenter
                      onPress={() => {
                        refName.current?.focus();
                      }}
                    >
                      <Input
                        ref={refName}
                        style={styles.inputBalance}
                        keyboardType="email-address"
                        onBlur={handleBlur("title")}
                        onChangeText={handleChange("title")}
                      />
                      <LayoutCustom horizontal itemsCenter gap={16}>
                        <Image
                          source={Images.hotdog}
                          style={{ width: 28, height: 28 }}
                        />
                        <Text category="body">{values.title}</Text>
                      </LayoutCustom>
                      <Icon
                        pack="assets"
                        name="caret-right"
                        style={styles.caret}
                      />
                    </LayoutCustom>
                    <LayoutCustom
                      horizontal
                      justify="space-between"
                      padding={16}
                      itemsCenter
                      onPress={() => {
                        refDate.current?.focus();
                      }}
                    >
                      <Datepicker
                        date={selectedDate}
                        ref={refDate}
                        min={new Date("1900-01-01")}
                        controlStyle={styles.date}
                        status="danger"
                        onSelect={setSelectedDate}
                        style={styles.date}
                        backdropStyle={styles.backdropCalendar}
                      />
                      <LayoutCustom horizontal itemsCenter gap={16}>
                        <Icon
                          pack="assets"
                          name="calendar"
                          style={styles.icon}
                        />
                        <Text category="body">{values.date}</Text>
                      </LayoutCustom>
                      <Icon
                        pack="assets"
                        name="caret-right"
                        style={styles.caret}
                      />
                    </LayoutCustom>
                    <LayoutCustom
                      horizontal
                      justify="space-between"
                      padding={16}
                      itemsCenter
                    >
                      <LayoutCustom horizontal itemsCenter gap={16}>
                        <Icon
                          pack="assets"
                          name="clock_wise"
                          style={styles.icon}
                        />
                        <Text category="body">{values.title}</Text>
                      </LayoutCustom>
                      <Icon
                        pack="assets"
                        name="caret-right"
                        style={styles.caret}
                      />
                    </LayoutCustom>
                  </LayoutCustom>
                </Content>
                <LayoutCustom mb={bottom + 12} mh={24} gap={8}>
                  <LayoutCustom
                    horizontal
                    itemsCenter
                    alignSelfCenter
                    justify="space-between"
                    mb={8}
                  >
                    {randomNumbers.map((amount, index) => {
                      return (
                        <LayoutCustom
                          style={{ width: width / 3 }}
                          pv={8}
                          key={index}
                          onPress={() => {
                            setFieldValue("balance", amount);
                          }}
                        >
                          <Text center category="subhead">
                            {amount}
                          </Text>
                        </LayoutCustom>
                      );
                    })}
                  </LayoutCustom>
                  <Button
                    children={t("Create Bill")}
                    onPress={() => {
                      handleSubmit();
                      setVisible(false);
                    }}
                  />
                </LayoutCustom>
              </Container>
            </Modal>
           {!isEmpty(bills) &&<LayoutCustom mh={16} mv={8}>
              <Button
                style={[styles.button]}
                children={t("Create new Bill")}
                onPress={onCreateBill}
              />
            </LayoutCustom>}
          </Container>
        );
      }}
    </Formik>
  );
};
export default RecurringBilling;
const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {},
  button: {
    flex: 1,
    marginBottom: 4,
  },
  layoutEmpty: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  tagCurrency: {
    marginLeft: 4,
  },
  inputBalance: {
    position: "absolute",
    zIndex: -100,
    opacity: 0,
  },
  date: {
    position: "absolute",
    zIndex: -100,
    opacity: 0,
  },
  layout: {
    borderRadius: 16,
    marginTop: 24,
    marginHorizontal: 20,
  },
  caret: {
    width: 20,
    height: 20,
    tintColor: "text-placeholder-color",
  },
  icon: {
    width: 28,
    height: 28,
    tintColor: "text-basic-color",
  },
  contentModal: {
    paddingTop: 24,
  },
  backdropCalendar: {
    backgroundColor: "background-basic-color-1",
    opacity: 0.9,
  },
  billBalance: {
    backgroundColor: "text-primary-color",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 99,
    alignSelf: "flex-start",
  },
});
const getRandomNumbers = () => {
  const min = -10000;
  const max = 10000;
  const numbers = [];

  let prevNum = Math.floor(Math.random() * (max - min + 1)) + min;
  numbers.push(prevNum);

  for (let i = 1; i < 3; i++) {
    const newMin = prevNum + 1;
    const newMax = max;
    const randomNum =
      Math.floor(Math.random() * (newMax - newMin + 1)) + newMin;
    numbers.push(randomNum);
    prevNum = randomNum;
  }

  return numbers;
};

const randomNumbers = getRandomNumbers();
