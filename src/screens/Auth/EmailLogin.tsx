import React, { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button, Icon, Input, StyleService, useStyleSheet } from '@ui-kitten/components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from 'types/navigation-types';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from 'lib/firebase';
import Container from 'components/Container';
import Content from 'components/Content';
import LayoutCustom from 'components/LayoutCustom';
import Text from 'components/Text';
import { useAppDispatch } from 'reduxs/store';
import { syncUserData } from 'services/userData';
import { useTranslation } from 'i18n/useTranslation';
import { runWithAppRequest } from 'reduxs/requestLoading';

const EmailLogin = () => {
  const styles = useStyleSheet(themedStyles);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const onSubmit = useCallback(async () => {
    if (!email || !password) {
      Alert.alert(t('Missing fields'), t('Please enter both email and password.'));
      return;
    }
    setLoading(true);
    try {
      await runWithAppRequest(async () => {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        await syncUserData(dispatch);
      });
    } catch (err: any) {
      Alert.alert(t('Sign-in failed'), err?.message ?? t('Please check your credentials and try again.'));
    } finally {
      setLoading(false);
    }
  }, [email, password, dispatch, t]);

  const onForgotPassword = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert(t('Email required'), t('Enter your email to receive a reset link.'));
      return;
    }
    setResetting(true);
    try {
      await runWithAppRequest(async () => {
        await sendPasswordResetEmail(auth, email.trim());
      });
      Alert.alert(t('Check your email'), t('Password reset link sent if the account exists.'));
    } catch (err: any) {
      Alert.alert(t('Reset failed'), err?.message ?? t('Could not send reset email.'));
    } finally {
      setResetting(false);
    }
  }, [email, t]);

  const onBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('SplashScreen');
  }, [navigation]);

  return (
    <Container style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Content contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Button
              appearance="ghost"
              accessoryLeft={<Icon pack="assets" name="arrow-left" />}
              onPress={onBack}
            />
            <Text category="h5">Sign in with Email</Text>
            <View style={{ width: 48 }} />
          </View>

          <LayoutCustom gap={16} mh={24}>
            <Input
              label={t('Email')}
              value={email}
              keyboardType="email-address"
              autoCapitalize="none"
              onChangeText={setEmail}
              placeholder={t('you@example.com')}
              textContentType="emailAddress"
              autoComplete="email"
            />
            <Input
              label={t('Password')}
              value={password}
              secureTextEntry
              onChangeText={setPassword}
              placeholder="••••••••"
              textContentType="password"
              autoComplete="password"
            />
            <Button onPress={onSubmit} disabled={loading}>
              {loading ? t('Signing in…') : t('Sign In')}
            </Button>
            <Button
              appearance="ghost"
              status="basic"
              onPress={onForgotPassword}
              disabled={resetting}
            >
              {resetting ? t('Sending…') : t('Forgot password?')}
            </Button>
            <View style={styles.linkRow}>
              <Text appearance="hint">Don't have an account?</Text>
              <Text status="primary" onPress={() => navigation.navigate('EmailSignUp')} style={styles.linkText}>
                Create one
              </Text>
            </View>
          </LayoutCustom>
        </Content>
      </KeyboardAvoidingView>
    </Container>
  );
};

export default EmailLogin;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  linkText: {
    textDecorationLine: 'underline',
  },
});
