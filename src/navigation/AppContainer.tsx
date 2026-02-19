import React from "react";
import { View } from "react-native";
import { enableScreens } from "react-native-screens";
import { NavigationContainer } from "@react-navigation/native";
import { useTheme } from "@ui-kitten/components";
import { RootStackParamList } from "types/navigation-types";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { navigationRef, navigate as rootNavigate } from "./root-navigation";
import { Host } from "react-native-portalize";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "lib/firebase";
import { useAppDispatch, useAppSelector } from "reduxs/store";
import { appSelector, resetAppState, setFxRates } from "reduxs/reducers/app-reducer";
import { syncUserData } from "services/userData";
import { MinimalLoading } from "components";
import dayjs from "dayjs";
import { DAYJS_LOCALES } from "i18n/dayjs";
import { DEFAULT_LANGUAGE } from "i18n/translations";
import { loadFxRates } from "services/fxRates";
import {
  registerPushNotificationsForCurrentUser,
  subscribeToNotificationOpens,
} from "services/pushNotifications";

// --------------------------- Screens -------------------------------------
import SplashScreen from "screens/Splash";
import BottomBarNavigator from "./BottomBarNavigator";
import NewWallet from "screens/User/NewWallet";
import NewTransaction from "screens/User/NewTransaction";
import CurrencyScreen from "screens/User/Currency/CurrencyScreen";
import LanguageScreen from "screens/User/Language/LanguageScreen";
import NotificationsScreen from "screens/User/Notifications";
import RemoveProfileWallet from "screens/User/RemoveProfileWallet";
import GetPremium from "screens/User/GetPremium";
import NewBudget from "screens/User/NewBudget";
import SuccessBudget from "screens/User/NewBudget/SuccessBudget";
import WalletChart from "screens/User/WalletChart";
import ChartIncome from "screens/User/ChartIncome";
import ChartExpenses from "screens/User/ChartExpenses";
import CategoryTransaction from "screens/User/CategoryTransaction";
import DetailsWallet from "screens/User/DetailsWallet";
import RecurringBilling from "screens/User/RecurringBilling";
import EmailLogin from "screens/Auth/EmailLogin";
import EmailSignUp from "screens/Auth/EmailSignUp";

enableScreens();

const Stack = createNativeStackNavigator<RootStackParamList>();
const AppContainer = () => {
  const themes = useTheme();
  const dispatch = useAppDispatch();
  const { appLoading, language } = useAppSelector(appSelector);
  const [bootstrapped, setBootstrapped] = React.useState(false);
  const [signedIn, setSignedIn] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const isSignedIn = Boolean(user);
      setSignedIn(isSignedIn);
      setBootstrapped(true);
      if (isSignedIn) {
        syncUserData(dispatch).catch(() => {
          // Keep UI responsive even if sync fails; users can retry by reopening.
        });
      } else {
        dispatch(resetAppState());
      }
    });
    return () => unsubscribe();
  }, [dispatch]);

  React.useEffect(() => {
    const locale = DAYJS_LOCALES[language ?? DEFAULT_LANGUAGE] ?? "en";
    dayjs.locale(locale);
  }, [language]);

  React.useEffect(() => {
    const unsubscribe = subscribeToNotificationOpens(() => {
      rootNavigate("Notifications");
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    if (!signedIn) {
      return;
    }
    registerPushNotificationsForCurrentUser(language).catch(() => {
      // keep app responsive even if push registration fails
    });
  }, [language, signedIn]);

  React.useEffect(() => {
    if (!signedIn) return;
    loadFxRates()
      .then((payload) => {
        if (payload?.rates) {
          dispatch(
            setFxRates({
              rates: payload.rates,
              updatedAt: payload.updatedAt,
              date: payload.date,
              previousDate: payload.previousDate,
              previousRates: payload.previousRates,
              deltaRates: payload.deltaRates,
            })
          );
        }
      })
      .catch(() => {
        // keep UI responsive if FX fetch fails
      });
  }, [dispatch, signedIn]);

  if (!bootstrapped) {
    return <MinimalLoading backgroundColor={themes["background-basic-color-1"]} />;
  }
  return (
    <Host>
      <NavigationContainer ref={navigationRef}>
        <View
          style={{
            backgroundColor: themes["background-basic-color-1"],
            flex: 1,
          }}
        >
          <Stack.Navigator
            key={signedIn ? "auth" : "guest"}
            initialRouteName={signedIn ? "BottomBar" : "SplashScreen"}
            screenOptions={{
              headerShown: false,
            }}
          >
            {!signedIn ? (
              <>
                <Stack.Screen name="SplashScreen" component={SplashScreen} />
                <Stack.Screen name="EmailLogin" component={EmailLogin} />
                <Stack.Screen name="EmailSignUp" component={EmailSignUp} />
              </>
            ) : (
              <>
                <Stack.Screen name="BottomBar" component={BottomBarNavigator} />
                <Stack.Screen name="NewWallet" component={NewWallet} />
                <Stack.Screen name="NewTransaction" component={NewTransaction} />
                <Stack.Screen name="CurrencyScreen" component={CurrencyScreen} />
                <Stack.Screen name="LanguageScreen" component={LanguageScreen} />
                <Stack.Screen name="Notifications" component={NotificationsScreen} />
                <Stack.Screen
                  name="RemoveProfileWallet"
                  component={RemoveProfileWallet}
                />
                <Stack.Screen name="GetPremium" component={GetPremium} />
                <Stack.Screen name="NewBudget" component={NewBudget} />
                <Stack.Screen name="SuccessBudget" component={SuccessBudget} />
                <Stack.Screen name="WalletChart" component={WalletChart} />
                <Stack.Screen name="ChartIncome" component={ChartIncome} />
                <Stack.Screen name="ChartExpenses" component={ChartExpenses} />
                <Stack.Screen
                  name="CategoryTransaction"
                  component={CategoryTransaction}
                />
                <Stack.Screen
                  name="DetailsWallet"
                  component={DetailsWallet}
                />
                <Stack.Screen
                  name="RecurringBilling"
                  component={RecurringBilling}
                />
              </>
            )}
          </Stack.Navigator>
          {appLoading && (
            <MinimalLoading
              overlay
              backgroundColor={themes["background-basic-color-1"]}
            />
          )}
        </View>
      </NavigationContainer>
    </Host>
  );
};

export default AppContainer;
