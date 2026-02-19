import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

type MinimalLoadingProps = {
  backgroundColor?: string;
  overlay?: boolean;
};

const DEFAULT_BACKGROUND = "#122332";
const DEFAULT_SPINNER = "#B8BDC2";

const MinimalLoading: React.FC<MinimalLoadingProps> = ({
  backgroundColor = DEFAULT_BACKGROUND,
  overlay = false,
}) => {
  return (
    <View
      style={[
        styles.container,
        overlay && styles.overlay,
        { backgroundColor },
      ]}
    >
      <ActivityIndicator size="small" color={DEFAULT_SPINNER} />
    </View>
  );
};

export default MinimalLoading;

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
});
