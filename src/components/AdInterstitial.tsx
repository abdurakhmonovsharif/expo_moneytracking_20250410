import React from "react";
import { Modal, StyleSheet, View, Image } from "react-native";
import { Button, useTheme } from "@ui-kitten/components";
import { Images } from "assets/images";
import Text from "./Text";
import { useTranslation } from "i18n/useTranslation";

type AdInterstitialProps = {
  visible: boolean;
  minViewSec?: number;
  onClose: () => void;
};

const AdInterstitial: React.FC<AdInterstitialProps> = ({
  visible,
  minViewSec = 5,
  onClose,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [secondsLeft, setSecondsLeft] = React.useState(minViewSec);

  React.useEffect(() => {
    if (!visible) return;
    setSecondsLeft(minViewSec);
    if (minViewSec <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [visible, minViewSec]);

  const canClose = secondsLeft <= 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (canClose) onClose();
      }}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme["background-basic-color-1"] }]}>
          <Image source={Images.ads_banner} resizeMode="contain" style={styles.image} />
          <Text category="c2" status="content" center>
            {secondsLeft > 0 ? `${secondsLeft}s` : ""}
          </Text>
          <Button
            size="small"
            disabled={!canClose}
            onPress={onClose}
            style={styles.closeButton}
          >
            {t("Cancel")}
          </Button>
        </View>
      </View>
    </Modal>
  );
};

export default AdInterstitial;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    gap: 12,
  },
  image: {
    width: "100%",
    height: 140,
  },
  closeButton: {
    alignSelf: "stretch",
  },
});
