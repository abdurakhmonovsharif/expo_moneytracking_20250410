type PickerPermissionResponse = {
  granted: boolean;
};

const ensurePermission = async (
  requestPermission: () => Promise<PickerPermissionResponse>,
  message: string
) => {
  const permission = await requestPermission();
  if (!permission.granted) {
    throw new Error(message);
  }
};

const getImagePicker = async () => {
  try {
    return await import("expo-image-picker");
  } catch {
    throw new Error(
      "Image picker native module is missing. Rebuild the app with `npx expo run:ios` or `npx expo run:android`."
    );
  }
};

export const pickImageFromLibrary = async (): Promise<string | null> => {
  const ImagePicker = await getImagePicker();
  await ensurePermission(
    ImagePicker.requestMediaLibraryPermissionsAsync,
    "Photo library permission is required."
  );
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.75,
  });
  if (result.canceled) {
    return null;
  }
  return result.assets[0]?.uri ?? null;
};

export const pickImageFromCamera = async (): Promise<string | null> => {
  const ImagePicker = await getImagePicker();
  await ensurePermission(
    ImagePicker.requestCameraPermissionsAsync,
    "Camera permission is required."
  );
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.75,
  });
  if (result.canceled) {
    return null;
  }
  return result.assets[0]?.uri ?? null;
};
