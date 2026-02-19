import React from 'react';
import {  Image,  } from 'react-native';
// ----------------------------- UI kitten -----------------------------------
import { TopNavigation,Button, StyleService, useStyleSheet, useTheme } from '@ui-kitten/components';
// ----------------------------- Navigation -----------------------------------
import {  NavigationProp, useNavigation } from '@react-navigation/native';
// ----------------------------- Hooks ---------------------------------------
import { useLayout } from 'hooks';
// ----------------------------- Assets ---------------------------------------
import { Images } from 'assets/images';
// ----------------------------- Components && Elements -----------------------
import {  Content, LayoutCustom, NavigationAction, Text } from 'components';
import { RootStackParamList } from 'types/navigation-types';
import { useTranslation } from 'i18n/useTranslation';

interface ISuccessPayProps {
  onClose(): void;
}

const SuccessPay = React.memo(({ onClose }: ISuccessPayProps) => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const { height, width, top, bottom } = useLayout();
  const { t } = useTranslation();
  const size = 215 * (width / 375);
  const size_image = { width: size, height: size };

  const onExperience=()=>{onClose(); navigate('BottomBar',{screen:"Home"})}

  return (
    <LayoutCustom style={styles.container} level="1">
      <TopNavigation accessoryLeft={() => <NavigationAction onPress={onClose} />} />
      <Content contentContainerStyle={styles.content}>
        <Image source={Images.success} style={size_image} />
        <Text category="h1" center>
          Congratulations
        </Text>
        <Text category="body" center status="note">
          You have successfully upgraded to premium account
        </Text>
      </Content>
      <LayoutCustom ph={16} pv={4}>
        <Button children={t('Experience now')} onPress={onExperience}/>
      </LayoutCustom>
    </LayoutCustom>
  );
});

export default SuccessPay;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 40,
    gap: 16,
    alignItems: 'center',
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
});
