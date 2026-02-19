import React from "react";
import { View, Image, StyleSheet } from "react-native";

import { LayoutCustom, Text } from "components";
import { Icon, useStyleSheet, StyleService } from "@ui-kitten/components";

interface OptionButtonProps {
  title: string;
  describe: string;
  icon: string;
  onPress?(): void;
}

const OptionButton: React.FC<{ data: OptionButtonProps }> = ({ data }) => {
  const styles = useStyleSheet(themedStyles);
  const { title, describe, icon, onPress } = data;
  return (
    <LayoutCustom
      style={styles.container}
      onPress={onPress}
      horizontal
      justify="space-between"
      itemsCenter
    >
      <LayoutCustom style={styles.layoutIcon}>
        <Icon pack="assets" name={icon} style={[styles.icon]} />
      </LayoutCustom>
      <LayoutCustom gap={8} style={{ flex: 1 }}>
        <Text category="h4">{title}</Text>
        <Text category="subhead" status="note">
          {describe}
        </Text>
      </LayoutCustom>
    </LayoutCustom>
  );
};

export default OptionButton;

const themedStyles = StyleService.create({
  container: {
    gap: 16,
  },
  layoutIcon: {
    width: 48,
    height: 48,
    borderRadius: 99,
    backgroundColor: "background-basic-color-1",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 28,
    height: 28,
  },
});
