import React, { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button, Icon, Input, StyleService, useStyleSheet } from '@ui-kitten/components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from 'types/navigation-types';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from 'lib/firebase';
import Container from 'components/Container';
import Content from 'components/Content';
import LayoutCustom from 'components/LayoutCustom';
import Text from 'components/Text';
import { useAppDispatch } from 'reduxs/store';
import { syncUserData } from 'services/userData';
import { useTranslation } from 'i18n/useTranslation';
import { runWithAppRequest } from 'reduxs/requestLoading';

const EmailSignUp = () => {
  const styles = useStyleSheet(themedStyles);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const onSubmit = useCallback(async () => {
    if (!email || !password) {
      Alert.alert(t('Missing fields'), t('Please enter both email and password.'));
      return;
    }
    setCreating(true);
    try {
      await runWithAppRequest(async () => {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        await syncUserData(dispatch);
      });
    } catch (err: any) {
      Alert.alert(t('Sign-up failed'), err?.message ?? t('Please try a different email or password.'));
    } finally {
      setCreating(false);
    }
  }, [email, password, dispatch, t]);

  const onBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('EmailLogin');
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
            <Text category="h5">Create Account</Text>
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
            <Button onPress={onSubmit} disabled={creating}>
              {creating ? t('Creating…') : t('Create Account')}
            </Button>
            <View style={styles.linkRow}>
              <Text appearance="hint">Already have an account?</Text>
              <Text status="primary" onPress={() => navigation.navigate('EmailLogin')} style={styles.linkText}>
                Sign in
              </Text>
            </View>
          </LayoutCustom>
        </Content>
      </KeyboardAvoidingView>
    </Container>
  );
};

export default EmailSignUp;

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
