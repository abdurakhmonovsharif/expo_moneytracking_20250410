import * as React from 'react';
import { TouchableOpacity } from 'react-native';
// ----------------------------- Components && Elements -----------------------
import { LayoutCustom, Text } from 'components';
// ----------------------------- Navigation -----------------------------------
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
// ----------------------------- UI kitten -----------------------------------
import { Avatar, Icon, StyleService, useStyleSheet, useTheme } from '@ui-kitten/components';
// ----------------------------- Screen List ---------------------------------------
import HomeScreen from 'screens/User/BottomBar/Home';
import WalletScreen from 'screens/User/BottomBar/Wallet';
import ProfileScreen from 'screens/User/BottomBar/Profile';
import BudgetScreen from 'screens/User/BottomBar/Budget';
import { BottomBarStackParamList, RootStackParamList } from 'types/navigation-types';
import { Images } from 'assets/images';
import { useLayout } from 'hooks';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { appSelector } from 'reduxs/reducers/app-reducer';
import { useAppSelector } from 'reduxs/store';
import { auth } from 'lib/firebase';

const BottomTab = createBottomTabNavigator<BottomBarStackParamList>();

const BottomBarNavigator = () => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const user = useAppSelector(appSelector).user;
  const authUser = auth.currentUser;
  const profilePhotoUrl = user?.photo_url ?? authUser?.photoURL ?? null;
  const profileAvatarSource = profilePhotoUrl ? { uri: profilePhotoUrl } : Images.avatar_01;

  const _onCreateNewTransaction = () => {
    navigate('NewTransaction');
  };

  const { width, bottom } = useLayout();
  const avatar = { width: 24, height: 24 };
  function MyTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    return (
      <LayoutCustom horizontal style={styles.tabbar} level="1" pb={bottom}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const isProfileTab = route.name === 'Profile';
          const getIcon = () => {
            switch (index) {
              case 0:
                return 'house';
              case 1:
                return 'cardholder';
              case 2:
                return 'chart-line-up';
              case 3:
                return 'chart-line-up';
              default:
                break;
            }
          };
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              // The `merge: true` option makes sure that the params inside the tab screen are preserved
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };
          return (
            <TouchableOpacity
              key={index}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[
                {
                  width: 76,
                  alignItems: 'center',
                  rowGap: 4,
                  paddingVertical: 16,
                },
                index === 1 && { marginRight: 32 },
                index === 2 && { marginLeft: 32 },
              ]}>
              {isProfileTab ? (
                <Avatar source={profileAvatarSource} style={[avatar, styles.avatar] as any} />
              ) : (
                <Icon
                  pack="assets"
                  name={getIcon()}
                  style={[
                    styles.icon,
                    isFocused && {
                      tintColor: theme['text-basic-color'],
                    },
                  ]}
                />
              )}
            </TouchableOpacity>
          );
        })}
        <LayoutCustom
          style={[styles.buttonPlus, { left: width / 2 - 28 }]}
          onPress={_onCreateNewTransaction}>
          <Icon pack="assets" name={'plus'} />
        </LayoutCustom>
      </LayoutCustom>
    );
  }
  return (
    <LayoutCustom style={styles.container} level="1">
      <BottomTab.Navigator
        initialRouteName="Home"
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <MyTabBar {...props} />}>
        <BottomTab.Screen name="Home" component={HomeScreen} />
        <BottomTab.Screen name="Wallet" component={WalletScreen} />
        <BottomTab.Screen name="Budget" component={BudgetScreen} />
        <BottomTab.Screen name="Profile" component={ProfileScreen} />
      </BottomTab.Navigator>
    </LayoutCustom>
  );
};
export default BottomBarNavigator;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  tabbar: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 4,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  icon: {
    width: 24,
    height: 24,
    tintColor: 'color-basic-600',
  },
  avatar: {
    borderWidth: 1,
    borderColor: 'color-basic-700',
  },
  button: {
    borderRadius: 99,
    alignSelf: 'flex-start',
    padding: 12,
    marginTop: 4,
  },

  buttonPlus: {
    backgroundColor: 'color-primary-default',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 99,
    position: 'absolute',
    top: -16,
    borderWidth: 1,
    borderColor: 'background-basic-color-1',
  },
});
