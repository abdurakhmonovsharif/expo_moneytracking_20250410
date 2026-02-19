import React from 'react';
import { FlatList } from 'react-native';
// ----------------------------- UI kitten -----------------------------------
import { StyleService, useStyleSheet } from '@ui-kitten/components';
// ----------------------------- Components && Elements -----------------------
import { IDivider, LayoutCustom, Text } from 'components';
import { keyExtractoUtil, waitUtil } from 'utils';

interface ITabBarProps {
  tabs: string[];
  selected: number;
  onSelect: React.Dispatch<React.SetStateAction<number>>;
}

const TabBar = ({ tabs, selected, onSelect }: ITabBarProps) => {
  const styles = useStyleSheet(themedStyles);
  const ref = React.useRef<FlatList<any>>(null);

  React.useEffect(() => {
    waitUtil(550).then(() => {
      ref.current?.scrollToItem({
        item: tabs[selected],
        animated: true,
        viewOffset: 0.5,
        viewPosition: 0.5,
      });
    });
  }, [selected, tabs]);
  return (
    <>
      <LayoutCustom style={styles.container}>
      {tabs.length > 0 && (
          <FlatList
            getItemLayout={(data, index) => ({
              length: 105,
              offset: 105 * index,
              index,
            })}
            horizontal
            ref={ref}
            data={tabs}
            showsHorizontalScrollIndicator={false}
            keyExtractor={keyExtractoUtil}
            renderItem={({ item, index }) => {
              const active = index === selected;
              return (
                <LayoutCustom
                  onPress={() => {
                    onSelect(index);
                  }}
                  key={index}
                  ph={24}
                  pv={14}
                  style={active && styles.active}>
                  <Text center category="subhead" status={active ? 'basic' : 'placeholder'}>
                    {item}
                  </Text>
                </LayoutCustom>
              );
            }}
          />
        )}
        <IDivider style={styles.divider} />
      </LayoutCustom>
    </>
  );
};

export default TabBar;

const themedStyles = StyleService.create({
  container: {
    marginBottom: 4,
  },
  active: {
    borderBottomWidth: 2,
    borderBottomColor: 'text-primary-color',
  },
  divider: {
    height: 1,
    backgroundColor: 'red',
  },
});
