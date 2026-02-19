import React from 'react';
import { Alert, Image, Modal } from 'react-native';
// ----------------------------- UI kitten -----------------------------------
import { Button, Datepicker, StyleService, TopNavigation, useStyleSheet } from '@ui-kitten/components';
// ----------------------------- Navigation -----------------------------------
import { NavigationProp, useNavigation } from '@react-navigation/native';
// ----------------------------- Hooks ---------------------------------------
import { useCurrencyConversion, useLayout } from 'hooks';
// ----------------------------- Assets ---------------------------------------
import { IMAGE_ICON_CATEGORY } from 'assets/IconCategory';
// ----------------------------- Components -----------------------
import { Container, Content, LayoutCustom, LinearGradientText, NavigationAction } from 'components';
import DecimalPad from 'components/DecimalPad';
import TagCurrency from 'components/TagCurrency';

// ----------------------------- Elements -----------------------
import TabBarWallet from './elements/TabBarWallet';
import CustomSelect from './elements/CustomSelect';
import SelectCategoryScreen from './Categories/SelectCategory';
import SelectWalletScreen from './Wallet/SelectWalletScreen';

// ----------------------------- Reduxs -----------------------
import { useAppDispatch, useAppSelector } from 'reduxs/store';
import { appSelector, addTransaction } from 'reduxs/reducers/app-reducer';
import { addTransactionForUser } from 'services/userData';

// ----------------------------- Other -----------------------
import { isEmpty } from 'lodash';
import { expenseCategories, incomeCategories } from './data';

// ----------------------------- Utils -----------------------
import { formatDate, formatNumber, getWalletNetBalance, waitUtil } from 'utils';

// ----------------------------- Types -----------------------
import { RootStackParamList } from 'types/navigation-types';
import {
  ICategoryProps,
  INoteTransactionProps,
  IWalletProps,
  TransactionEnumType,
} from 'types/redux-types';
import SelectNoteScreen from './Note/SelectNoteScreen';
import { useTranslation } from 'i18n/useTranslation';

