import React from 'react';
import { Image } from 'react-native';

import { IDivider, LayoutCustom, Text } from 'components';
import { useStyleSheet, StyleService, Divider } from '@ui-kitten/components';
import { ICategoryProps } from 'types/redux-types';
import { IMAGE_ICON_CATEGORY } from 'assets/IconCategory';
import { waitUtil } from 'utils';

interface ButtonSelectCategoryProps {
  props: ICategoryProps;
  isOpen: boolean;
  lastItem: boolean;
  onSelect: React.Dispatch<React.SetStateAction<ICategoryProps>>;
  onClose(): void;
}

const ButtonSelectCategory: React.FC<ButtonSelectCategoryProps> = ({
  props,
  lastItem,
  isOpen,
  onSelect,
  onClose,
}) => {
  const styles = useStyleSheet(themedStyles);
  const size = { width: 24, height: 24 };

  const _onSelect = (item: ICategoryProps) => () => {
    onSelect(item);
    waitUtil(750).then(() => {
      onClose();
    });
  };

  return (
    <LayoutCustom style={styles.container}>
      <LayoutCustom itemsCenter horizontal gap={12} mb={17} onPress={_onSelect(props)}>
        <Image source={IMAGE_ICON_CATEGORY[props.icon]} style={size} />
        <Text category="h4">{props.name}</Text>
      </LayoutCustom>
      {!lastItem && isOpen && <IDivider />}
      {isOpen && (
        <LayoutCustom mt={16} gap={16}>
          {props.children &&
            props.children.map((item, index) => {
              const isLastItem = props.children && props.children.length - 1 === index;
              return (
                <LayoutCustom key={index} ml={36} onPress={_onSelect(item)}>
                  <LayoutCustom itemsCenter horizontal gap={12} mb={17}>
                    <Image source={IMAGE_ICON_CATEGORY[item.icon]} style={size} />
                    <Text category="body">{item.name}</Text>
                  </LayoutCustom>
                  {!isLastItem && lastItem && <IDivider />}
                  {!lastItem && <Divider />}
                </LayoutCustom>
              );
            })}
        </LayoutCustom>
      )}
    </LayoutCustom>
  );
};

export default ButtonSelectCategory;

const themedStyles = StyleService.create({
  container: {
    paddingBottom: 17,
  },
});
