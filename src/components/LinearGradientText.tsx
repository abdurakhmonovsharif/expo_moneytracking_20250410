import React, { FC } from 'react';
import { Text, TextStyle } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { TextSizeCategory } from 'types/component-types';
import { useStyleSheet, StyleService } from '@ui-kitten/components';
import { useTranslation } from 'i18n/useTranslation';

interface Props {
  text: string | React.ReactNode;
  textStyle?: TextStyle;
  colors?: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  category?: TextSizeCategory;
}
const fontFamily = { bold: 'SpaceGrotesk-Bold', regular: 'SpaceGrotesk-Regular' };

export const LinearGradientText: FC<Props> = (props) => {
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation();
  const {
    text,
    textStyle = {},
    colors = ['#FFFDE1', '#CFE1FD'],
    start = { x: 1, y: 1 },
    end = { x: 0, y: 0 },
    category = 'body',
  } = props;
  const resolvedText = typeof text === 'string' ? t(text) : text;
  const styleMap: { [key: string]: any } = {
    giant: styles.giant,
    h0: styles.h0,
    h1: styles.h1,
    h2: styles.h2,
    h3: styles.h3,
    h4: styles.h4,
    h5: styles.h5,
    h6: styles.h6,
    body: styles.body,
    subhead: styles.subhead,
    footnote: styles.footnote,
    c1: styles.c1,
    c2: styles.c2,
  };

  const _textStyle = styleMap[category] || styles.body;
  const gradientColors: [string, string, ...string[]] =
    colors.length >= 2 ? ([...colors] as [string, string, ...string[]]) : ['#FFFDE1', '#CFE1FD'];

  return (
    // @ts-ignore
    <MaskedView
      maskElement={<Text style={[styles.maskText, { ..._textStyle }, textStyle]}>{resolvedText}</Text>}>
      <LinearGradient
        colors={gradientColors}
        start={start}
        end={end}
        children={<Text style={[styles.text, { ..._textStyle }]}>{resolvedText}</Text>}
      />
    </MaskedView>
  );
};

const themedStyles = StyleService.create({
  maskText: {
    backgroundColor: 'transparent',
  },
  text: {
    opacity: 0,
  },
  giant: {
    fontSize: 48,
    fontWeight: '700',
    fontFamily: fontFamily.bold,
    lineHeight: 54,
  },
  h0: {
    fontSize: 36,
    fontWeight: '700',
    fontFamily: fontFamily.bold,
    lineHeight: 44,
  },
  h1: {
    fontSize: 32,
    fontWeight: '700',
    fontFamily: fontFamily.bold,
    lineHeight: 40,
  },
  h2: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: fontFamily.bold,
    lineHeight: 40,
  },
  h3: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: fontFamily.bold,
    lineHeight: 32,
  },
  h4: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: fontFamily.bold,
    lineHeight: 24,
  },
  h5: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk-Bold',
    lineHeight: 24,
  },
  h6: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fontFamily.bold,
    lineHeight: 22,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    fontFamily: fontFamily.regular,
    lineHeight: 24,
  },
  subhead: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
  footnote: {
    fontSize: 13,
    fontWeight: '400',
    fontFamily: fontFamily.regular,
    lineHeight: 18,
  },
  c1: {
    fontSize: 12,
    fontWeight: '400',
    fontFamily: fontFamily.regular,
    lineHeight: 16,
  },
  c2: {
    fontSize: 10,
    fontWeight: '400',
    fontFamily: fontFamily.regular,
    lineHeight: 13,
  },
});
