import React from 'react';
// ----------------------------- UI kitten -----------------------------------
import { Icon, StyleService, useStyleSheet, useTheme } from '@ui-kitten/components';
// ----------------------------- Components && Elements -----------------------
import { LayoutCustom, Text } from 'components';

interface ICustomButtonProps {
  icon: string;
  title: string;
  describe: string;
  onPress(): void;
  showArrow?: boolean;
  mt?: number;
}

const CustomButton: React.FC<ICustomButtonProps> = ({
  icon,
  title,
  describe,
  onPress,
  showArrow = false,
  mt,
}) => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);

  return (
    <LayoutCustom
      style={styles.container}
      onPress={onPress}
      horizontal
      justify="space-between"
      mt={mt}>
      <LayoutCustom horizontal itemsCenter gap={16} style={styles.leftContent}>
        <LayoutCustom style={styles.layoutIcon}>
          <Icon pack="assets" name={icon} style={styles.icon} />
        </LayoutCustom>
        <LayoutCustom gap={4} style={styles.textBlock}>
          <Text category="h5" numberOfLines={1} ellipsizeMode="tail">
            {title}
          </Text>
          <Text category="subhead" status="content" numberOfLines={1} ellipsizeMode="tail">
            {describe}
          </Text>
        </LayoutCustom>
      </LayoutCustom>
      {showArrow && (
        <Icon
          pack="assets"
          name={'caret-right'}
          style={[styles.icon, { tintColor: theme['text-platinum-color'] }]}
        />
      )}
    </LayoutCustom>
  );
};

export default CustomButton;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'background-basic-color-2',
    alignItems: 'center',
  },
  content: {},
  layoutIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: `#3f4c59`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftContent: {
    flex: 1,
    minWidth: 0,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  icon: {
    width: 28,
    height: 28,
    tintColor: 'text-basic-color',
  },
});