const NewTransaction = React.memo(() => {
  const styles = useStyleSheet(themedStyles);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const { width, height } = useLayout();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const list_wallet = useAppSelector(appSelector).wallets;
  const currency = useAppSelector(appSelector).currency;
  const { convert } = useCurrencyConversion();
  const refDate = React.useRef<Datepicker>(null);

  const [visible, setVisible] = React.useState(false);
  const [visibleWallet, setVisibleWallet] = React.useState(false);
  const [visivleCalendar, setVisibleCalendar] = React.useState(false);
  const [visivleNote, setVisibleNote] = React.useState(false);

  const [show, setShow] = React.useState(true);
  const [tabActive, setTabActive] = React.useState(0);

  const [balance, setBalance] = React.useState('');
  const [note, setNote] = React.useState<INoteTransactionProps | undefined>();
  const [selectedWallet, setSelectedWallet] = React.useState<IWalletProps>(list_wallet[0]);
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
  const [selectedCategory, setSelectedCategory] = React.useState<ICategoryProps>({
    id: 1,
    parentId: 1,
    name: 'Food & Drinks',
    icon: 'ic001',
  });

  const toggle = () => {
    show ? setShow(false) : setShow(true);
  };
  const _onCreateNewWallet = () => {
    navigate('NewWallet');
  };
  const _onSelectWallet = () => {
    setVisibleWallet(true);
  };
  const _onSelectCategories = () => {
    setVisible(true);
  };
  const _onCreateNote = () => {
    setVisibleNote(true);
  };
  const _onSelectDate = () => {
    setShow(false);
    refDate.current?.focus();
  };

  const dateLabels = React.useMemo(
    () => ({
      today: t('Today'),
      yesterday: t('Yesterday'),
      lastWeek: t('Last week'),
    }),
    [t]
  );

  const _onAddTransaction = async () => {
    const _findIndex = list_wallet.findIndex((wallet) => wallet.id === selectedWallet.id);
    const _type = tabActive === 0 ? TransactionEnumType.EXPENSESE : TransactionEnumType.INCOME;
    const enteredAmount = Number(balance);
    if (_findIndex < 0) {
      Alert.alert(t('Wallet not found'), t('Please select a wallet.'));
      return;
    }
    if (!balance || !Number.isFinite(enteredAmount) || enteredAmount <= 0) {
      Alert.alert(t('Invalid amount'), t('Please enter a valid amount.'));
      return;
    }
    if (_type === TransactionEnumType.EXPENSESE) {
      const availableBalance = Math.max(0, getWalletNetBalance(selectedWallet, convert));
      if (enteredAmount > availableBalance + 1e-9) {
        Alert.alert(t('Invalid amount'), t('Expense amount exceeds wallet balance.'));
        return;
      }
    }
    try {
      const transaction = await addTransactionForUser({
        walletId: selectedWallet.id,
        categoryId: selectedCategory.id,
        balance: enteredAmount,
        date: selectedDate,
        type: _type,
        currency,
        note: note,
        category: selectedCategory,
      });
      dispatch(
        addTransaction({
          walletIndex: _findIndex,
          transaction,
        }),
      );
      waitUtil(1000).then(() => {
        navigate('BottomBar', { screen: 'Home' });
      });
    } catch (err: any) {
      Alert.alert(t('Add transaction failed'), err?.message ?? t('Please try again.'));
    }
  };
  // id: number | string;
  // userId: number | string;
  // walletId: number | string;
  // categoryId: number | string;
  // balance: number;
  // date: string;
  // type: TransactionEnumType;
  // note: INoteTransactionProps;
  // category: ICategoryProps;

  return (
    <Container style={styles.container}>
      {/* Header */}
      <TopNavigation
        title={t('Add transaction')}
        alignment="center"
        accessoryLeft={() => <NavigationAction />}
      />
      <Content contentContainerStyle={styles.content}>
        <TabBarWallet tabActive={tabActive} onChangeTab={setTabActive} />
        {/* Amount */}
        <LayoutCustom onPress={toggle} horizontal itemsCenter mv={24} alignSelfCenter gap={4}>
          <LinearGradientText
            text={
              balance === ''
                ? '0.00'
                : formatNumber({ num: Number(balance), thousandSeparator: '.', decimalSeparator: '.' })
            }
            category="h2"
          />
          <TagCurrency />
        </LayoutCustom>
        {/* Select Field */}
        <LayoutCustom style={styles.selectField} level="2">
          {isEmpty(list_wallet) ? (
            <CustomSelect title={t('Create a New Wallet')} icon="wallet" onPress={_onCreateNewWallet} />
          ) : (
            <CustomSelect
              title={selectedWallet.title}
              symbol={selectedWallet.symbol}
              onPress={_onSelectWallet}
            />
          )}
          <CustomSelect
            title={selectedCategory.name}
            image={IMAGE_ICON_CATEGORY[selectedCategory.icon]}
            onPress={_onSelectCategories}
          />
          <LayoutCustom onPress={_onSelectDate}>
            <Datepicker
              date={selectedDate}
              ref={refDate}
              min={new Date('1900-01-01')}
              controlStyle={styles.date}
              status="danger"
              onSelect={setSelectedDate}
              style={styles.date}
              backdropStyle={styles.backdropCalendar}
            />
            <CustomSelect title={formatDate(selectedDate, { labels: dateLabels })} icon={'calendar'} />
          </LayoutCustom>
          <CustomSelect
            onPress={_onCreateNote}
            title={note?.textNote ? note.textNote : t('Note')}
            icon={'camera'}
          />
        </LayoutCustom>
        {note?.images && (
          <Image
            source={note.images}
            borderRadius={16}
            style={{
              marginTop: 16,
              width: width - 40,
              height: 144 * (height / 812),
            }}
          />
        )}
      </Content>
      {/* Footer */}
      {show && <LayoutCustom onPress={() => setShow(false)} style={styles.backdrop} />}
      <LayoutCustom style={{ zIndex: 1000 }}>
        <Button children={t('Add Transactions')} style={styles.button} onPress={_onAddTransaction} />
        {show && (
          <LayoutCustom>
            <DecimalPad value={balance} setValue={setBalance} />
          </LayoutCustom>
        )}
      </LayoutCustom>
      {/* Modal Select Wallet */}
      <Modal visible={visibleWallet} style={styles.modalStyle}>
        <SelectWalletScreen
          current_wallet={selectedWallet}
          onSelect={setSelectedWallet}
          data={list_wallet}
          onClose={() => {
            setVisibleWallet(false);
          }}
        />
      </Modal>
      {/* Modal Select Category */}
      <Modal visible={visible} style={styles.modalStyle}>
        <SelectCategoryScreen
          onSelect={setSelectedCategory}
          data={tabActive === 0 ? expenseCategories : incomeCategories}
          onClose={() => {
            setVisible(false);
          }}
        />
      </Modal>

      {/* Modal Select Calendar */}
      <Modal visible={visivleCalendar} style={styles.modalStyle}>
        <SelectWalletScreen
          current_wallet={selectedWallet}
          onSelect={setSelectedWallet}
          data={list_wallet}
          onClose={() => {
            setVisibleWallet(false);
          }}
        />
      </Modal>
      <Modal visible={visivleNote} style={styles.modalStyle} presentationStyle="fullScreen">
        <SelectNoteScreen
          note={note}
          onSelect={setNote}
          onClose={() => {
            setVisibleNote(false);
          }}
        />
      </Modal>
    </Container>
  );
});

export default NewTransaction;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: '40%',
  },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'background-basic-color-2',
  },
  date: {
    position: 'absolute',
    zIndex: -100,
    opacity: 0,
    width: '100%',
    alignSelf: 'center',
    left: 4,
    right: 4,
  },
  button: {
    marginHorizontal: 8,
    marginBottom: 8,
  },
  selectField: {
    borderRadius: 16,
  },
  backdrop: {
    backgroundColor: 'transparent',
    position: 'absolute',
    height: '100%',
    width: '100%',
    zIndex: 100,
  },
  modalStyle: {
    width: '100%',
    height: '100%',
    backgroundColor: 'background-basic-color-1',
  },
  backdropCalendar: {
    backgroundColor: 'background-basic-color-1',
    opacity: 0.9,
  },
  imageNote: {},
});
