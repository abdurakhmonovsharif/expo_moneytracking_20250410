import { Images } from "assets/images";
import * as React from "react";
import { View, Image, StyleSheet, ColorValue, Platform } from "react-native";
import { WebView } from "react-native-webview";
// import { BannerAd, TestIds, BannerAdSize } from 'react-native-google-mobile-ads';

interface Props {
  // bannerSize?: BannerAdSize;
  marginTop?: number;
  marginBottom?: number;
  marginVertical?: number;
  marginHorizontal?: number;
  backgroundColor?: ColorValue;
}
// const adUnitId = __DEV__
//   ? TestIds.BANNER
//   : "ca-app-pub-9136569203213301/9498880521";

const adHtml = `
  <html>
    <body>
      <div id="ad-banner">
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>
        <ins class="adsbygoogle"
             style="display:inline-block;width:320px;height:50px"
             data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
             data-ad-slot="XXXXXXXXXX"></ins>
        <script>
          (adsbygoogle = window.adsbygoogle || []).push({});
        </script>
      </div>
    </body>
  </html>
`;
const AdBanner = ({
  marginBottom,
  marginTop,
  marginVertical,
  marginHorizontal,
  // bannerSize = BannerAdSize.FULL_BANNER,
  backgroundColor,
}: Props) => {
  return (
    <View
      style={[
        styles.container,
        {
          marginBottom: marginBottom,
          marginTop: marginTop,
          marginVertical: marginVertical,
          marginHorizontal: marginHorizontal,
          backgroundColor: backgroundColor,
        },
      ]}
    >
      <Image source={Images.ads_banner} style={{ width: "100%", height: 82 }} />
      {/* {Platform.OS === "ios" || !__DEV__ ? (
        <>
          <Image source={Images.ads_banner} style={{ width: '100%', height: 82 }} />
        </>
      ) : (
        <BannerAd
          unitId={adUnitId}
          size={bannerSize ? bannerSize : BannerAdSize.FULL_BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
        />
      )} */}
      {/* {Platform.OS === "android" && (
        <BannerAd
          unitId={TestIds.BANNER}
          size={bannerSize ? bannerSize : BannerAdSize.FULL_BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
        />
      )} */}
      <WebView
        source={{ html: adHtml }}
        style={styles.webView}
        javaScriptEnabled={true}
      />
    </View>
  );
};

export default AdBanner;

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderRadius: 16,
    overflow: "hidden",
    flex: 1,
  },
  banner: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
});
