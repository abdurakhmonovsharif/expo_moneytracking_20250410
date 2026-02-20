# Backend

FastAPI service for authentication bridging and speech-to-text (Muxlisa).

## Project Structure

```
backend/
  app/
    main.py                 # FastAPI app factory + router wiring (entrypoint)
    api/
      routes/
        legacy.py           # Existing endpoints (migration-safe)
    core/                   # Core app concerns (reserved for dependencies/config wiring)
    firebase.py             # Firebase integration
    notifications.py        # Notifications domain logic
    fx.py                   # FX provider integration
    openai_client.py        # OpenAI integration
    config.py               # Environment/config settings
```

`uvicorn app.main:app` remains the runtime entrypoint.  
Route layer is now isolated under `app/api/routes/`, so new endpoint groups can be moved out of `legacy.py` incrementally without breaking existing APIs.

## SOLID Coding Rules (Team Standard)

- `S` Single Responsibility:
  Keep each module focused (router/service/integration/config separated).
- `O` Open/Closed:
  Add new providers/services via new modules; avoid editing unrelated flow.
- `L` Liskov Substitution:
  Keep response contracts stable when replacing internal implementation.
- `I` Interface Segregation:
  Prefer small request/response models per feature, not giant shared DTOs.
- `D` Dependency Inversion:
  Route handlers depend on service functions/interfaces, not low-level SDK calls directly.

## Requirements

- Python 3.10+
- `pip`

## Setup

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

```
GOOGLE_WEB_CLIENT_ID=...
FIREBASE_PROJECT_ID=...
FIREBASE_SERVICE_ACCOUNT_PATH=...
FIREBASE_UID_PREFIX=google:
FIREBASE_APPLE_UID_PREFIX=apple:

MUXLISA_VOICE_TEXT_API_KEY=...
# Optional (default shown)
MUXLISA_VOICE_TEXT_URL=https://service.muxlisa.uz/api/v2/stt

# OpenAI (voice analysis)
OPENAI_API_KEY=...
# Optional
OPENAI_MODEL=gpt-4o
OPENAI_TIMEOUT_SECONDS=30

# Admin (comma-separated Firebase UIDs)
ADMIN_UIDS=uid1,uid2

# Default plan permissions (JSON object)
DEFAULT_PERMISSIONS_FREE={"voice_ai":false,"export":false,"wallet_create":true,"wallet_unlimited":false,"wallet_limit":5}
DEFAULT_PERMISSIONS_PREMIUM={"voice_ai":true,"export":true,"wallet_create":true,"wallet_unlimited":true}

# Permission keys (suggested)
# voice_ai: boolean
# export: boolean
# wallet_create: boolean
# wallet_unlimited: boolean
# wallet_limit: number (ignored when wallet_unlimited=true)

# Default ads config (JSON object)
DEFAULT_ADS_CONFIG_IOS={"enabled":false,"min_interval_sec":3600,"min_view_sec":5,"show_on":["home"]}
DEFAULT_ADS_CONFIG_ANDROID={"enabled":false,"min_interval_sec":3600,"min_view_sec":5,"show_on":["home"]}

# Ads config keys (suggested)
# enabled: boolean
# min_interval_sec: number (cooldown between ads)
# min_view_sec: number (seconds before close)
# show_on: array of event keys, e.g. ["home", "app_open"]

# IAP (Google Play)
GOOGLE_PLAY_PACKAGE_NAME=com.example.app
GOOGLE_PLAY_SERVICE_ACCOUNT_PATH=/path/to/google-play-service-account.json
GOOGLE_PLAY_SUBSCRIPTION_IDS=monthly_premium,yearly_premium
GOOGLE_PLAY_PRODUCT_IDS=premium_lifetime

# IAP (Apple)
APPLE_BUNDLE_ID=com.example.app
APPLE_SHARED_SECRET=...
APPLE_SUBSCRIPTION_IDS=monthly_premium,yearly_premium
APPLE_PRODUCT_IDS=premium_lifetime

# Apple Sign-In auth token verification
# Add all valid audiences (bundle id, and if needed Service ID) comma-separated.
APPLE_AUTH_AUDIENCES=com.example.app

# FX rates (CBU)
CBU_RATES_URL=https://cbu.uz/uz/arkhiv-kursov-valyut/json/
CBU_CACHE_TTL_SECONDS=21600
```

