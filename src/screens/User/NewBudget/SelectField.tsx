import React from 'react';
import { Modal } from 'react-native';
// ----------------------------- UI kitten -----------------------------------
import { StyleService, useStyleSheet, useTheme, Icon } from '@ui-kitten/components';
// ----------------------------- Components && Elements -----------------------
import { LayoutCustom, LinearGradientText, Text } from 'components';
import { BudgetEnumType } from 'types/redux-types';

interface ISelectFieldProps {
  type: BudgetEnumType;
  setType(text: string): void;
}

const SelectField = React.memo(({ type, setType }: ISelectFieldProps) => {
  const styles = useStyleSheet(themedStyles);
  const [active, setActive] = React.useState(false);
  const togge = () => {
    setActive(!active);
  };

  return (
    <LayoutCustom style={styles.container}>
      <LayoutCustom itemsCenter horizontal gap={4} onPress={togge} alignSelfCenter>
        <LayoutCustom horizontal itemsCenter gap={8}>
          <Text category="h3">Plan for</Text>
          <LinearGradientText text={type} category="h3" />
        </LayoutCustom>
        <Icon
          pack="assets"
          name={'caret_linear'}
          style={[styles.icon, active && styles.iconActive]}
        />
      </LayoutCustom>
      <Modal transparent visible={active}>
        <LayoutCustom justify="flex-end" style={styles.modal}>
          <LayoutCustom level="1" style={styles.modalContent}>
            {OPTIONS.map((item, index) => {
              const isActive = item === type;
              return (
                <LayoutCustom
                  key={index}
                  onPress={() => {
                    setType(item);
                    togge();
                  }}>
                  <Text category="h4" center status={isActive ? 'basic' : 'fade'}>
                    {item}
                  </Text>
                </LayoutCustom>
              );
            })}
          </LayoutCustom>
        </LayoutCustom>
      </Modal>
    </LayoutCustom>
  );
});

export default SelectField;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {},
  icon: {
    width: 24,
    height: 24,
  },
  iconActive: {
    transform: [{ rotate: '180deg' }],
  },
  modal: {
    backgroundColor: '#88909840',
    flex: 1,
  },
  modalContent: {
    paddingTop: 32,
    gap: 30,
    paddingBottom: 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
});
const OPTIONS = [BudgetEnumType.MONTHLY, BudgetEnumType.YEARLY, BudgetEnumType.WEEKLY];
