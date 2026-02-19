import React, { memo, useCallback, useState } from 'react';
// ----------------------------- UI kitten -----------------------------------
import { Button, Icon, StyleService, TopNavigation, useStyleSheet, useTheme } from '@ui-kitten/components';
// ----------------------------- @Types -----------------------------------
import { RootStackParamList } from 'types/navigation-types';
// ----------------------------- Navigation -----------------------------------
import { NavigationProp, useNavigation } from '@react-navigation/native';
// ----------------------------- Hooks -----------------------------------
import { useLayout } from 'hooks';
import { getGoogleSignInErrorMessage, useGoogleAuth } from 'services/googleAuthService';
import { getAppleSignInErrorMessage, useAppleAuth } from 'services/appleAuthService';
import { useAppDispatch } from 'reduxs/store';
import { syncUserData } from 'services/userData';
import { runWithAppRequest } from 'reduxs/requestLoading';
// ----------------------------- Components -----------------------------------
import { Container, Content, LayoutCustom } from 'components';
import SplashItem from './SplashItem';
import { Images } from 'assets/images';
import Pagination from './Pagination';
// ----------------------------- Reanimated 2 -----------------------------------
import Carousel from 'react-native-reanimated-carousel';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { Alert, Platform } from 'react-native';
import { useTranslation } from 'i18n/useTranslation';

const SplashScreen = memo(() => {
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const { width, height, top } = useLayout();
  const theme = useTheme();
  const progress = useSharedValue(0);
  const { signInWithGoogle, ready } = useGoogleAuth();
  const { signInWithApple, ready: appleReady } = useAppleAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const showAppleSignIn = Platform.OS === 'ios';

  const _onAppleLogin = useCallback(async () => {
    if (!appleReady) {
      Alert.alert(
        t('Apple Sign-In not configured'),
        'Apple login is only available on iOS with backend /auth/apple configured.',
      );
      return;
    }
    try {
      setAppleLoading(true);
      await runWithAppRequest(async () => {
        await signInWithApple();
        await syncUserData(dispatch);
      });
    } catch (error: unknown) {
      Alert.alert(
        t('Apple Sign-In failed'),
        getAppleSignInErrorMessage(error, t),
      );
    } finally {
      setAppleLoading(false);
    }
  }, [appleReady, dispatch, signInWithApple, t]);

  const _onGoogleLogin = useCallback(async () => {
    if (!ready) {
      Alert.alert(
        t('Google Sign-In not configured'),
        t('Set EXPO_PUBLIC_GOOGLE_* and EXPO_PUBLIC_API_BASE_URL, then restart.')
      );
      return;
    }
    try {
      setGoogleLoading(true);
      await runWithAppRequest(async () => {
        await signInWithGoogle();
        await syncUserData(dispatch);
      });
    } catch (error: unknown) {
      Alert.alert(
        t('Google Sign-In failed'),
        getGoogleSignInErrorMessage(error, t),
      );
    } finally {
      setGoogleLoading(false);
    }
  }, [ready, signInWithGoogle, dispatch, t]);

  return (
    <Container style={styles.container}>
      <TopNavigation style={styles.topNavigation} />
      <Content contentContainerStyle={styles.content}>
        <LayoutCustom style={{ zIndex: 100, height: 400 * (height / 812) }}>
          <Carousel
            data={DATA}
            scrollAnimationDuration={700}
            snapEnabled
            autoPlay
            width={width}
            onProgressChange={(e, _) => {
              progress.value = withSpring(_);
            }}
            vertical={false}
            style={{ width: width, height: 400 * (height / 812) }}
            height={400 * (height / 812)}
            renderItem={({ item, index, animationValue }) => (
              <SplashItem data={item} key={index} progress={animationValue} />
            )}
          />
          <LayoutCustom horizontal itemsCenter justify="center" mt={24}>
            {DATA.map((item, i) => {
              return (
                <Pagination
                  index={i}
                  key={i}
                  length={DATA.length}
                  backgroundColor={theme['text-basic-color']}
                  animValue={progress}
                  widthActiveIndicator={6}
                />
              );
            })}
          </LayoutCustom>
        </LayoutCustom>
        <LayoutCustom gap={16} mh={16} mb={8}>
          {showAppleSignIn && (
            <Button
              accessoryLeft={<Icon pack="assets" name="apple" />}
              children={t('Continue with Apple')}
              status="control"
              style={styles.button}
              onPress={_onAppleLogin}
              disabled={appleLoading || !appleReady}
            />
          )}
          <Button
            accessoryLeft={<Icon pack="assets" name="gg" />}
            children={t('Continue with Google')}
            status="google"
            style={styles.button}
            onPress={_onGoogleLogin}
            disabled={googleLoading || !ready}
          />
          <Button
            accessoryLeft={<Icon pack="eva" name="email-outline" />}
            children={t('Continue with Email')}
            status="primary"
            style={styles.button}
            onPress={() => navigate('EmailLogin')}
          />
        </LayoutCustom>
      </Content>
    </Container>
  );
});

export default SplashScreen;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    justifyContent: 'space-between',
    flexGrow: 1,
  },
  logo: {
    width: 40,
    height: 40,
  },
  topNavigation: {
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 20,
  },
  button: {
    flex: 1,
  },
});
const DATA = [
  {
    image: Images.splash_01,
    title: 'Smart Wallet Management',
    describe: 'Allows you to create multiple wallets, transfer money between wallets',
  },
  {
    image: Images.splash_02,
    title: 'Quickly Create Transaction',
    describe: 'Create and manage the all your transactions quickly.',
  },
  {
    image: Images.splash_03,
    title: 'Gain Control Of Spending',
    describe: 'You’ll be able to track and gain control of your spending easily with charts',
  },
];
