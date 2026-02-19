import React from 'react';
import { View, Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { Text, LayoutCustom } from 'components';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useLayout } from 'hooks';

interface ISplashItemProps {
  image: ImageSourcePropType;
  title: string;
  describe: string;
}

const SplashItem: React.FC<{
  data: ISplashItemProps;
  progress: Animated.SharedValue<number>;
}> = ({ data, progress }) => {
  const { width, top } = useLayout();

  const size_img = { width: 260 * (width / 375), height: 240 * (width / 375) };
  const styled = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [-1, 0, 1], [0.8, 1, 0.8]);
    const opacity = interpolate(progress.value, [-1, 0, 1], [0.4, 1, 0.4]);
    return {
      transform: [{ scale: scale }],
      flex: 1,
      opacity,
    };
  });
  return (
    <Animated.View style={styled}>
      <View style={[styles.container]}>
        <Image source={data.image} style={size_img} />
        <LayoutCustom mh={32} gap={12}>
          <Text category="h3" center status="basic">
            {data.title}
          </Text>
          <Text category="body" status="content" center>
            {data.describe}
          </Text>
        </LayoutCustom>
      </View>
    </Animated.View>
  );
};

export default SplashItem;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 28,
    alignItems: 'center',
  },
});