## Run (dev)

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 9000 --reload
```

## Docker (production)

This production setup uses:

- `api`: FastAPI with `gunicorn` + `uvicorn` workers
- `nginx`: reverse proxy in front of API (`:80`)

### 1) Prepare production env

```bash
cd backend
cp .env.production.example .env.production
```

Fill real values inside `.env.production`.

### 2) Prepare secrets

Create `backend/secrets/` files:

- `firebase-service-account.json` (required)
- `google-play-service-account.json` (required only if you use Google Play IAP verification)

Compose mounts this folder to `/run/secrets` in container.

### 3) Build and start

```bash
cd backend
docker compose -f docker-compose.prod.yml up -d --build
```

### 4) Health check

```bash
curl http://localhost/health
```

Expected response:

```json
{"status":"ok"}
```

### 5) Logs / stop

```bash
cd backend
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml down
```

### Notes

- If you deploy behind Cloudflare/ALB/Nginx ingress, keep TLS termination there.
- If you want local TLS inside this compose, add `:443` and cert config to `docker/nginx.conf`.
- You can validate compose syntax before deploy:

```bash
cd backend
BACKEND_ENV_FILE=.env.production.example docker compose -f docker-compose.prod.yml config
```

## Push Notifications (FCM + Expo fallback)

- Backend sends push when notification docs are created.
- Android path: `provider=fcm` (Firebase Cloud Messaging).
- iOS fallback path in this MVP: `provider=expo` (Expo push token), while keeping the same backend notification flow.

Client setup requirements:

- Android:
  - Place `google-services.json` at `android/app/google-services.json`.
- iOS:
  - Enable Push Notifications capability in Apple Developer / Xcode.
  - Add `GoogleService-Info.plist` for native Firebase iOS integration if you need full FCM-native flow.

## Endpoints

- `POST /auth/google` – Google ID token → Firebase custom token
- `POST /auth/apple` – Apple identity token → Firebase custom token
  - Body: `{"identity_token":"<apple-id-token>","nonce":"<raw-nonce>","email":"optional","full_name":"optional"}`
- `POST /stt` – Speech-to-text (multipart form `audio`)
- `GET /fx/rates` – Cached CBU exchange rates (base UZS) with `previous_rates` and `delta_rates` (1-day diff)
- `POST /voice/parse` – Analyze transcribed text with GPT (auth required)
- `POST /voice/commit` – Save analyzed transaction to Firebase (auth required)
- `GET /health` – health check
- `GET /tariffs` – list tariff cards for paywall (auth required; active only for normal users)
  - Query: `platform=ios|android`, `include_inactive=true` (admin only)
- `GET /me/permissions` – current plan permissions
- `POST /me/trial/start` – start tariff trial (e.g. 7-day trial)
  - Body: `{"tariff_id":"premium_12_month"}`
- `GET /me/notifications` – list user notifications (auth required)
- `GET /me/notifications/unread-count` – unread notification count (auth required)
- `POST /me/push-tokens/register` – register/update device push token (auth required)
- `POST /me/push-tokens/unregister` – deactivate device push token (auth required)
- `POST /me/notifications/{notification_id}/read` – mark single notification as read (auth required)
- `POST /me/notifications/read-all` – mark all notifications as read (auth required)
- `POST /me/notifications/overspending` – create overspending warning notification (auth required)
- `GET /ads/config/{platform}` – ads config for user (free users only; premium returns disabled)
- `GET /admin/ads/config` – admin: all ads configs
- `GET /admin/ads/config/{platform}` – admin: ads config by platform
- `PUT /admin/ads/config/{platform}` – admin: update ads config
- `DELETE /admin/ads/config/{platform}` – admin: delete ads config
- `GET /me` – Current user profile + premium status (auth required)
- `GET /admin/users` – List users (admin only)
  - Query params: `include_firestore=true` to attach profile, `include_data=true` to attach full Firestore data (heavy).
- `GET /admin/users/{uid}` – Full user info (admin only)
- `POST /admin/users/{uid}/plan` – Set plan free/premium + optional `tariff_id` (admin only)
- `GET /admin/tariffs` – admin list tariffs (2/3/... unlimited count)
- `GET /admin/tariffs/{tariff_id}` – admin get single tariff
- `POST /admin/tariffs` – admin create tariff
- `PUT /admin/tariffs/{tariff_id}` – admin update tariff
- `DELETE /admin/tariffs/{tariff_id}` – admin delete tariff
- `GET /admin/permissions` – Get plan permissions (admin only)
- `GET /admin/permissions/{plan}` – Get permissions for plan (admin only)
- `PUT /admin/permissions/{plan}` – Update plan permissions (admin only)
  - Body: `{"permissions": {...}, "merge": true}` or `{"permissions": {...}, "replace": true}`
- `DELETE /admin/permissions/{plan}` – Remove plan permissions doc
- `POST /admin/notifications/broadcast` – send admin broadcast notification to all users (admin only)
- `POST /iap/google/verify` – Verify Google Play purchase (auth required; links tariff by `store_product_ids.android`)
- `POST /iap/apple/verify` – Verify App Store receipt (auth required; links tariff by `store_product_ids.ios`)

### Tariff payload fields (admin create/update)

`name`, `title`, `subtitle`, `description`, `access_plan`, `purchase_type`, `billing_period_unit`, `billing_period_count`, `price_amount`, `currency`, `price_label`, `price_sub_label`, `discount_percent`, `discount_label`, `badge_text`, `trial_days`, `is_featured`, `is_active`, `sort_order`, `cta_title`, `cta_subtitle`, `cta_button_text`, `nighth_style`, `store_product_ids.ios`, `store_product_ids.android`
