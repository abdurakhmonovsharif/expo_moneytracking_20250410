import React from 'react';
import { Image, ImageSourcePropType } from 'react-native';
import { useStyleSheet, StyleService } from '@ui-kitten/components';
import { Text, LayoutCustom } from 'components';
import { Icon } from '@ui-kitten/components';
import { useLayout } from 'hooks';

interface ICustomSelectProps {
  symbol?: string | undefined;
  title: string;
  onPress?(): void;
  image?: ImageSourcePropType | undefined;
  icon?: string;
}

const CustomSelect: React.FC<ICustomSelectProps> = ({ symbol, title, onPress, image, icon }) => {
  const styles = useStyleSheet(themedStyles);
  const {width}=useLayout()

  return (
    <LayoutCustom horizontal itemsCenter justify="space-between" onPress={onPress} padding={16}>
      <LayoutCustom horizontal itemsCenter gap={16}>
        {symbol && <Text category="h3">{symbol}</Text>}
        {/* @ts-ignore */}
        {image && <Image source={image} style={styles.image} />}
        {icon && <Icon pack="assets" name={icon} style={styles.icon} />}
        <Text category="body" numberOfLines={1} maxWidth={250*(width/375)}>{title}</Text>
      </LayoutCustom>
      <Icon pack="assets" name="caret-right" style={styles.caret} />
    </LayoutCustom>
  );
};

export default CustomSelect;

const themedStyles = StyleService.create({
  container: {},
  caret: {
    tintColor: 'text-platinum-color',
    width: 20,
    height: 20,
  },
  image: {
    width: 28,
    height: 28,
  },
  icon: {
    tintColor: 'text-basic-color',
    width: 28,
    height: 28,
  },
});
