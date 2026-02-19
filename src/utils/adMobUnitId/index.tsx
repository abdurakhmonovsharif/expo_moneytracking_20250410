import { Platform } from "react-native";

interface AdMobUnitId {
  mainAdUnitId: string;
  createAsset: string;
  profile: string;
  wallets: string;
}

let adMobUnitId: AdMobUnitId;


/*** MUST-CONFIG ***/
if (Platform.OS === "ios") {
  adMobUnitId = {
    mainAdUnitId: "ca-app-pub-9136569203213301~2089910785",
    createAsset: "",
    profile: "",
    wallets: "",
  };
} else {
  adMobUnitId = {
    mainAdUnitId: "ca-app-pub-9136569203213301~9585257425",
    createAsset: "",
    profile: "",
    wallets: "",
  };
}

export default adMobUnitId;
