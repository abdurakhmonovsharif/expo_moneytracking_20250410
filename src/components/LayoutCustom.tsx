import {useTheme} from '@ui-kitten/components';
import React, {memo} from 'react';
import {TouchableOpacity} from 'react-native';
import {ILayoutCustomProps} from 'types/component-types';

const LayoutCustom: React.FC<ILayoutCustomProps> = memo(
  ({
    horizontal,
    style,
    padder,
    children,
    mt,
    mb,
    pt,
    mh,
    pl,
    mv,
    ml,
    mr,
    ph,
    pv,
    pb,
    padding,
    margin,
    itemsCenter,
    wrap,
    level,
    gap,
    rowGap,
    columnGap,
    onLongPress,
    justify ,
    onPress,
    border,
    maxWidth,
    minWidth,
    opacity,
    alignSelfCenter,
    borderStyle,
    overflow,
    ...props
  }) => {
    const theme = useTheme();
    const disabled = !!!onPress && !!!onLongPress;
    return (
      <>
        <TouchableOpacity
          onLongPress={onLongPress}
          disabled={disabled}
          activeOpacity={disabled ? 1 : 0.54}
          onPress={onPress}
          style={[
            {
              opacity: opacity,
              gap: gap,
              columnGap: columnGap,
              rowGap: rowGap,
              borderRadius: border,
              maxWidth: maxWidth,
              minWidth: minWidth,
              alignItems: itemsCenter ? 'center' : undefined,
              paddingHorizontal: padder ? 24 : ph,
              paddingBottom: pb,
              paddingLeft: pl,
              padding: padding,
              justifyContent: justify,
              marginTop: mt,
              alignSelf: alignSelfCenter ? 'center' : undefined,
              marginBottom: mb,
              flexDirection: horizontal ? 'row' : 'column',
              borderStyle: borderStyle,
              overflow: overflow,
              marginLeft: ml,
              marginRight: mr,
              marginHorizontal: mh,
              marginVertical: mv,
              paddingTop: pt,
              flexWrap: wrap ? 'wrap' : undefined,
              margin: margin,
              paddingVertical: pv,
              backgroundColor: level
                ? theme[`background-basic-color-${level}`]
                : 'transparent',
            },
            style,
          ]}
          {...props}>
          {children}
        </TouchableOpacity>
      </>
    );
  },
);

export default LayoutCustom;
