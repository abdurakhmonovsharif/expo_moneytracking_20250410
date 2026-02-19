# Auth MVP (Google → Backend → Firebase)

## Flow at a glance
- Expo app starts Google Sign-In with `expo-auth-session` (`AuthSession.useAuthRequest`) using the **Web OAuth Client ID** and custom scheme redirect (e.g., `moneytracking://oauthredirect`).
- Google returns an **ID token** only. The app sends it to the FastAPI backend (`POST /auth/google`).
- Backend verifies the ID token (audience = Web client ID, issuer, expiry, email_verified) with `google-auth`.
- Backend maps the Google subject to Firebase via Admin SDK, using deterministic UID `google:{sub}` and issues a **Firebase Custom Token**.
- App signs in **only** via `signInWithCustomToken`. Firebase client-side Google providers are never used.

## Frontend configuration
Environment-driven via Expo public vars:
- `EXPO_PUBLIC_API_BASE_URL` – FastAPI base URL (e.g., `http://10.10.40.190:9000`).
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` – single Web OAuth client ID (also used on Android/iOS).
- `EXPO_PUBLIC_GOOGLE_REDIRECT_URI` – custom scheme redirect, e.g., `moneytracking://oauthredirect`.
- `EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED` – optional toggle; defaults true when client ID is set.
- Firebase basics still required for custom-token sign-in: `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`, `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `EXPO_PUBLIC_FIREBASE_APP_ID`.

> The mobile app no longer imports or references any Firebase Google auth provider APIs.

## Backend configuration (FastAPI)
Set these in `backend/.env` (sample in `backend/.env.example`):
- `GOOGLE_WEB_CLIENT_ID` – same Web client ID as the app.
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_PATH` – path to service account JSON or the raw JSON string.
- `FIREBASE_UID_PREFIX` – default `google:`

Run:
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 9000
```

## Frontend run
```bash
npm install      # or yarn
npm start        # expo start
```
Ensure the backend URL matches `EXPO_PUBLIC_API_BASE_URL` and the device can reach it.

## Operational notes
- To stay future-proof with Expo SDK updates, the app uses generic `AuthSession.useAuthRequest` instead of deprecated provider helpers.
- Firebase Authentication: disable the Google provider; authentication relies solely on Custom Tokens from the backend.
- Google Cloud Console: single OAuth Client of type “Web application”; authorized redirect URI must be the custom scheme (e.g., `moneytracking://oauthredirect`). No Expo proxy/localhost redirects.
- Logging: backend logs verification, user sync, and custom token issuance; failures return 401 for Google token issues and 500 for Firebase issues.
- Security: no Google client secrets exist in the mobile app; ID tokens are verified server-side only; backend is stateless and horizontally scalable.
