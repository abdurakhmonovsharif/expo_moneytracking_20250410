import React from "react";
import { Alert } from "react-native";
import {
  Avatar,
  Button,
  Icon,
  Input,
  StyleService,
  TopNavigation,
  useStyleSheet,
} from "@ui-kitten/components";
import { Container, Content, LayoutCustom, NavigationAction, Text } from "components";
import { useTranslation } from "i18n/useTranslation";
import { Images } from "assets/images";
import { pickImageFromCamera, pickImageFromLibrary } from "services/mediaPicker";

type EditProfileModalProps = {
  name: string;
  email?: string | null;
  photoUrl?: string | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (nextName: string, nextPhotoUrl: string | null) => void;
};

const EditProfileModal: React.FC<EditProfileModalProps> = ({
  name,
  email,
  photoUrl,
  saving = false,
  onClose,
  onSave,
}) => {
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation();
  const [nextName, setNextName] = React.useState(name ?? "");
  const [nextPhotoUrl, setNextPhotoUrl] = React.useState<string | null>(
    photoUrl ?? null
  );

  React.useEffect(() => {
    setNextName(name ?? "");
  }, [name]);

  React.useEffect(() => {
    setNextPhotoUrl(photoUrl ?? null);
  }, [photoUrl]);

  const avatarSource = nextPhotoUrl ? { uri: nextPhotoUrl } : Images.avatar_01;

  const onSelectProfilePhoto = () => {
    const onPickFromCamera = async () => {
      try {
        const uri = await pickImageFromCamera();
        if (uri) {
          setNextPhotoUrl(uri);
        }
      } catch (error: unknown) {
        Alert.alert(
          t("Permission needed"),
          error instanceof Error ? error.message : t("Please try again.")
        );
      }
    };
    const onPickFromGallery = async () => {
      try {
        const uri = await pickImageFromLibrary();
        if (uri) {
          setNextPhotoUrl(uri);
        }
      } catch (error: unknown) {
        Alert.alert(
          t("Permission needed"),
          error instanceof Error ? error.message : t("Please try again.")
        );
      }
    };

    const buttons: {
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }[] = [
      { text: t("Use camera"), onPress: () => void onPickFromCamera() },
      { text: t("Choose from gallery"), onPress: () => void onPickFromGallery() },
    ];
    if (nextPhotoUrl) {
      buttons.push({
        text: t("Remove photo"),
        style: "destructive",
        onPress: () => setNextPhotoUrl(null),
      });
    }
    buttons.push({ text: t("Cancel"), style: "cancel" });
    Alert.alert(t("Profile photo"), t("Choose image source"), buttons);
  };

  const handleSave = () => {
    const trimmed = nextName.trim();
    if (!trimmed) {
      Alert.alert(t("Invalid name"), t("Please enter your name."));
      return;
    }
    onSave(trimmed, nextPhotoUrl ?? null);
  };

  return (
    <Container>
      <TopNavigation
        title={t("Edit Profile")}
        alignment="center"
        accessoryLeft={() => <NavigationAction onPress={onClose} />}
      />
      <Content contentContainerStyle={styles.content}>
        <LayoutCustom gap={16}>
          <LayoutCustom itemsCenter gap={10}>
            <LayoutCustom style={styles.avatarWrap}>
              <Avatar source={avatarSource} size="giant" />
              <LayoutCustom style={styles.avatarAction} onPress={onSelectProfilePhoto}>
                <Icon pack="assets" name="pencil" style={styles.avatarActionIcon} />
              </LayoutCustom>
            </LayoutCustom>
          </LayoutCustom>
          <LayoutCustom>
            <Text category="subhead" status="content">
              {t("Name")}
            </Text>
            <Input
              placeholder={t("Enter your name")}
              value={nextName}
              onChangeText={setNextName}
            />
          </LayoutCustom>
          <LayoutCustom>
            <Text category="subhead" status="content">
              {t("Email")}
            </Text>
            <Input value={email ?? ""} disabled />
            <Text category="c1" status="content">
              {t("Email can't be changed.")}
            </Text>
          </LayoutCustom>
        </LayoutCustom>
      </Content>
      <Button
        children={saving ? t("Saving...") : t("Save")}
        disabled={saving}
        style={styles.button}
        onPress={handleSave}
      />
    </Container>
  );
};

export default EditProfileModal;

const themedStyles = StyleService.create({
  content: {
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  avatarWrap: {
    position: "relative",
  },
  avatarAction: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "color-primary-default",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "background-basic-color-1",
  },
  avatarActionIcon: {
    width: 16,
    height: 16,
    tintColor: "#FFFFFF",
  },
  button: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
});
