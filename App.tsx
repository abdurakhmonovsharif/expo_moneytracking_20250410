import "react-native-gesture-handler";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar, StyleSheet } from "react-native";
import { ApplicationProvider, IconRegistry } from "@ui-kitten/components";
import { default as darkTheme } from "./src/constants/themes/dark.json";
import { default as customTheme } from "./src/constants/themes/app-theme.json";
import { default as customMapping } from "./src/constants/themes/mapping.json";
import { EvaIconsPack } from "@ui-kitten/eva-icons";
import * as eva from "@eva-design/eva";
import AppContainer from "navigation/AppContainer";
import AssetsIconsPack from "assets/AssetsIconsPack";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import useCachedResources from "hooks/useCacheResource";
import store, { persistor } from "reduxs/store";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "lib/firebase";
import { MinimalLoading } from "components";

import { LogBox } from 'react-native';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  '[Reanimated] Reading from `value` during component render',
  'Warning: MeasureElement: Support for defaultProps will be removed from function components',
]);

export default function App() {
  const isLoadingComplete = useCachedResources();

  if (!isLoadingComplete) {
    return <MinimalLoading />;
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <IconRegistry icons={[AssetsIconsPack, EvaIconsPack]} />
      <ApplicationProvider
        {...eva}
        theme={{ ...eva.dark, ...customTheme, ...darkTheme }}
        customMapping={{ ...eva.mapping, ...customMapping }}
      >
        <Provider store={store}>
          <PersistGate loading={<MinimalLoading />} persistor={persistor}>
            <StatusBar
              barStyle={"light-content"}
              translucent={true}
              backgroundColor={"#00000000"}
            />
            <AppContainer />
          </PersistGate>
        </Provider>
      </ApplicationProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
