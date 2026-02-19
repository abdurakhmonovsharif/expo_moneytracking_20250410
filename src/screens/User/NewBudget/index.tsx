import React from 'react';
import { Alert, View, Image, StyleSheet } from 'react-native';
// ----------------------------- UI kitten -----------------------------------
import { TopNavigation, StyleService, useStyleSheet, Button } from '@ui-kitten/components';
// ----------------------------- Components && Elements -----------------------
import { Container, Content, LayoutCustom, NavigationAction, Text } from 'components';
import { BudgetEnumType, IBudgetProps, ITransactionProps } from 'types/redux-types';
import SelectField from './SelectField';
import { IMAGE_ICON_CATEGORY } from 'assets/IconCategory';
import BudgetCategory from './BudgetCategory';
import { Formik } from 'formik';
import { useAppDispatch, useAppSelector } from 'reduxs/store';
import { appSelector, creatBudget } from 'reduxs/reducers/app-reducer';
import { savePlanBudgetForUser } from 'services/userData';
import { waitUtil } from 'utils';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from 'types/navigation-types';
import { useTranslation } from 'i18n/useTranslation';

type FormikForm = {
  id: string | number;
  type: BudgetEnumType;
  transactions: ITransactionProps[];
  budgets_01: string;
  budgets_02: string;
  budgets_03: string;
  budgets_04: string;
  budgets_05: string;
  create_at: Date;
};

const NewBudget = React.memo(() => {
  const styles = useStyleSheet(themedStyles);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const dispatch = useAppDispatch();
  const _budget = useAppSelector(appSelector).budget;
  const { t } = useTranslation();

  const initValues: FormikForm = {
    id: 'new_budgets',
    type: BudgetEnumType.MONTHLY,
    transactions: [],
    budgets_01: '0',
    budgets_02: '0',
    budgets_03: '0',
    budgets_04: '0',
    budgets_05: '0',
    create_at: new Date(),
  };

  return (
    <Formik
      initialValues={initValues}
      onSubmit={async (values) => {
        const _newBudgets = [
          {
            id: '1',
            parentId: 'first_budget',
            image: IMAGE_ICON_CATEGORY.ic001,
            imageKey: 'ic001',
            title: 'Food & Drinks',
            balance: Number(values.budgets_01),
            create_at: new Date(),
            amount: 0,
          },
          {
            id: '2',
            parentId: 'first_budget',
            image: IMAGE_ICON_CATEGORY.ic002,
            imageKey: 'ic002',
            title: 'Shopping',
            balance: Number(values.budgets_02),
            create_at: new Date(),
            amount: 0,
          },
          {
            id: '3',
            parentId: 'first_budget',
            image: IMAGE_ICON_CATEGORY.ic003,
            imageKey: 'ic003',
            title: 'Housing',
            balance: Number(values.budgets_03),
            create_at: new Date(),
            amount: 0,
          },
          {
            id: '3',
            parentId: 'first_budget',
            image: IMAGE_ICON_CATEGORY.ic004,
            imageKey: 'ic004',
            title: 'Transportation',
            balance: Number(values.budgets_04),
            create_at: new Date(),
            amount: 0,
          },
          {
            id: '3',
            parentId: 'first_budget',
            image: IMAGE_ICON_CATEGORY.ic005,
            imageKey: 'ic005',
            title: 'Life & Entertainment',
            balance: Number(values.budgets_05),
            create_at: new Date(),
            amount: 0,
          },
        ];
        const planBudget = {
          id: 'first_budget',
          type: values.type,
          transactions: [],
          create_at: new Date(),
          budgets: _newBudgets,
        };
        try {
          await savePlanBudgetForUser(planBudget);
          dispatch(creatBudget(planBudget));
          waitUtil(1000).then(() => {
            navigate('SuccessBudget');
          });
        } catch (err: any) {
          Alert.alert(t('Create budget failed'), err?.message ?? t('Please try again.'));
        }
      }}>
      {({ handleChange, handleSubmit, setFieldValue, values }) => {
        return (
          <Container style={styles.container}>
            <TopNavigation
              title={t('Create new budget')}
              alignment="center"
              accessoryLeft={() => <NavigationAction />}
            />
            <Content contentContainerStyle={styles.content}>
              <LayoutCustom gap={12}>
                <SelectField type={values.type} setType={handleChange('type')} />
                <Text status="fade" center>
                  Set spending limits for categories
                </Text>
              </LayoutCustom>
              <LayoutCustom mt={40} gap={24}>
                <BudgetCategory
                  disabled={false}
                  data={budgets[0]}
                  balance={values.budgets_01}
                  setBalance={handleChange('budgets_01')}
                />
                <BudgetCategory
                  disabled={false}
                  data={budgets[1]}
                  balance={values.budgets_02}
                  setBalance={handleChange('budgets_02')}
                />
                <BudgetCategory
                  disabled={false}
                  data={budgets[2]}
                  balance={values.budgets_03}
                  setBalance={handleChange('budgets_03')}
                />
                <BudgetCategory
                  disabled={false}
                  data={budgets[3]}
                  balance={values.budgets_03}
                  setBalance={handleChange('budgets_03')}
                />
                <BudgetCategory
                  disabled={false}
                  data={budgets[4]}
                  balance={values.budgets_04}
                  setBalance={handleChange('budgets_04')}
                />
              </LayoutCustom>
            </Content>
            <Button
              style={styles.button}
              children={t('Create a budget')}
              onPress={() => handleSubmit()}
            />
          </Container>
        );
      }}
    </Formik>
  );
});

export default NewBudget;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 36,
  },
  button: {
    marginHorizontal: 16,
    marginBottom: 4,
  },
});
const budgets = [
  {
    id: '1',
    parentId: 'first_budget',
    image: IMAGE_ICON_CATEGORY.ic001,
    title: 'Food & Drinks',
    balance: 0,
    create_at: new Date(),
    amount: 0,
  },
  {
    id: '2',
    parentId: 'first_budget',
    image: IMAGE_ICON_CATEGORY.ic002,
    title: 'Shopping',
    balance: 0,
    create_at: new Date(),
    amount: 0,
  },
  {
    id: '3',
    parentId: 'first_budget',
    image: IMAGE_ICON_CATEGORY.ic003,
    title: 'Housing',
    balance: 0,
    create_at: new Date(),
    amount: 0,
  },
  {
    id: '3',
    parentId: 'first_budget',
    image: IMAGE_ICON_CATEGORY.ic004,
    title: 'Transportation',
    balance: 0,
    create_at: new Date(),
    amount: 0,
  },
  {
    id: '3',
    parentId: 'first_budget',
    image: IMAGE_ICON_CATEGORY.ic005,
    title: 'Life & Entertainment',
    balance: 0,
    create_at: new Date(),
    amount: 0,
  },
];
