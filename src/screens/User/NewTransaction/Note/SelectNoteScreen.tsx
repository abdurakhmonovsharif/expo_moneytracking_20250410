import React from 'react';
import { Alert, Image, ImageSourcePropType } from 'react-native';

// ----------------------------- UI kitten -----------------------------------
import { TopNavigation, Button, StyleService, useStyleSheet, Input } from '@ui-kitten/components';

// ----------------------------- Hooks ---------------------------------------
import { useLayout } from 'hooks';

// ----------------------------- Assets ---------------------------------------
import { Images } from 'assets/images';

// ----------------------------- Components && Elements -----------------------
import { Container, Content, LayoutCustom, NavigationAction, Text } from 'components';
import { INoteTransactionProps } from 'types/redux-types';
import { waitUtil } from 'utils';
import { useTranslation } from 'i18n/useTranslation';
import { pickImageFromCamera, pickImageFromLibrary } from 'services/mediaPicker';

interface ISelectNoteScreenProps {
  onSelect: React.Dispatch<React.SetStateAction<INoteTransactionProps | undefined>>;
  onClose(): void;
  note?: INoteTransactionProps | undefined;
}

const SelectNoteScreen: React.FC<ISelectNoteScreenProps> = ({ note, onSelect, onClose }) => {
  const styles = useStyleSheet(themedStyles);
  const { height, width } = useLayout();
  const { t } = useTranslation();

  const [textNote, setTextNote] = React.useState<string | undefined>(note?.textNote);
  const [selectedImg, setSelectedImg] = React.useState<ImageSourcePropType | undefined>(
    note?.images
  );
  const size = 80 * (width / 375);
  const img_size = { width: size, height: size };

  const selectedUri =
    selectedImg &&
    typeof selectedImg === 'object' &&
    !Array.isArray(selectedImg) &&
    'uri' in selectedImg &&
    typeof selectedImg.uri === 'string'
      ? selectedImg.uri
      : null;

  const _onDone = () => {
    const nextText =
      typeof textNote === 'string' && textNote.trim().length > 0 ? textNote.trim() : undefined;
    if (!nextText && !selectedImg) {
      onSelect(undefined);
    } else {
      onSelect({ textNote: nextText, images: selectedImg });
    }
    waitUtil(750).then(() => {
      onClose();
    });
  };

  const onPressCameraTile = () => {
    const onPickCamera = async () => {
      try {
        const uri = await pickImageFromCamera();
        if (uri) {
          setSelectedImg({ uri });
        }
      } catch (error: unknown) {
        Alert.alert(
          t('Permission needed'),
          error instanceof Error ? error.message : t('Please try again.')
        );
      }
    };

    const onPickGallery = async () => {
      try {
        const uri = await pickImageFromLibrary();
        if (uri) {
          setSelectedImg({ uri });
        }
      } catch (error: unknown) {
        Alert.alert(
          t('Permission needed'),
          error instanceof Error ? error.message : t('Please try again.')
        );
      }
    };

    const buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[] = [
      { text: t('Use camera'), onPress: () => void onPickCamera() },
      { text: t('Choose from gallery'), onPress: () => void onPickGallery() },
    ];

    if (selectedUri) {
      buttons.push({
        text: t('Remove photo'),
        style: 'destructive',
        onPress: () => setSelectedImg(undefined),
      });
    }

    buttons.push({ text: t('Cancel'), style: 'cancel' });
    Alert.alert(t('Choose image source'), undefined, buttons);
  };

  return (
    <Container style={[styles.container, { height: height }]} level="1">
      <TopNavigation
        title={t('Add Note')}
        alignment="center"
        accessoryLeft={() => <NavigationAction onPress={onClose} />}
      />
      <Content contentContainerStyle={styles.content}>
        <Input
          style={styles.input}
          status="note"
          size="note"
          multiline
          onChangeText={setTextNote}
          value={textNote}
          textStyle={styles.textStyle}
          placeholder={t('Write something about transaction')}
        />
        <Text marginBottom={16} marginLeft={2} category="h5">
          {t('Photos')}
        </Text>
        <LayoutCustom horizontal wrap gap={8}>
          <LayoutCustom onPress={onPressCameraTile}>
            {/* @ts-ignore */}
            <Image
              source={selectedUri ? { uri: selectedUri } : Images.take_photo}
              style={[
                styles.image,
                img_size,
                selectedUri && { borderColor: '#CFE1FD' },
              ] as any}
            />
          </LayoutCustom>
          {images.map((item, index) => {
            const isActive = item === selectedImg;
            return (
              <LayoutCustom
                key={index}
                onPress={() => {
                  setSelectedImg(item);
                }}>
                <Image
                  source={item}
                  //@ts-ignore
                  style={[styles.image, img_size, isActive && { borderColor: '#CFE1FD' }] as any}
                />
              </LayoutCustom>
            );
          })}
        </LayoutCustom>
      </Content>
      <Button children={t('Done')} style={styles.button} onPress={_onDone} />
    </Container>
  );
};

export default SelectNoteScreen;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    height: 120,
  },
  textStyle: {
    marginHorizontal: 0,
  },
  image: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  button: {
    marginHorizontal: 8,
    marginBottom: 4,
  },
});

const images = [
  Images.photo_01,
  Images.photo_02,
  Images.photo_03,
  Images.photo_04,
  Images.photo_05,
  Images.photo_06,
  Images.photo_07,
];
