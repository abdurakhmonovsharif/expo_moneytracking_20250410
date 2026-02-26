# Voxwallet: Google Play `App access` guide

## 1) Which option to select

Select:

- `My app has restricted access to some or all features`

Reason:

- Core app screens are behind authentication.
- Users must sign in first (Google, Apple on iOS, or Email).
- Some features are premium-gated (subscription/paywall).

## 2) What to paste in Play Console (English, recommended)

Use this text in `App access` instructions:

```text
To access the app, please sign in first.

Recommended review path:
1) Open app.
2) Tap "Continue with Email".
3) Sign in with the test account below.

Test account (basic access):
Email: [PUT_REVIEW_EMAIL]
Password: [PUT_REVIEW_PASSWORD]

No OTP / 2FA is required.
No location restriction is required.
No external device is required.

The app also supports Google sign-in (and Apple sign-in on iOS), but email login is the fastest path for review.

Premium-restricted features:
- Voice AI
- Data export
- Unlimited wallets

If you need premium access for review, use:
Email: [PUT_PREMIUM_REVIEW_EMAIL]
Password: [PUT_PREMIUM_REVIEW_PASSWORD]
(This account is pre-activated with premium access.)
```

## 3) Quick checklist before submitting

- Create 1 working review account for basic access.
- Create 1 working review account with premium enabled.
- Ensure both accounts can log in without extra verification.
- Ensure credentials are valid for the entire review window.
- Do not require reviewer to create a new account manually.

## 4) Code references used for this guide

- Auth gate + guest/auth routes: `src/navigation/AppContainer.tsx`
- Login entry buttons: `src/screens/Splash/index.tsx`
- Email login/signup screens: `src/screens/Auth/EmailLogin.tsx`, `src/screens/Auth/EmailSignUp.tsx`
- Premium/paywall logic: `src/screens/User/BottomBar/Home/index.tsx`, `src/screens/User/BottomBar/Profile/index.tsx`, `src/screens/User/NewWallet/index.tsx`, `src/screens/User/GetPremium/index.tsx`
