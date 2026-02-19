import React from 'react';
import { Image, Modal } from 'react-native';

import { LayoutCustom, Text, DecimalPad } from 'components';
import { IBudgetProps } from 'types/redux-types';
import { Button, StyleService, useStyleSheet } from '@ui-kitten/components';
import { useCurrencyFormatter } from 'hooks';

interface BudgetCategoryProps {
  data: IBudgetProps;
  disabled: boolean;
  balance: string;
  setBalance: (text: string) => void;
}

const BudgetCategory: React.FC<BudgetCategoryProps> = ({ data, disabled, balance, setBalance }) => {
  const styles = useStyleSheet(themedStyles);
  const formatCurrency = useCurrencyFormatter();

  const [show, setShow] = React.useState(false);
  const [value, setValue] = React.useState(balance);

  return (
    <LayoutCustom>
      <LayoutCustom
        onPress={() => {
          disabled ? null : setShow(!show);
        }}
        style={styles.content}>
        <LayoutCustom gap={12} horizontal itemsCenter>
          {data.image && <Image source={data.image} style={{ width: 24, height: 24 }} />}
          <Text category="h6">{data.title}</Text>
        </LayoutCustom>
        <LayoutCustom horizontal itemsCenter style={styles.balance} level="2">
          <Text category="subhead" margin={8}>
            {value ? formatCurrency(Number(value), 2) : formatCurrency(0, 2)}
          </Text>
        </LayoutCustom>
      </LayoutCustom>
      <Modal visible={show} transparent>
        <LayoutCustom justify="flex-end" style={styles.modal}>
          <LayoutCustom
            style={styles.backdrop}
            onPress={() => {
              setShow(false);
              setBalance(value)
            }}
          />
          <LayoutCustom style={styles.modalContent} level="3">
            <DecimalPad value={value} setValue={setValue} />
          </LayoutCustom>
        </LayoutCustom>
      </Modal>
    </LayoutCustom>
  );
};

export default BudgetCategory;

const themedStyles = StyleService.create({
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 17,
    marginHorizontal: 24,
  },
  input: {
    position: 'absolute',
    opacity: 0,
  },
  balance: {
    borderRadius: 8,
    backgroundColor: 'background-basic-color-2',
  },
  modal: {
    backgroundColor: '#88909812',
    flex: 1,
  },
  modalContent: {
    overflow: 'hidden',
    paddingBottom: 4,
    backgroundColor: '#202020',
  },
  buttonConfirm: {
    marginHorizontal: 16,
    marginBottom: 4,
  },
  backdrop: {
    backgroundColor: 'transparent',
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: -10,
  },
});
