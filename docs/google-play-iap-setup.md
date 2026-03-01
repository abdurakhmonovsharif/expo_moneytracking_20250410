# VoxWallet Google Play IAP Setup

This checklist is specific to this project (`com.voxwallet.app`).

## 1) Play Console products

Create and activate:

- Subscription: `monthly_premium` (base plan: `monthly`, auto-renewing, 1 month)
- Subscription: `yearly_premium` (base plan: `yearly`, auto-renewing, 1 year)
- In-app product (one-time): `premium_lifetime` (optional, but required if lifetime tariff is shown in app)

Notes:

- Keep product IDs exactly as above to match backend defaults.
- Ensure each product/base plan status is `Active`.

## 2) Test track required

IAP tests must be done on a Play-installed build:

1. Upload AAB to `Internal testing` or `Closed testing`.
2. Add tester emails to the test track.
3. Add same tester emails to `License testing`.
4. Install app from Play opt-in link (not from local debug build).

## 3) Google Play API access for backend verification

Backend verifies Google purchases through Android Publisher API.

1. In Play Console: `Setup -> API access`, link a Google Cloud project.
2. Create a service account in Google Cloud.
3. Grant Play app permissions to that service account (at least subscription/order verification scope).
4. Download JSON key and place it on server (do not commit to git).

## 4) Backend environment

Set production backend env values:

- `GOOGLE_PLAY_PACKAGE_NAME=com.voxwallet.app`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_PATH=/run/secrets/google-play-service-account.json` (or real server path)
- `GOOGLE_PLAY_SUBSCRIPTION_IDS=monthly_premium,yearly_premium`
- `GOOGLE_PLAY_PRODUCT_IDS=premium_lifetime`

Then restart backend.

## 5) Tariff mapping must match Play product IDs

App paywall reads tariffs from backend and uses `store_product_ids.android`.

Verify `tariff_plans` mapping:

- monthly tariff -> `android: monthly_premium`
- yearly tariff -> `android: yearly_premium`
- lifetime tariff -> `android: premium_lifetime`

If mapping differs, purchases fail or verify fails.

## 6) Client environment

Verify mobile app points to production API:

- `EXPO_PUBLIC_API_BASE_URL=https://api.voxwallet.uz` (or your production API)

Rebuild Android app and upload new AAB if needed.

## 7) End-to-end test

1. Open Play-installed test build with tester account.
2. Open `Get Premium`.
3. Buy monthly/yearly plan.
4. Confirm backend `/iap/google/verify` succeeds.
5. Confirm `/me` shows premium active and app unlocks premium features.

## 8) Common failures

- `Item not found`:
  - Product not active, wrong product ID, or app not installed from Play.
- `Developer error`:
  - Usually wrong build/install path (not Play track), or product unavailable in region/account.
- `403` during backend verify:
  - Service account/API access not configured correctly.
