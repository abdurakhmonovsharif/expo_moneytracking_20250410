import React from 'react';
import { Icon, useStyleSheet, StyleService } from '@ui-kitten/components';
import Text from '../Text';
import { useLayout } from 'hooks';
import { View, TouchableOpacity } from 'react-native';

interface IDecimalPadProps {
  value: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
}

const DecimalPad: React.FC<IDecimalPadProps> = ({ value, setValue }) => {
  const styles = useStyleSheet(themedStyles);
  const { width, height } = useLayout();

  const handleNumberPress = (num: string) => {
    setValue((prevValue) => prevValue + num);
  };

  const handleDecimalPress = () => {
    if (!value.includes('.')) {
      setValue((prevValue) => prevValue + '.');
    }
  };

  const handleClearPress = () => {
    setValue('');
  };
  const array = [
    { value: '1', text: '' },
    { value: '2', text: 'A B C' },
    { value: '3', text: 'D E F' },
    { value: '4', text: 'G H I' },
    { value: '5', text: 'J K L' },
    { value: '6', text: 'M N O' },
    { value: '7', text: 'P Q R S' },
    { value: '8', text: 'T U V' },
    { value: '9', text: 'W X Y Z' },
    { value: '.', text: '' },
    { value: '0', text: '' },
    { value: 'delete', text: '' },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          height: 292 * (height / 812),
        },
      ]}>
      <View style={styles.buttonContainer}>
        {array.map((item, index) => {
          const isDelete = item.value === 'delete';
          return (
            <TouchableOpacity
              style={[
                styles.button,
                { width: (width - 18) / 3 },
                isDelete && { backgroundColor: 'transparent' },
              ]}
              key={index}
              onPress={() =>
                item.value !== '.'
                  ? isDelete
                    ? handleClearPress()
                    : handleNumberPress(item.value)
                  : handleDecimalPress()
              }>
              {isDelete ? (
                <Icon pack="assets" name="delete" style={styles.iconDelete} />
              ) : (
                <>
                  <Text style={styles.buttonText}>{item.value}</Text>
                  <Text category="c2">{item.text}</Text>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const themedStyles = StyleService.create({
  container: {
    paddingTop: 8,
    backgroundColor: '#20202092',
    paddingBottom: 28,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 7,
    columnGap: 6,
    justifyContent: 'center',
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#434343',
    borderRadius: 5,
    paddingVertical: 8,
    height: 50,
  },
  buttonText: {
    fontSize: 25,
    lineHeight: 31.9,
    fontWeight: '400',
    fontFamily: 'SpaceGrotesk-Regular',
  },
  iconDelete: {
    width: 24,
    height: 24,
    tintColor: 'text-basic-color',
  },
});

export default DecimalPad;
