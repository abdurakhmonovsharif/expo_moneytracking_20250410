import hashlib
import json
import logging
import re
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Header
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from google.oauth2 import service_account
import jwt
from pydantic import BaseModel, Field
import requests
from firebase_admin import auth as admin_auth

from ...config import Settings, get_settings
from ...firebase import (
    create_custom_token,
    get_or_create_user,
    get_firestore_client,
    init_firebase,
)
from ...fx import get_cbu_rates
from ...notifications import (
    AdminBroadcastNotificationRequest,
    AdminBroadcastNotificationResponse,
    NotificationListResponse,
    NotificationMarkAllReadResponse,
    NotificationMarkReadResponse,
    NotificationUnreadCountResponse,
    OverspendingNotificationRequest,
    OverspendingNotificationResponse,
    PushTokenRegisterRequest,
    PushTokenRegisterResponse,
    PushTokenUnregisterRequest,
    PushTokenUnregisterResponse,
    broadcast_notification_to_all_users,
    create_overspending_notification,
    get_unread_notification_count,
    list_user_notifications,
    mark_all_notifications_read,
    mark_notification_read,
    register_push_token,
    unregister_push_token,
)
from ...openai_client import analyze_transaction_text, OpenAIError

logger = logging.getLogger("auth")
logging.basicConfig(level=logging.INFO)

# NOTE:
# This file contains the existing endpoint set moved from the previous monolithic
# app/main.py. Keep behavior stable here while migrating feature-by-feature into
# dedicated route/service modules.
router = APIRouter()


class GooglePayload(BaseModel):
    id_token: str


class AppleAuthRequest(BaseModel):
    identity_token: str
    nonce: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None


class TokenResponse(BaseModel):
    firebase_custom_token: str


class SttResponse(BaseModel):
    text: str
    raw: Any | None = None


class FxRatesResponse(BaseModel):
    base: str
    rates: Dict[str, float]
    date: Optional[str] = None
    previous_date: Optional[str] = None
    previous_rates: Optional[Dict[str, float]] = None
    delta_rates: Optional[Dict[str, float]] = None
    updated_at: Optional[str] = None
    source: Optional[str] = None


class VoiceAnalyzeRequest(BaseModel):
    text: str
    type_hint: Optional[str] = None
    categories: Optional[List[str]] = None
    locale: Optional[str] = None
    currency: Optional[str] = None


class VoiceAnalyzeResponse(BaseModel):
    type: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    raw: Optional[str] = None


class VoiceCommitRequest(BaseModel):
    wallet_id: str
    category: Dict[str, Any]
    category_id: Optional[str] = None
    balance: float
    type: str
    currency: Optional[str] = None
    note: Optional[Dict[str, Any]] = None
    date: Optional[str] = None


class AdminPlanUpdateRequest(BaseModel):
    plan: str
    premium_until: Optional[str] = None
    tariff_id: Optional[str] = None
    reason: Optional[str] = None


class UserAuthResponse(BaseModel):
    uid: str
    email: Optional[str] = None
    email_verified: Optional[bool] = None
    display_name: Optional[str] = None
    phone_number: Optional[str] = None
    photo_url: Optional[str] = None
    disabled: Optional[bool] = None
    provider_ids: List[str] = []
    custom_claims: Dict[str, Any] = {}
    created_at: Optional[str] = None
    last_sign_in: Optional[str] = None


class UserProfileResponse(BaseModel):
    uid: str
    name: Optional[str] = None
    email: Optional[str] = None
    currency: Optional[str] = None
    baseCurrency: Optional[str] = None
    language: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    plan: str = "free"
    access_plan: str = "free"
    is_premium: bool = False
    premium_status: Optional[str] = None
    premium_until: Optional[str] = None
    premium_since: Optional[str] = None
    premium_source: Optional[str] = None
    active_tariff_id: Optional[str] = None
    pending_tariff_id: Optional[str] = None
    trial_status: Optional[str] = None
    trial_started_at: Optional[str] = None
    trial_ends_at: Optional[str] = None
    trial_expired_at: Optional[str] = None
    trial_converted_at: Optional[str] = None
    trial_tariff_id: Optional[str] = None
    trial_access_plan: Optional[str] = None
    trial_consumed: bool = False


class AdminUserSummary(BaseModel):
    auth: UserAuthResponse
    profile: Optional[UserProfileResponse] = None
    data: Optional[Dict[str, Any]] = None


class AdminUserFullResponse(BaseModel):
    auth: UserAuthResponse
    profile: UserProfileResponse
    data: Dict[str, Any]


class AdminUserListResponse(BaseModel):
    users: List[AdminUserSummary]
    next_page_token: Optional[str] = None


class GoogleIapVerifyRequest(BaseModel):
    product_id: str
    purchase_token: str
    is_subscription: bool = True


class AppleIapVerifyRequest(BaseModel):
    receipt_data: str
    product_id: Optional[str] = None


class IapVerifyResponse(BaseModel):
    profile: UserProfileResponse
    platform: str
    product_id: Optional[str] = None


class PlanPermissionsUpdateRequest(BaseModel):
    permissions: Dict[str, Any]
    merge: bool = True
    replace: bool = False


class PlanPermissionsResponse(BaseModel):
    plan: str
    permissions: Dict[str, Any]
    updated_at: Optional[str] = None


class AllPlanPermissionsResponse(BaseModel):
    plans: Dict[str, Dict[str, Any]]


class UserPermissionsResponse(BaseModel):
    plan: str
    permissions: Dict[str, Any]


class AdsConfigUpdateRequest(BaseModel):
    config: Dict[str, Any] = Field(default_factory=dict)
    merge: bool = True
    replace: bool = False


class AdsConfigResponse(BaseModel):
    platform: str
    config: Dict[str, Any]
    updated_at: Optional[str] = None


class AllAdsConfigResponse(BaseModel):
    platforms: Dict[str, AdsConfigResponse]


class TariffStoreProductIds(BaseModel):
    ios: Optional[str] = None
    android: Optional[str] = None


class TariffPlanPayload(BaseModel):
    name: str
    title: str
    subtitle: Optional[str] = None
    description: Optional[str] = None
    access_plan: str = "premium"
    purchase_type: str = "subscription"
    billing_period_unit: str = "month"
    billing_period_count: int = 1
    price_amount: float = 0.0
    currency: str = "USD"
    price_label: Optional[str] = None
    price_sub_label: Optional[str] = None
    discount_percent: int = 0
    discount_label: Optional[str] = None
    badge_text: Optional[str] = None
    trial_days: int = 0
    is_featured: bool = False
    is_active: bool = True
    sort_order: int = 0
    cta_title: Optional[str] = None
    cta_subtitle: Optional[str] = None
    cta_button_text: Optional[str] = None
    nighth_style: Dict[str, Any] = Field(default_factory=dict)
    store_product_ids: TariffStoreProductIds = Field(default_factory=TariffStoreProductIds)


class AdminTariffCreateRequest(TariffPlanPayload):
    tariff_id: Optional[str] = None


class AdminTariffUpdateRequest(TariffPlanPayload):
    pass


class AdminTariffPatchRequest(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    access_plan: Optional[str] = None
    purchase_type: Optional[str] = None
    billing_period_unit: Optional[str] = None
    billing_period_count: Optional[int] = None
    price_amount: Optional[float] = None
    currency: Optional[str] = None
    price_label: Optional[str] = None
    price_sub_label: Optional[str] = None
    discount_percent: Optional[int] = None
    discount_label: Optional[str] = None
    badge_text: Optional[str] = None
    trial_days: Optional[int] = None
    is_featured: Optional[bool] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    cta_title: Optional[str] = None
    cta_subtitle: Optional[str] = None
    cta_button_text: Optional[str] = None
    nighth_style: Optional[Dict[str, Any]] = None
    store_product_ids: Optional[TariffStoreProductIds] = None


class TariffPlanResponse(TariffPlanPayload):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class TariffPlanListResponse(BaseModel):
    tariffs: List[TariffPlanResponse]


class TrialStartRequest(BaseModel):
    tariff_id: str


class TrialStartResponse(BaseModel):
    profile: UserProfileResponse
    tariff: TariffPlanResponse


_TARIFF_ACCESS_PLANS = {"free", "premium"}
_TARIFF_PURCHASE_TYPES = {"subscription", "one_time"}
_TARIFF_BILLING_UNITS = {"day", "week", "month", "year", "lifetime"}
_TARIFF_STORE_PLATFORMS = {"ios", "android"}
_TRIAL_STATUSES = {"none", "active", "expired", "converted", "canceled"}


_AUDIO_MIME_ALIASES = {
    "audio/vnd.wave": "audio/wav",
    "audio/wave": "audio/wav",
    "audio/x-wav": "audio/wav",
    "audio/x-pn-wav": "audio/wav",
    "audio/m4a": "audio/x-m4a",
}

_AUDIO_MIME_BY_EXT = {
    "wav": "audio/wav",
    "m4a": "audio/x-m4a",
    "aac": "audio/aac",
    "mp3": "audio/mpeg",
    "mp4": "audio/mp4",
    "webm": "audio/webm",
    "ogg": "audio/ogg",
    "3gp": "audio/3gpp",
    "amr": "audio/amr",
    "flac": "audio/flac",
}


def _normalize_audio_mime(content_type: str | None, filename: str | None) -> str:
    base = (content_type or "").split(";")[0].strip().lower()
    if base:
        base = _AUDIO_MIME_ALIASES.get(base, base)
        if base != "application/octet-stream":
            return base

    ext = ""
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()
    return _AUDIO_MIME_BY_EXT.get(ext, base or "application/octet-stream")


def verify_google_token(id_token: str, settings: Settings) -> Dict[str, Any]:
    request = google_requests.Request()
    try:
        claims = google_id_token.verify_oauth2_token(id_token, request, audience=settings.valid_audiences)
    except Exception as exc:  # broad but surfaces to client
        logger.warning("Google token verification failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token") from exc

    # basic issuer/email checks
    if claims.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid issuer")
    if claims.get("email_verified") is False:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email not verified")

    subject = str(claims.get("sub") or "").strip()
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid subject")

    logger.info("Google token verified for sub=%s email=%s", claims.get("sub"), claims.get("email"))
    return claims


def _apple_auth_audiences(settings: Settings) -> set[str]:
    configured = set(settings.apple_auth_audience_set)
    if configured:
        return configured
    if settings.apple_bundle_id:
        return {settings.apple_bundle_id.strip()}
    return set()


@lru_cache(maxsize=8)
def _apple_jwks_for_hour(hour_bucket: int) -> Dict[str, Any]:
    response = requests.get(_APPLE_AUTH_KEYS_URL, timeout=20)
    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Apple keys fetch failed",
        )
    data = response.json()
    keys = data.get("keys")
    if not isinstance(keys, list) or not keys:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Apple keys response invalid",
        )
    return data


def _get_apple_jwks(refresh: bool = False) -> Dict[str, Any]:
    if refresh:
        _apple_jwks_for_hour.cache_clear()
    bucket = int(datetime.now(timezone.utc).timestamp() // 3600)
    return _apple_jwks_for_hour(bucket)


def _get_apple_signing_key(kid: str):
    def resolve_key(jwks: Dict[str, Any], requested_kid: str) -> Optional[Dict[str, Any]]:
        keys = jwks.get("keys") or []
        for item in keys:
            if isinstance(item, dict) and item.get("kid") == requested_kid:
                return item
        return None

    jwks = _get_apple_jwks(refresh=False)
    key_data = resolve_key(jwks, kid)
    if not key_data:
        jwks = _get_apple_jwks(refresh=True)
        key_data = resolve_key(jwks, kid)
    if not key_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Apple signing key not found",
        )
    return jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key_data))


def verify_apple_identity_token(payload: AppleAuthRequest, settings: Settings) -> Dict[str, Any]:
    token = str(payload.identity_token or "").strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Apple identity token")

    audiences = _apple_auth_audiences(settings)
    if not audiences:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="APPLE_AUTH_AUDIENCES or APPLE_BUNDLE_ID must be configured",
        )

    try:
        headers = jwt.get_unverified_header(token)
        kid = str(headers.get("kid") or "").strip()
        if not kid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Apple token header",
            )
        public_key = _get_apple_signing_key(kid)
        claims = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=list(audiences),
            issuer=_APPLE_AUTH_ISSUER,
        )
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Apple identity token expired",
        ) from exc
    except jwt.PyJWTError as exc:
        logger.warning("Apple token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Apple identity token",
        ) from exc

    subject = str(claims.get("sub") or "").strip()
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Apple subject",
        )

    nonce = str(payload.nonce or "").strip()
    token_nonce = str(claims.get("nonce") or "").strip()
    if nonce:
        nonce_sha256 = hashlib.sha256(nonce.encode("utf-8")).hexdigest()
        if not token_nonce:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Apple nonce claim missing",
            )
        if token_nonce not in {nonce, nonce_sha256}:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Apple nonce mismatch",
            )

    return claims


def require_firebase_user(authorization: str = Header(default=None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing auth token",
        )
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing auth token",
        )
    try:
        return admin_auth.verify_id_token(token)
    except Exception as exc:
        logger.warning("Firebase token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid auth token",
        ) from exc


def require_admin_user(
    user: Dict[str, Any] = Depends(require_firebase_user),
    settings: Settings = Depends(get_settings),
) -> Dict[str, Any]:
    uid = str(user.get("uid"))
    if user.get("admin") is True or uid in settings.admin_uid_set:
        return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Admin access required",
    )


def _ts_ms_to_iso(value: Optional[int]) -> Optional[str]:
    if not value:
        return None
    return datetime.fromtimestamp(value / 1000, timezone.utc).isoformat()


def _ts_to_iso(value: Optional[int]) -> Optional[str]:
    if not value:
        return None
    return datetime.fromtimestamp(value, timezone.utc).isoformat()


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def _compute_is_premium(
    plan: str,
    premium_until: Optional[str],
    premium_status: Optional[str],
) -> bool:
    if plan != "premium":
        return False
    until_dt = _parse_iso(premium_until)
    now = datetime.now(timezone.utc)
    if until_dt and until_dt <= now:
        return False
    status = (premium_status or "").lower()
    if not status:
        return True
    if status in {"active", "trialing"}:
        return True
    if status in {"past_due", "unpaid", "canceled", "paid"}:
        return until_dt is None or until_dt > now
    if status in {"incomplete", "incomplete_expired", "paused"}:
        return False
    return until_dt is None or until_dt > now


def _normalize_account_plan_name(plan: Optional[str], default: str = "free") -> str:
    value = str(plan or "").strip().lower()
    if value in _TARIFF_ACCESS_PLANS:
        return value
    return default


def _normalize_trial_status(status_value: Optional[str]) -> str:
    value = str(status_value or "").strip().lower()
    if value in _TRIAL_STATUSES:
        return value
    return "none"


def _is_trial_active(trial_status: Optional[str], trial_ends_at: Optional[str]) -> bool:
    if _normalize_trial_status(trial_status) != "active":
        return False
    end_dt = _parse_iso(trial_ends_at)
    if not end_dt:
        return False
    return end_dt > datetime.now(timezone.utc)


def _compute_access_plan(
    *,
    plan: str,
    is_premium: bool,
    trial_status: Optional[str],
    trial_ends_at: Optional[str],
    trial_access_plan: Optional[str],
) -> str:
    if is_premium:
        return "premium"
    if _is_trial_active(trial_status, trial_ends_at):
        return _normalize_account_plan_name(trial_access_plan, default="premium")
    return _normalize_account_plan_name(plan, default="free")


def _normalize_user_subscription_state(data: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    plan = _normalize_account_plan_name(data.get("plan"), default="free")
    premium_until = data.get("premium_until")
    premium_status = data.get("premium_status")
    is_premium = _compute_is_premium(plan, premium_until, premium_status)

    if plan == "premium" and not is_premium:
        plan = "free"
        until_dt = _parse_iso(premium_until)
        if until_dt and until_dt <= now and not premium_status:
            premium_status = "expired"

    trial_status = _normalize_trial_status(data.get("trial_status"))
    trial_ends_at = data.get("trial_ends_at")
    trial_end_dt = _parse_iso(trial_ends_at)
    trial_consumed = bool(data.get("trial_consumed"))
    trial_expired_at = data.get("trial_expired_at")
    trial_converted_at = data.get("trial_converted_at")
    pending_tariff_id = data.get("pending_tariff_id")

    if trial_status == "active":
        if not trial_end_dt or trial_end_dt <= now:
            trial_status = "expired"
            if not trial_expired_at:
                trial_expired_at = now_iso
            if pending_tariff_id and pending_tariff_id == data.get("trial_tariff_id"):
                pending_tariff_id = None
        else:
            trial_consumed = True

    if plan == "premium" and trial_status == "active":
        trial_status = "converted"
        if not trial_converted_at:
            trial_converted_at = now_iso
        pending_tariff_id = None

    raw_trial_access_plan = data.get("trial_access_plan")
    trial_access_plan: Optional[str]
    if raw_trial_access_plan:
        trial_access_plan = _normalize_account_plan_name(raw_trial_access_plan, default="premium")
    else:
        trial_access_plan = "premium" if trial_status == "active" else None
    access_plan = _compute_access_plan(
        plan=plan,
        is_premium=is_premium,
        trial_status=trial_status,
        trial_ends_at=trial_ends_at,
        trial_access_plan=trial_access_plan,
    )

    active_tariff_id = data.get("active_tariff_id")
    if plan != "premium":
        active_tariff_id = None

    return {
        "plan": plan,
        "access_plan": access_plan,
        "is_premium": is_premium,
        "premium_status": premium_status,
        "premium_until": premium_until,
        "active_tariff_id": active_tariff_id,
        "pending_tariff_id": pending_tariff_id,
        "trial_status": trial_status,
        "trial_started_at": data.get("trial_started_at"),
        "trial_ends_at": trial_ends_at,
        "trial_expired_at": trial_expired_at,
        "trial_converted_at": trial_converted_at,
        "trial_tariff_id": data.get("trial_tariff_id"),
        "trial_access_plan": trial_access_plan,
        "trial_consumed": trial_consumed,
    }


def _derive_name(email: Optional[str], display_name: Optional[str]) -> str:
    if display_name and display_name.strip():
        return display_name.strip()
    if email and "@" in email:
        prefix = email.split("@", 1)[0].strip()
        if prefix:
            return prefix.replace(".", " ").replace("_", " ").replace("-", " ").strip()
    return "User"


def _ensure_user_profile(uid: str, email: Optional[str], display_name: Optional[str]) -> Dict[str, Any]:
    db = get_firestore_client()
    user_ref = db.collection("users").document(uid)
    snapshot = user_ref.get()
    now_iso = datetime.now(timezone.utc).isoformat()
    fallback_name = _derive_name(email, display_name)
    if not snapshot.exists:
        payload = {
            "name": fallback_name,
            "email": email,
            "created_at": now_iso,
            "plan": "free",
            "access_plan": "free",
            "is_premium": False,
            "trial_status": "none",
            "trial_consumed": False,
        }
        user_ref.set(payload)
        return payload

    data = snapshot.to_dict() or {}
    updates: Dict[str, Any] = {}
    if not data.get("name"):
        updates["name"] = fallback_name
    if not data.get("email") and email:
        updates["email"] = email
    normalized_state = _normalize_user_subscription_state(data)
    for key, value in normalized_state.items():
        if data.get(key) != value:
            updates[key] = value
    if updates:
        updates["updated_at"] = now_iso
        user_ref.set(updates, merge=True)
        data.update(updates)
    return data


def _normalize_profile(uid: str, data: Dict[str, Any]) -> UserProfileResponse:
    normalized_state = _normalize_user_subscription_state(data)
    updates: Dict[str, Any] = {}
    for key, value in normalized_state.items():
        if data.get(key) != value:
            updates[key] = value
    if updates:
        _update_user_profile(uid, updates)
        data.update(updates)
    plan = normalized_state["plan"]
    access_plan = normalized_state["access_plan"]
    is_premium = normalized_state["is_premium"]
    premium_status = normalized_state["premium_status"]
    premium_until = normalized_state["premium_until"]
    return UserProfileResponse(
        uid=uid,
        name=data.get("name"),
        email=data.get("email"),
        currency=data.get("currency"),
        baseCurrency=data.get("baseCurrency"),
        language=data.get("language"),
        created_at=data.get("created_at"),
        updated_at=data.get("updated_at"),
        plan=plan,
        access_plan=access_plan,
        is_premium=is_premium,
        premium_status=premium_status,
        premium_until=premium_until,
        premium_since=data.get("premium_since"),
        premium_source=data.get("premium_source"),
        active_tariff_id=normalized_state["active_tariff_id"],
        pending_tariff_id=normalized_state["pending_tariff_id"],
        trial_status=normalized_state["trial_status"],
        trial_started_at=normalized_state["trial_started_at"],
        trial_ends_at=normalized_state["trial_ends_at"],
        trial_expired_at=normalized_state["trial_expired_at"],
        trial_converted_at=normalized_state["trial_converted_at"],
        trial_tariff_id=normalized_state["trial_tariff_id"],
        trial_access_plan=normalized_state["trial_access_plan"],
        trial_consumed=normalized_state["trial_consumed"],
    )


def _update_user_profile(uid: str, updates: Dict[str, Any]) -> None:
    db = get_firestore_client()
    user_ref = db.collection("users").document(uid)
    updates = {**updates, "updated_at": datetime.now(timezone.utc).isoformat()}
    user_ref.set(updates, merge=True)


def _update_custom_claims(uid: str, updates: Dict[str, Any]) -> None:
    try:
        user = admin_auth.get_user(uid)
        claims = user.custom_claims or {}
        claims.update(updates)
        admin_auth.set_custom_user_claims(uid, claims)
    except Exception as exc:
        logger.warning("Failed to update custom claims for uid=%s: %s", uid, exc)


def _set_user_plan(
    uid: str,
    *,
    plan: str,
    source: str,
    premium_until: Optional[str] = None,
    premium_status: Optional[str] = None,
    tariff_id: Optional[str] = None,
) -> None:
    db = get_firestore_client()
    user_ref = db.collection("users").document(uid)
    existing_snapshot = user_ref.get()
    existing_data = existing_snapshot.to_dict() if existing_snapshot.exists else {}

    plan = _normalize_account_plan_name(plan, default="free")
    is_premium = _compute_is_premium(plan, premium_until, premium_status)
    now_iso = datetime.now(timezone.utc).isoformat()
    payload: Dict[str, Any] = {
        "plan": plan,
        "is_premium": is_premium,
        "premium_source": source,
        "premium_since": now_iso if is_premium else None,
        "premium_until": premium_until,
        "premium_status": premium_status,
    }
    if plan == "premium":
        payload["active_tariff_id"] = tariff_id or existing_data.get("active_tariff_id")
        payload["pending_tariff_id"] = None
        if existing_data.get("trial_status") == "active":
            payload["trial_status"] = "converted"
            payload["trial_converted_at"] = now_iso
    else:
        payload["active_tariff_id"] = None
        if tariff_id:
            payload["pending_tariff_id"] = tariff_id

    normalized_state = _normalize_user_subscription_state({**existing_data, **payload})
    for key, value in normalized_state.items():
        if payload.get(key) != value:
            payload[key] = value

    _update_user_profile(uid, payload)
    _update_custom_claims(
        uid,
        {
            "plan": normalized_state["plan"],
            "is_premium": normalized_state["is_premium"],
            "access_plan": normalized_state["access_plan"],
        },
    )


def _auth_user_to_dict(user: admin_auth.UserRecord) -> UserAuthResponse:
    return UserAuthResponse(
        uid=user.uid,
        email=user.email,
        email_verified=user.email_verified,
        display_name=user.display_name,
        phone_number=user.phone_number,
        photo_url=user.photo_url,
        disabled=user.disabled,
        provider_ids=[p.provider_id for p in (user.provider_data or [])],
        custom_claims=user.custom_claims or {},
        created_at=_ts_ms_to_iso(user.user_metadata.creation_timestamp),
        last_sign_in=_ts_ms_to_iso(user.user_metadata.last_sign_in_timestamp),
    )


def _collect_collection(collection_ref) -> List[Dict[str, Any]]:
    docs = []
    for doc in collection_ref.stream():
        data = doc.to_dict() or {}
        data["id"] = doc.id
        docs.append(data)
    return docs


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    if parsed != parsed:
        return default
    return parsed


def _wallet_net_balance(wallet: Dict[str, Any], transactions: List[Dict[str, Any]]) -> float:
    net = _to_float(wallet.get("balance"), default=0.0)
    for tx in transactions:
        amount = _to_float(tx.get("balance"), default=0.0)
        tx_type = str(tx.get("type") or "").strip().lower()
        if tx_type == "income":
            net += amount
        elif tx_type == "expensese":
            net -= amount
    return net


def _get_user_full_data(uid: str) -> Dict[str, Any]:
    db = get_firestore_client()
    user_ref = db.collection("users").document(uid)
    snapshot = user_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    data = snapshot.to_dict() or {}
    data["uid"] = uid
    updates: Dict[str, Any] = {}
    normalized_state = _normalize_user_subscription_state(data)
    for key, value in normalized_state.items():
        if data.get(key) != value:
            updates[key] = value
    if updates:
        _update_user_profile(uid, updates)
        data.update(updates)

    wallets = []
    for wallet_doc in user_ref.collection("wallets").stream():
        wallet = wallet_doc.to_dict() or {}
        wallet["id"] = wallet_doc.id
        wallet["transactions"] = _collect_collection(
            wallet_doc.reference.collection("transactions")
        )
        wallets.append(wallet)

    data["wallets"] = wallets
    data["budgets"] = _collect_collection(user_ref.collection("budgets"))
    data["bills"] = _collect_collection(user_ref.collection("bills"))
    data["planBudgets"] = _collect_collection(user_ref.collection("planBudgets"))
    return data


def _normalize_plan_name(plan: str) -> str:
    plan = (plan or "").strip().lower()
    if plan not in {"free", "premium"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid plan")
    return plan


def _normalize_permissions(raw: Dict[str, Any]) -> Dict[str, Any]:
    normalized: Dict[str, Any] = {}
    for key, value in raw.items():
        if isinstance(value, bool):
            normalized[str(key)] = value
        elif isinstance(value, (int, float)):
            normalized[str(key)] = value
        elif isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"true", "false"}:
                normalized[str(key)] = lowered == "true"
            else:
                try:
                    normalized[str(key)] = int(value)
                except Exception:
                    normalized[str(key)] = value
        else:
            normalized[str(key)] = value
    return normalized


def _get_plan_permissions(plan: str) -> Dict[str, Any]:
    db = get_firestore_client()
    doc = db.collection("plan_permissions").document(plan).get()
    if not doc.exists:
        return {}
    data = doc.to_dict() or {}
    permissions = data.get("permissions") or {}
    if isinstance(permissions, dict):
        return _normalize_permissions(permissions)
    return {}


def _get_plan_permissions_doc(plan: str) -> Dict[str, Any]:
    db = get_firestore_client()
    doc = db.collection("plan_permissions").document(plan).get()
    if not doc.exists:
        return {"permissions": {}, "updated_at": None}
    data = doc.to_dict() or {}
    permissions = data.get("permissions") or {}
    if not isinstance(permissions, dict):
        permissions = {}
    return {
        "permissions": _normalize_permissions(permissions),
        "updated_at": data.get("updated_at"),
    }


def _set_plan_permissions(plan: str, permissions: Dict[str, Any], merge: bool = True) -> Dict[str, Any]:
    db = get_firestore_client()
    now_iso = datetime.now(timezone.utc).isoformat()
    plan_ref = db.collection("plan_permissions").document(plan)
    if merge:
        existing = _get_plan_permissions(plan)
        merged = {**existing, **_normalize_permissions(permissions)}
        plan_ref.set({"permissions": merged, "updated_at": now_iso}, merge=True)
        return {"permissions": merged, "updated_at": now_iso}
    normalized = _normalize_permissions(permissions)
    plan_ref.set({"permissions": normalized, "updated_at": now_iso})
    return {"permissions": normalized, "updated_at": now_iso}


def _seed_plan_permissions(settings: Settings) -> None:
    db = get_firestore_client()
    now_iso = datetime.now(timezone.utc).isoformat()
    plan_defaults = {
        "free": _normalize_permissions(settings.default_permissions_free_dict),
        "premium": _normalize_permissions(settings.default_permissions_premium_dict),
    }
    for plan, defaults in plan_defaults.items():
        doc_ref = db.collection("plan_permissions").document(plan)
        snapshot = doc_ref.get()
        if not snapshot.exists and defaults:
            doc_ref.set({"permissions": defaults, "updated_at": now_iso})


def _normalize_tariff_id(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9_-]+", "-", str(value or "").strip().lower())
    normalized = re.sub(r"-{2,}", "-", normalized).strip("-")
    if not normalized:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tariff_id")
    return normalized


def _normalize_tariff_purchase_type(value: Optional[str]) -> str:
    purchase_type = str(value or "subscription").strip().lower()
    if purchase_type not in _TARIFF_PURCHASE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid purchase_type",
        )
    return purchase_type


def _normalize_tariff_billing_unit(value: Optional[str]) -> str:
    unit = str(value or "month").strip().lower()
    if unit not in _TARIFF_BILLING_UNITS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid billing_period_unit",
        )
    return unit


def _normalize_tariff_store_product_ids(raw: Any) -> Dict[str, str]:
    if isinstance(raw, TariffStoreProductIds):
        raw = raw.model_dump()
    if not isinstance(raw, dict):
        raw = {}
    normalized: Dict[str, str] = {}
    for platform in _TARIFF_STORE_PLATFORMS:
        product_id = raw.get(platform)
        if product_id is None:
            continue
        cleaned = str(product_id).strip()
        if cleaned:
            normalized[platform] = cleaned
    return normalized


def _normalize_tariff_payload(payload: TariffPlanPayload) -> Dict[str, Any]:
    raw = payload.model_dump()
    name = str(raw.get("name") or "").strip()
    title = str(raw.get("title") or "").strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tariff name is required")
    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tariff title is required")

    access_plan = _normalize_account_plan_name(raw.get("access_plan"), default="")
    if access_plan not in _TARIFF_ACCESS_PLANS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid access_plan",
        )
    purchase_type = _normalize_tariff_purchase_type(raw.get("purchase_type"))
    billing_period_unit = _normalize_tariff_billing_unit(raw.get("billing_period_unit"))
    try:
        billing_period_count = int(raw.get("billing_period_count") or 0)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid billing_period_count",
        ) from exc
    if billing_period_unit != "lifetime" and billing_period_count < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="billing_period_count must be >= 1 for non-lifetime tariffs",
        )
    if billing_period_unit == "lifetime":
        billing_period_count = 0

    try:
        price_amount = float(raw.get("price_amount") or 0.0)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid price_amount",
        ) from exc
    if price_amount < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="price_amount cannot be negative",
        )

    currency = str(raw.get("currency") or "USD").strip().upper()
    if not currency:
        currency = "USD"
    try:
        discount_percent = int(raw.get("discount_percent") or 0)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid discount_percent",
        ) from exc
    if discount_percent < 0 or discount_percent > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="discount_percent must be between 0 and 100",
        )

    try:
        trial_days = int(raw.get("trial_days") or 0)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid trial_days",
        ) from exc
    if trial_days < 0 or trial_days > 365:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="trial_days must be between 0 and 365",
        )

    discount_label = raw.get("discount_label")
    if discount_percent > 0 and not discount_label:
        discount_label = f"SAVE {discount_percent}%"
    badge_text = raw.get("badge_text")
    if trial_days > 0 and not badge_text:
        badge_text = f"{trial_days} days free"

    nighth_style = raw.get("nighth_style")
    if not isinstance(nighth_style, dict):
        nighth_style = {}

    return {
        "name": name,
        "title": title,
        "subtitle": (raw.get("subtitle") or None),
        "description": (raw.get("description") or None),
        "access_plan": access_plan,
        "purchase_type": purchase_type,
        "billing_period_unit": billing_period_unit,
        "billing_period_count": billing_period_count,
        "price_amount": price_amount,
        "currency": currency,
        "price_label": (raw.get("price_label") or None),
        "price_sub_label": (raw.get("price_sub_label") or None),
        "discount_percent": discount_percent,
        "discount_label": (discount_label or None),
        "badge_text": (badge_text or None),
        "trial_days": trial_days,
        "is_featured": bool(raw.get("is_featured")),
        "is_active": bool(raw.get("is_active", True)),
        "sort_order": int(raw.get("sort_order") or 0),
        "cta_title": (raw.get("cta_title") or None),
        "cta_subtitle": (raw.get("cta_subtitle") or None),
        "cta_button_text": (raw.get("cta_button_text") or None),
        "nighth_style": nighth_style,
        "store_product_ids": _normalize_tariff_store_product_ids(raw.get("store_product_ids")),
    }


def _tariff_doc_to_response(doc_id: str, raw: Dict[str, Any]) -> TariffPlanResponse:
    store_product_ids = _normalize_tariff_store_product_ids(raw.get("store_product_ids"))
    purchase_type = str(raw.get("purchase_type") or "subscription").strip().lower()
    if purchase_type not in _TARIFF_PURCHASE_TYPES:
        purchase_type = "subscription"
    billing_period_unit = str(raw.get("billing_period_unit") or "month").strip().lower()
    if billing_period_unit not in _TARIFF_BILLING_UNITS:
        billing_period_unit = "month"
    try:
        billing_period_count = int(raw.get("billing_period_count") or 0)
    except Exception:
        billing_period_count = 0 if billing_period_unit == "lifetime" else 1
    if billing_period_unit != "lifetime" and billing_period_count < 1:
        billing_period_count = 1
    if billing_period_unit == "lifetime":
        billing_period_count = 0
    try:
        price_amount = float(raw.get("price_amount") or 0.0)
    except Exception:
        price_amount = 0.0
    try:
        discount_percent = int(raw.get("discount_percent") or 0)
    except Exception:
        discount_percent = 0
    discount_percent = max(0, min(100, discount_percent))
    trial_days_raw = raw.get("trial_days")
    try:
        trial_days = max(0, int(trial_days_raw or 0))
    except Exception:
        trial_days = 0

    return TariffPlanResponse(
        id=doc_id,
        name=str(raw.get("name") or doc_id),
        title=str(raw.get("title") or doc_id),
        subtitle=raw.get("subtitle"),
        description=raw.get("description"),
        access_plan=_normalize_account_plan_name(raw.get("access_plan"), default="premium"),
        purchase_type=purchase_type,
        billing_period_unit=billing_period_unit,
        billing_period_count=billing_period_count,
        price_amount=price_amount,
        currency=str(raw.get("currency") or "USD").upper(),
        price_label=raw.get("price_label"),
        price_sub_label=raw.get("price_sub_label"),
        discount_percent=discount_percent,
        discount_label=raw.get("discount_label"),
        badge_text=raw.get("badge_text"),
        trial_days=trial_days,
        is_featured=bool(raw.get("is_featured")),
        is_active=bool(raw.get("is_active", True)),
        sort_order=int(raw.get("sort_order") or 0),
        cta_title=raw.get("cta_title"),
        cta_subtitle=raw.get("cta_subtitle"),
        cta_button_text=raw.get("cta_button_text"),
        nighth_style=raw.get("nighth_style") if isinstance(raw.get("nighth_style"), dict) else {},
        store_product_ids=TariffStoreProductIds(**store_product_ids),
        created_at=raw.get("created_at"),
        updated_at=raw.get("updated_at"),
    )


def _list_tariffs(*, include_inactive: bool = False, platform: Optional[str] = None) -> List[TariffPlanResponse]:
    platform = _normalize_ads_platform(platform) if platform else None
    db = get_firestore_client()
    tariffs: List[TariffPlanResponse] = []
    for doc in db.collection("tariff_plans").stream():
        tariff = _tariff_doc_to_response(doc.id, doc.to_dict() or {})
        if not include_inactive and not tariff.is_active:
            continue
        if platform and not getattr(tariff.store_product_ids, platform, None):
            continue
        tariffs.append(tariff)
    tariffs.sort(key=lambda item: (item.sort_order, 0 if item.is_featured else 1, item.id))
    return tariffs


def _get_tariff_by_id(tariff_id: str, *, require_active: bool = False) -> TariffPlanResponse:
    normalized_id = _normalize_tariff_id(tariff_id)
    db = get_firestore_client()
    doc = db.collection("tariff_plans").document(normalized_id).get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tariff not found")
    tariff = _tariff_doc_to_response(doc.id, doc.to_dict() or {})
    if require_active and not tariff.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tariff is inactive",
        )
    return tariff


def _upsert_tariff(
    tariff_id: str,
    payload: TariffPlanPayload,
    *,
    create_only: bool = False,
) -> TariffPlanResponse:
    normalized_id = _normalize_tariff_id(tariff_id)
    db = get_firestore_client()
    ref = db.collection("tariff_plans").document(normalized_id)
    snapshot = ref.get()
    if create_only and snapshot.exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tariff already exists",
        )
    now_iso = datetime.now(timezone.utc).isoformat()
    normalized_payload = _normalize_tariff_payload(payload)
    created_at = None
    if snapshot.exists:
        existing_data = snapshot.to_dict() or {}
        created_at = existing_data.get("created_at")
    if not created_at:
        created_at = now_iso
    to_store = {
        **normalized_payload,
        "created_at": created_at,
        "updated_at": now_iso,
    }
    ref.set(to_store)
    return _tariff_doc_to_response(normalized_id, to_store)


def _patch_tariff(
    tariff_id: str,
    payload: AdminTariffPatchRequest,
) -> TariffPlanResponse:
    existing = _get_tariff_by_id(tariff_id)
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return existing

    merged = existing.model_dump(
        exclude={"id", "created_at", "updated_at"},
        mode="python",
    )

    if "store_product_ids" in updates and updates["store_product_ids"] is not None:
        incoming_store_ids = updates["store_product_ids"]
        if isinstance(incoming_store_ids, TariffStoreProductIds):
            incoming_store_ids = incoming_store_ids.model_dump(exclude_unset=True)
        if not isinstance(incoming_store_ids, dict):
            incoming_store_ids = {}
        current_store_ids = merged.get("store_product_ids") or {}
        if isinstance(current_store_ids, TariffStoreProductIds):
            current_store_ids = current_store_ids.model_dump(exclude_unset=True)
        if not isinstance(current_store_ids, dict):
            current_store_ids = {}
        merged["store_product_ids"] = {
            **current_store_ids,
            **incoming_store_ids,
        }
        updates = {k: v for k, v in updates.items() if k != "store_product_ids"}

    merged.update(updates)

    normalized_payload = _normalize_tariff_payload(TariffPlanPayload(**merged))
    db = get_firestore_client()
    now_iso = datetime.now(timezone.utc).isoformat()
    normalized_id = existing.id
    to_store = {
        **normalized_payload,
        "created_at": existing.created_at or now_iso,
        "updated_at": now_iso,
    }
    db.collection("tariff_plans").document(normalized_id).set(to_store)
    return _tariff_doc_to_response(normalized_id, to_store)


def _find_tariff_by_store_product_id(product_id: Optional[str], platform: str) -> Optional[TariffPlanResponse]:
    if not product_id:
        return None
    platform = _normalize_ads_platform(platform)
    for tariff in _list_tariffs(include_inactive=True):
        if getattr(tariff.store_product_ids, platform, None) == product_id:
            return tariff
    return None


def _seed_tariff_plans(settings: Settings) -> None:
    db = get_firestore_client()
    collection = db.collection("tariff_plans")
    if any(collection.limit(1).stream()):
        return

    now_iso = datetime.now(timezone.utc).isoformat()
    google_sub_ids = sorted(settings.google_play_subscription_id_set)
    apple_sub_ids = sorted(settings.apple_subscription_id_set)

    monthly_android = google_sub_ids[0] if len(google_sub_ids) > 0 else "monthly_premium"
    yearly_android = google_sub_ids[1] if len(google_sub_ids) > 1 else monthly_android
    monthly_ios = apple_sub_ids[0] if len(apple_sub_ids) > 0 else "monthly_premium"
    yearly_ios = apple_sub_ids[1] if len(apple_sub_ids) > 1 else monthly_ios

    defaults: List[tuple[str, TariffPlanPayload]] = [
        (
            "premium_1_month",
            TariffPlanPayload(
                name="1 Month Premium",
                title="1 MONTH",
                subtitle=None,
                description="Monthly premium plan",
                access_plan="premium",
                purchase_type="subscription",
                billing_period_unit="month",
                billing_period_count=1,
                price_amount=5.99,
                currency="USD",
                price_label="US$5.99",
                price_sub_label="US$5.99/month",
                discount_percent=0,
                discount_label=None,
                badge_text=None,
                trial_days=0,
                is_featured=False,
                is_active=True,
                sort_order=10,
                cta_title=None,
                cta_subtitle=None,
                cta_button_text=None,
                nighth_style={"accent": "#7B61FF"},
                store_product_ids=TariffStoreProductIds(
                    ios=monthly_ios,
                    android=monthly_android,
                ),
            ),
        ),
        (
            "premium_12_month",
            TariffPlanPayload(
                name="12 Month Premium",
                title="12 MONTHS",
                subtitle=None,
                description="Best value yearly premium plan",
                access_plan="premium",
                purchase_type="subscription",
                billing_period_unit="year",
                billing_period_count=1,
                price_amount=59.99,
                currency="USD",
                price_label="US$59.99",
                price_sub_label="US$5.00/month",
                discount_percent=28,
                discount_label="SAVE 28%",
                badge_text="7 days free",
                trial_days=7,
                is_featured=True,
                is_active=True,
                sort_order=20,
                cta_title="Try 7-days for free, then US$59.99/year.",
                cta_subtitle="You can cancel anytime.",
                cta_button_text="TRY FREE & SUBSCRIBE",
                nighth_style={"accent": "#7B61FF"},
                store_product_ids=TariffStoreProductIds(
                    ios=yearly_ios,
                    android=yearly_android,
                ),
            ),
        ),
    ]

    for tariff_id, payload in defaults:
        normalized = _normalize_tariff_payload(payload)
        collection.document(tariff_id).set(
            {
                **normalized,
                "created_at": now_iso,
                "updated_at": now_iso,
            }
        )


def _normalize_ads_platform(platform: str) -> str:
    platform = (platform or "").strip().lower()
    if platform not in {"ios", "android"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid platform")
    return platform


def _normalize_ads_config(raw: Dict[str, Any]) -> Dict[str, Any]:
    normalized: Dict[str, Any] = {}
    if "enabled" in raw:
        normalized["enabled"] = bool(raw.get("enabled"))
    if "min_interval_sec" in raw:
        try:
            normalized["min_interval_sec"] = max(0, int(raw.get("min_interval_sec")))
        except Exception:
            normalized["min_interval_sec"] = 0
    if "min_view_sec" in raw:
        try:
            normalized["min_view_sec"] = max(0, int(raw.get("min_view_sec")))
        except Exception:
            normalized["min_view_sec"] = 0
    if "show_on" in raw:
        show_on = raw.get("show_on")
        if isinstance(show_on, str):
            items = [item.strip() for item in show_on.split(",") if item.strip()]
        elif isinstance(show_on, list):
            items = [str(item).strip() for item in show_on if str(item).strip()]
        else:
            items = []
        normalized["show_on"] = items
    return normalized


def _default_ads_config(platform: str, settings: Settings) -> Dict[str, Any]:
    raw = (
        settings.default_ads_config_ios_dict
        if platform == "ios"
        else settings.default_ads_config_android_dict
    )
    if raw:
        return _normalize_ads_config(raw)
    return {
        "enabled": False,
        "min_interval_sec": 3600,
        "min_view_sec": 5,
        "show_on": ["home"],
    }


def _get_ads_config_doc(platform: str, settings: Settings) -> Dict[str, Any]:
    db = get_firestore_client()
    doc = db.collection("ads_config").document(platform).get()
    if not doc.exists:
        return {"config": _default_ads_config(platform, settings), "updated_at": None}
    data = doc.to_dict() or {}
    config = data.get("config") or {}
    if not isinstance(config, dict):
        config = {}
    normalized = _normalize_ads_config(config)
    if not normalized:
        normalized = _default_ads_config(platform, settings)
    return {"config": normalized, "updated_at": data.get("updated_at")}


def _get_ads_config(platform: str, settings: Settings) -> Dict[str, Any]:
    doc = _get_ads_config_doc(platform, settings)
    return doc["config"]


def _set_ads_config(
    platform: str, config: Dict[str, Any], merge: bool = True
) -> Dict[str, Any]:
    db = get_firestore_client()
    now_iso = datetime.now(timezone.utc).isoformat()
    ref = db.collection("ads_config").document(platform)
    if merge:
        existing = _get_ads_config(platform, get_settings())
        merged = {**existing, **_normalize_ads_config(config)}
        ref.set({"config": merged, "updated_at": now_iso}, merge=True)
        return {"config": merged, "updated_at": now_iso}
    normalized = _normalize_ads_config(config)
    ref.set({"config": normalized, "updated_at": now_iso})
    return {"config": normalized, "updated_at": now_iso}


def _seed_ads_config(settings: Settings) -> None:
    db = get_firestore_client()
    now_iso = datetime.now(timezone.utc).isoformat()
    for platform in ("ios", "android"):
        defaults = _default_ads_config(platform, settings)
        doc_ref = db.collection("ads_config").document(platform)
        snapshot = doc_ref.get()
        if not snapshot.exists and defaults:
            doc_ref.set({"config": defaults, "updated_at": now_iso})


_GOOGLE_PLAY_SCOPE = "https://www.googleapis.com/auth/androidpublisher"
_APPLE_AUTH_ISSUER = "https://appleid.apple.com"
_APPLE_AUTH_KEYS_URL = "https://appleid.apple.com/auth/keys"
_APPLE_VERIFY_PROD_URL = "https://buy.itunes.apple.com/verifyReceipt"
_APPLE_VERIFY_SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt"


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _load_service_account_info(path_or_json: str) -> Dict[str, Any]:
    try:
        return json.loads(path_or_json)
    except Exception:
        with open(path_or_json, "r", encoding="utf-8") as fh:
            return json.load(fh)


@lru_cache(maxsize=1)
def _google_play_credentials(path_or_json: str) -> service_account.Credentials:
    info = _load_service_account_info(path_or_json)
    return service_account.Credentials.from_service_account_info(
        info, scopes=[_GOOGLE_PLAY_SCOPE]
    )


def _get_google_access_token(settings: Settings) -> str:
    if not settings.google_play_service_account_path:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GOOGLE_PLAY_SERVICE_ACCOUNT_PATH is not configured",
        )
    creds = _google_play_credentials(settings.google_play_service_account_path)
    if not creds.valid:
        creds.refresh(google_requests.Request())
    if not creds.token:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google Play access token unavailable",
        )
    return creds.token


def _google_play_get(settings: Settings, url: str) -> Dict[str, Any]:
    token = _get_google_access_token(settings)
    response = requests.get(
        url,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    if response.status_code >= 400:
        logger.warning("Google Play API error %s: %s", response.status_code, response.text)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Google Play verification failed",
        )
    return response.json()


def _google_play_post(settings: Settings, url: str, payload: Optional[Dict[str, Any]] = None) -> None:
    token = _get_google_access_token(settings)
    response = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}"},
        json=payload or {},
        timeout=30,
    )
    if response.status_code >= 400:
        logger.warning("Google Play API error %s: %s", response.status_code, response.text)


def _record_iap_purchase(
    platform: str,
    token: str,
    uid: str,
    *,
    product_id: Optional[str],
    status: Optional[str],
    expires_at: Optional[str],
) -> None:
    if not token:
        return
    db = get_firestore_client()
    doc_id = f"{platform}_{_token_hash(token)}"
    ref = db.collection("iap_purchases").document(doc_id)
    snap = ref.get()
    now_iso = datetime.now(timezone.utc).isoformat()
    existing: Dict[str, Any] = {}
    if snap.exists:
        existing = snap.to_dict() or {}
        if existing.get("uid") and existing.get("uid") != uid:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Purchase token already linked to another user",
            )
    ref.set(
        {
            "platform": platform,
            "token_hash": _token_hash(token),
            "uid": uid,
            "product_id": product_id,
            "status": status,
            "expires_at": expires_at,
            "updated_at": now_iso,
            "created_at": existing.get("created_at", now_iso) if snap.exists else now_iso,
        },
        merge=True,
    )


def _max_expiry_from_line_items(line_items: List[Dict[str, Any]]) -> Optional[str]:
    expiries: List[datetime] = []
    for item in line_items:
        expiry = item.get("expiryTime")
        if not expiry:
            continue
        expiry_dt = _parse_iso(expiry)
        if expiry_dt:
            expiries.append(expiry_dt)
    if not expiries:
        return None
    return max(expiries).isoformat()


def _apple_verify_receipt(settings: Settings, receipt_data: str) -> Dict[str, Any]:
    if not settings.apple_shared_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="APPLE_SHARED_SECRET is not configured",
        )
    if not settings.apple_bundle_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="APPLE_BUNDLE_ID is not configured",
        )
    payload = {
        "receipt-data": receipt_data,
        "password": settings.apple_shared_secret,
        "exclude-old-transactions": True,
    }
    response = requests.post(_APPLE_VERIFY_PROD_URL, json=payload, timeout=30)
    data = response.json()
    status_code = data.get("status")
    if status_code == 21007:
        response = requests.post(_APPLE_VERIFY_SANDBOX_URL, json=payload, timeout=30)
        data = response.json()
        status_code = data.get("status")
    if status_code != 0:
        logger.warning("Apple verifyReceipt failed: %s", data)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Apple receipt verification failed",
        )
    receipt = data.get("receipt", {})
    if receipt.get("bundle_id") != settings.apple_bundle_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Apple receipt bundle ID",
        )
    return data


def _google_ack_subscription(
    settings: Settings, package_name: str, subscription_id: str, token: str
) -> None:
    url = (
        "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"
        f"{package_name}/purchases/subscriptions/{subscription_id}/tokens/{token}:acknowledge"
    )
    _google_play_post(settings, url)


def _google_ack_product(settings: Settings, package_name: str, product_id: str, token: str) -> None:
    url = (
        "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"
        f"{package_name}/purchases/products/{product_id}/tokens/{token}:acknowledge"
    )
    _google_play_post(settings, url)


def _google_verify_subscription(
    settings: Settings, token: str, product_id: Optional[str]
) -> Dict[str, Any]:
    if not settings.google_play_package_name:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GOOGLE_PLAY_PACKAGE_NAME is not configured",
        )
    url = (
        "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"
        f"{settings.google_play_package_name}/purchases/subscriptionsv2/tokens/{token}"
    )
    data = _google_play_get(settings, url)
    line_items = data.get("lineItems", [])
    product_ids = {item.get("productId") for item in line_items if item.get("productId")}
    if product_id and product_ids and product_id not in product_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product ID mismatch",
        )
    resolved_product_id = product_id or next(iter(product_ids), None)
    ack_state = data.get("acknowledgementState")
    if (
        resolved_product_id
        and ack_state
        and str(ack_state).upper() == "ACKNOWLEDGEMENT_STATE_PENDING"
    ):
        _google_ack_subscription(settings, settings.google_play_package_name, resolved_product_id, token)
    return data


def _google_verify_product(
    settings: Settings, token: str, product_id: str
) -> Dict[str, Any]:
    if not settings.google_play_package_name:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GOOGLE_PLAY_PACKAGE_NAME is not configured",
        )
    url = (
        "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"
        f"{settings.google_play_package_name}/purchases/products/{product_id}/tokens/{token}"
    )
    data = _google_play_get(settings, url)
    ack_state = data.get("acknowledgementState")
    if str(ack_state) in {"0", "ACKNOWLEDGEMENT_STATE_PENDING"}:
        _google_ack_product(settings, settings.google_play_package_name, product_id, token)
    return data


@router.on_event("startup")
def _startup():
    settings = get_settings()
    init_firebase(settings)
    _seed_plan_permissions(settings)
    _seed_tariff_plans(settings)
    _seed_ads_config(settings)
    logger.info("Firebase initialized for project %s", settings.firebase_project_id)


@router.post("/auth/apple", response_model=TokenResponse)
def apple_login(payload: AppleAuthRequest, settings: Settings = Depends(get_settings)):
    claims = verify_apple_identity_token(payload, settings)

    subject = str(claims.get("sub")).strip()
    requested_uid = f"{settings.firebase_apple_uid_prefix}{subject}"
    claim_email = str(claims.get("email") or "").strip()
    payload_email = str(payload.email or "").strip()
    resolved_email = claim_email or payload_email or None
    display_name = str(payload.full_name or "").strip() or None

    try:
        user = get_or_create_user(
            uid=requested_uid,
            email=resolved_email,
            display_name=display_name,
            photo_url=None,
        )
        update_fields: Dict[str, Any] = {}
        if resolved_email and not user.email:
            update_fields["email"] = resolved_email
            update_fields["email_verified"] = True
        if display_name and not user.display_name:
            update_fields["display_name"] = display_name
        if update_fields:
            user = admin_auth.update_user(user.uid, **update_fields)
        resolved_uid = user.uid
        logger.info(
            "Apple auth user ready requested_uid=%s resolved_uid=%s email=%s",
            requested_uid,
            resolved_uid,
            user.email,
        )
        _ensure_user_profile(user.uid, user.email, user.display_name)
    except Exception as exc:
        logger.error("Apple auth user sync failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Apple auth user sync failed",
        ) from exc

    try:
        custom = create_custom_token(resolved_uid, {"provider": "apple"})
        logger.info("Custom token issued for Apple uid=%s", resolved_uid)
    except Exception as exc:
        logger.error("Apple custom token creation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Apple custom token creation failed",
        ) from exc

    return TokenResponse(firebase_custom_token=custom)


@router.post("/auth/google", response_model=TokenResponse)
def google_login(payload: GooglePayload, settings: Settings = Depends(get_settings)):
    claims = verify_google_token(payload.id_token, settings)

    requested_uid = f"{settings.firebase_uid_prefix}{claims['sub']}"
    try:
        user = get_or_create_user(
            uid=requested_uid,
            email=claims.get("email"),
            display_name=claims.get("name"),
            photo_url=claims.get("picture"),
        )
        resolved_uid = user.uid
        logger.info(
            "Firebase user ready requested_uid=%s resolved_uid=%s email=%s",
            requested_uid,
            resolved_uid,
            user.email,
        )
        _ensure_user_profile(user.uid, user.email, user.display_name)
    except Exception as exc:
        logger.error("Firebase user sync failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Firebase user sync failed") from exc

    try:
        custom = create_custom_token(resolved_uid, {"provider": "google"})
        logger.info("Custom token issued for uid=%s", resolved_uid)
    except Exception as exc:
        logger.error("Custom token creation failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Custom token creation failed") from exc

    return TokenResponse(firebase_custom_token=custom)


@router.post("/stt", response_model=SttResponse)
async def speech_to_text(
    audio: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
):
    if not settings.muxlisa_voice_text_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="MUXLISA_VOICE_TEXT_API_KEY is not configured",
        )

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty audio file")

    headers = {"x-api-key": settings.muxlisa_voice_text_api_key}
    normalized_type = _normalize_audio_mime(audio.content_type, audio.filename)
    files = {
        "audio": (
            audio.filename or "audio.wav",
            audio_bytes,
            normalized_type,
        )
    }

    try:
        response = requests.post(
            settings.muxlisa_voice_text_url,
            headers=headers,
            files=files,
            timeout=60,
        )
    except requests.RequestException as exc:
        logger.error("Muxlisa STT request failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Speech-to-text service unavailable",
        ) from exc

    if response.status_code >= 400:
        logger.error("Muxlisa STT error %s: %s", response.status_code, response.text)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Speech-to-text failed: {response.text}",
        )

    try:
        data = response.json()
        text = (
            data.get("text")
            or data.get("result")
            or data.get("transcript")
            or data.get("data")
            or ""
        )
        return SttResponse(text=str(text), raw=data)
    except ValueError:
        return SttResponse(text=response.text, raw=response.text)


@router.get("/fx/rates", response_model=FxRatesResponse)
def fx_rates(settings: Settings = Depends(get_settings)):
    try:
        return get_cbu_rates(settings)
    except requests.RequestException as exc:
        logger.error("CBU FX request failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="FX rate service unavailable",
        ) from exc


@router.post("/voice/parse", response_model=VoiceAnalyzeResponse)
def voice_parse(
    payload: VoiceAnalyzeRequest,
    user: Dict[str, Any] = Depends(require_firebase_user),
    settings: Settings = Depends(get_settings),
):
    try:
        result = analyze_transaction_text(
            settings,
            text=payload.text,
            type_hint=payload.type_hint,
            categories=payload.categories,
            locale=payload.locale,
            currency=payload.currency,
        )
    except OpenAIError as exc:
        logger.error("OpenAI analyze failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    return VoiceAnalyzeResponse(**result)


@router.post("/voice/commit")
def voice_commit(
    payload: VoiceCommitRequest,
    user: Dict[str, Any] = Depends(require_firebase_user),
):
    db = get_firestore_client()
    uid = str(user.get("uid"))
    wallet_id = payload.wallet_id
    wallet_ref = (
        db.collection("users")
        .document(uid)
        .collection("wallets")
        .document(wallet_id)
    )
    wallet_snapshot = wallet_ref.get()
    if not wallet_snapshot.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wallet not found",
        )

    amount = _to_float(payload.balance, default=-1.0)
    if amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid amount",
        )

    tx_type = (payload.type or "").strip().lower()
    if tx_type not in {"income", "expensese"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid transaction type",
        )
    if tx_type == "expensese":
        existing_transactions = _collect_collection(wallet_ref.collection("transactions"))
        available_balance = _wallet_net_balance(wallet_snapshot.to_dict() or {}, existing_transactions)
        if amount > available_balance + 1e-9:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Expense amount exceeds wallet balance",
            )

    tx_ref = (
        wallet_ref.collection("transactions").document()
    )
    category_payload = payload.category or {}
    category_id = payload.category_id or category_payload.get("id") or ""
    now_iso = datetime.now(timezone.utc).isoformat()
    note_payload = payload.note or None
    if isinstance(note_payload, dict):
        note_payload = {
            key: value
            for key, value in note_payload.items()
            if value is not None and value != ""
        } or None

    tx_doc = {
        "id": tx_ref.id,
        "userId": uid,
        "walletId": wallet_id,
        "categoryId": category_id,
        "balance": amount,
        "date": payload.date or now_iso,
        "type": tx_type,
        "currency": payload.currency,
        "note": note_payload,
        "category": category_payload,
    }
    tx_ref.set(tx_doc)
    return tx_doc


@router.get("/me", response_model=UserProfileResponse)
def get_me(user: Dict[str, Any] = Depends(require_firebase_user)):
    uid = str(user.get("uid"))
    auth_user = admin_auth.get_user(uid)
    profile_data = _ensure_user_profile(uid, auth_user.email, auth_user.display_name)
    return _normalize_profile(uid, profile_data)


@router.get("/me/permissions", response_model=UserPermissionsResponse)
def get_my_permissions(user: Dict[str, Any] = Depends(require_firebase_user)):
    uid = str(user.get("uid"))
    auth_user = admin_auth.get_user(uid)
    profile_data = _ensure_user_profile(uid, auth_user.email, auth_user.display_name)
    profile = _normalize_profile(uid, profile_data)
    effective_plan = _normalize_account_plan_name(profile.access_plan, default="free")
    permissions = _get_plan_permissions(effective_plan)
    return UserPermissionsResponse(plan=effective_plan, permissions=permissions)


@router.get("/tariffs", response_model=TariffPlanListResponse)
def get_tariffs(
    platform: Optional[str] = None,
    include_inactive: bool = False,
    user: Dict[str, Any] = Depends(require_firebase_user),
    settings: Settings = Depends(get_settings),
):
    allow_inactive = include_inactive and (
        bool(user.get("admin") is True) or str(user.get("uid")) in settings.admin_uid_set
    )
    tariffs = _list_tariffs(
        include_inactive=allow_inactive,
        platform=platform,
    )
    # Mobile paywall for VoxWallet currently supports subscription plans only.
    tariffs = [
        item
        for item in tariffs
        if item.purchase_type == "subscription" and item.billing_period_unit != "lifetime"
    ]
    return TariffPlanListResponse(tariffs=tariffs)


@router.post("/me/trial/start", response_model=TrialStartResponse)
def start_my_trial(
    payload: TrialStartRequest,
    user: Dict[str, Any] = Depends(require_firebase_user),
):
    uid = str(user.get("uid"))
    auth_user = admin_auth.get_user(uid)
    profile_data = _ensure_user_profile(uid, auth_user.email, auth_user.display_name)
    profile = _normalize_profile(uid, profile_data)
    tariff = _get_tariff_by_id(payload.tariff_id, require_active=True)
    if tariff.trial_days <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected tariff does not support trial",
        )
    if profile.is_premium:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Premium users cannot start trial",
        )
    if _is_trial_active(profile.trial_status, profile.trial_ends_at):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Trial already active",
        )
    if profile.trial_consumed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Trial already used",
        )

    now = datetime.now(timezone.utc)
    trial_ends_at = (now + timedelta(days=tariff.trial_days)).isoformat()
    _update_user_profile(
        uid,
        {
            "trial_status": "active",
            "trial_started_at": now.isoformat(),
            "trial_ends_at": trial_ends_at,
            "trial_tariff_id": tariff.id,
            "trial_access_plan": tariff.access_plan,
            "trial_consumed": True,
            "pending_tariff_id": tariff.id,
        },
    )
    refreshed = _normalize_profile(
        uid,
        _ensure_user_profile(uid, auth_user.email, auth_user.display_name),
    )
    _update_custom_claims(
        uid,
        {
            "plan": refreshed.plan,
            "is_premium": refreshed.is_premium,
            "access_plan": refreshed.access_plan,
        },
    )
    return TrialStartResponse(profile=refreshed, tariff=tariff)


@router.get("/me/notifications/unread-count", response_model=NotificationUnreadCountResponse)
def get_my_notification_unread_count(user: Dict[str, Any] = Depends(require_firebase_user)):
    uid = str(user.get("uid"))
    return NotificationUnreadCountResponse(unread_count=get_unread_notification_count(uid))


@router.post("/me/push-tokens/register", response_model=PushTokenRegisterResponse)
def register_my_push_token(
    payload: PushTokenRegisterRequest,
    user: Dict[str, Any] = Depends(require_firebase_user),
):
    uid = str(user.get("uid"))
    try:
        return register_push_token(uid, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/me/push-tokens/unregister", response_model=PushTokenUnregisterResponse)
def unregister_my_push_token(
    payload: PushTokenUnregisterRequest,
    user: Dict[str, Any] = Depends(require_firebase_user),
):
    uid = str(user.get("uid"))
    try:
        return unregister_push_token(uid, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/me/notifications/read-all", response_model=NotificationMarkAllReadResponse)
def mark_my_notifications_read_all(user: Dict[str, Any] = Depends(require_firebase_user)):
    uid = str(user.get("uid"))
    return mark_all_notifications_read(uid)


@router.post("/me/notifications/overspending", response_model=OverspendingNotificationResponse)
def create_my_overspending_notification(
    payload: OverspendingNotificationRequest,
    user: Dict[str, Any] = Depends(require_firebase_user),
):
    uid = str(user.get("uid"))
    return create_overspending_notification(uid, payload)


@router.post("/me/notifications/{notification_id}/read", response_model=NotificationMarkReadResponse)
def mark_my_notification_read(
    notification_id: str,
    user: Dict[str, Any] = Depends(require_firebase_user),
):
    uid = str(user.get("uid"))
    return mark_notification_read(uid, notification_id)


@router.get("/me/notifications", response_model=NotificationListResponse)
def get_my_notifications(
    limit: int = 20,
    unread_only: bool = False,
    language: Optional[str] = None,
    user: Dict[str, Any] = Depends(require_firebase_user),
):
    uid = str(user.get("uid"))
    return list_user_notifications(
        uid,
        limit=limit,
        unread_only=unread_only,
        language=language,
    )


@router.get("/ads/config/{platform}", response_model=AdsConfigResponse)
def get_ads_config(
    platform: str,
    user: Dict[str, Any] = Depends(require_firebase_user),
    settings: Settings = Depends(get_settings),
):
    platform = _normalize_ads_platform(platform)
    uid = str(user.get("uid"))
    auth_user = admin_auth.get_user(uid)
    profile_data = _ensure_user_profile(uid, auth_user.email, auth_user.display_name)
    profile = _normalize_profile(uid, profile_data)
    config_doc = _get_ads_config_doc(platform, settings)
    config = config_doc["config"]
    if profile.access_plan != "free":
        config = {**config, "enabled": False}
    return AdsConfigResponse(
        platform=platform,
        config=config,
        updated_at=config_doc["updated_at"],
    )


@router.post("/iap/google/verify", response_model=IapVerifyResponse)
def verify_google_iap(
    payload: GoogleIapVerifyRequest,
    user: Dict[str, Any] = Depends(require_firebase_user),
    settings: Settings = Depends(get_settings),
):
    if not payload.purchase_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing purchase token")
    uid = str(user.get("uid"))

    is_subscription = payload.is_subscription or (
        payload.product_id in settings.google_play_subscription_id_set
    )
    if is_subscription:
        data = _google_verify_subscription(settings, payload.purchase_token, payload.product_id)
        line_items = data.get("lineItems", [])
        premium_until = _max_expiry_from_line_items(line_items)
        premium_status = data.get("subscriptionState")
        plan = "premium" if _compute_is_premium("premium", premium_until, premium_status) else "free"
        resolved_product_id = payload.product_id
        if not resolved_product_id and line_items:
            resolved_product_id = line_items[0].get("productId")
        _record_iap_purchase(
            "google",
            payload.purchase_token,
            uid,
            product_id=resolved_product_id,
            status=premium_status,
            expires_at=premium_until,
        )
        matched_tariff = _find_tariff_by_store_product_id(resolved_product_id, "android")
        _set_user_plan(
            uid,
            plan=plan,
            source="iap:google",
            premium_until=premium_until,
            premium_status=premium_status,
            tariff_id=matched_tariff.id if matched_tariff else None,
        )
        auth_user = admin_auth.get_user(uid)
        profile = _normalize_profile(
            uid, _ensure_user_profile(uid, auth_user.email, auth_user.display_name)
        )
        return IapVerifyResponse(profile=profile, platform="google", product_id=resolved_product_id)

    data = _google_verify_product(settings, payload.purchase_token, payload.product_id)
    purchase_state = data.get("purchaseState")
    plan = "premium" if str(purchase_state) == "0" else "free"
    premium_status = "purchased" if plan == "premium" else "canceled"
    _record_iap_purchase(
        "google",
        payload.purchase_token,
        uid,
        product_id=payload.product_id,
        status=premium_status,
        expires_at=None,
    )
    matched_tariff = _find_tariff_by_store_product_id(payload.product_id, "android")
    _set_user_plan(
        uid,
        plan=plan,
        source="iap:google",
        premium_until=None,
        premium_status=premium_status,
        tariff_id=matched_tariff.id if matched_tariff else None,
    )
    auth_user = admin_auth.get_user(uid)
    profile = _normalize_profile(
        uid, _ensure_user_profile(uid, auth_user.email, auth_user.display_name)
    )
    return IapVerifyResponse(profile=profile, platform="google", product_id=payload.product_id)


@router.post("/iap/apple/verify", response_model=IapVerifyResponse)
def verify_apple_iap(
    payload: AppleIapVerifyRequest,
    user: Dict[str, Any] = Depends(require_firebase_user),
    settings: Settings = Depends(get_settings),
):
    if not payload.receipt_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing receipt data")
    uid = str(user.get("uid"))
    data = _apple_verify_receipt(settings, payload.receipt_data)
    receipt = data.get("receipt", {}) or {}
    latest_info = data.get("latest_receipt_info") or receipt.get("in_app") or []
    allowed_subscriptions = settings.apple_subscription_id_set
    allowed_products = settings.apple_product_id_set
    allowed_ids = allowed_subscriptions.union(allowed_products)

    def is_cancelled(item: Dict[str, Any]) -> bool:
        return bool(item.get("cancellation_date") or item.get("cancellation_date_ms"))

    filtered_items = []
    for item in latest_info:
        product_id = item.get("product_id")
        if payload.product_id and product_id != payload.product_id:
            continue
        if allowed_ids and product_id not in allowed_ids:
            continue
        if is_cancelled(item):
            continue
        filtered_items.append(item)

    premium_until = None
    max_expiry: Optional[datetime] = None
    resolved_product_id = payload.product_id
    token_id = None
    for item in filtered_items:
        product_id = item.get("product_id")
        if not resolved_product_id and product_id:
            resolved_product_id = product_id
        expires_ms = item.get("expires_date_ms")
        if expires_ms:
            try:
                expiry_dt = datetime.fromtimestamp(int(expires_ms) / 1000, timezone.utc)
                if not max_expiry or expiry_dt > max_expiry:
                    max_expiry = expiry_dt
            except Exception:
                pass
        token_id = item.get("original_transaction_id") or item.get("transaction_id") or token_id

    if max_expiry:
        premium_until = max_expiry.isoformat()

    plan = "free"
    premium_status = "expired"
    if premium_until:
        plan = "premium" if _compute_is_premium("premium", premium_until, "active") else "free"
        premium_status = "active" if plan == "premium" else "expired"
    elif filtered_items:
        plan = "premium"
        premium_status = "purchased"

    _record_iap_purchase(
        "apple",
        token_id or payload.receipt_data,
        uid,
        product_id=resolved_product_id,
        status=premium_status,
        expires_at=premium_until,
    )
    matched_tariff = _find_tariff_by_store_product_id(resolved_product_id, "ios")
    _set_user_plan(
        uid,
        plan=plan,
        source="iap:apple",
        premium_until=premium_until,
        premium_status=premium_status,
        tariff_id=matched_tariff.id if matched_tariff else None,
    )
    auth_user = admin_auth.get_user(uid)
    profile = _normalize_profile(
        uid, _ensure_user_profile(uid, auth_user.email, auth_user.display_name)
    )
    return IapVerifyResponse(profile=profile, platform="apple", product_id=resolved_product_id)


@router.get("/admin/users", response_model=AdminUserListResponse)
def admin_list_users(
    limit: int = 100,
    page_token: Optional[str] = None,
    include_firestore: bool = False,
    include_data: bool = False,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    limit = max(1, min(limit, 1000))
    page = admin_auth.list_users(page_token=page_token, max_results=limit)
    users: List[AdminUserSummary] = []
    for user in page.users:
        auth_data = _auth_user_to_dict(user)
        item = AdminUserSummary(auth=auth_data)
        if include_firestore or include_data:
            profile_data = _ensure_user_profile(user.uid, user.email, user.display_name)
            item.profile = _normalize_profile(user.uid, profile_data)
        if include_data:
            item.data = _get_user_full_data(user.uid)
        users.append(item)
    return AdminUserListResponse(users=users, next_page_token=page.next_page_token)


@router.get("/admin/users/{uid}", response_model=AdminUserFullResponse)
def admin_get_user(
    uid: str,
    full: bool = True,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    user_record = admin_auth.get_user(uid)
    auth_data = _auth_user_to_dict(user_record)
    profile_data = _ensure_user_profile(uid, user_record.email, user_record.display_name)
    profile = _normalize_profile(uid, profile_data)
    if not full:
        return {"auth": auth_data, "profile": profile, "data": {}}
    return {"auth": auth_data, "profile": profile, "data": _get_user_full_data(uid)}


@router.post("/admin/users/{uid}/plan")
def admin_update_user_plan(
    uid: str,
    payload: AdminPlanUpdateRequest,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    plan = _normalize_account_plan_name(payload.plan, default="")
    if plan not in _TARIFF_ACCESS_PLANS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid plan")
    tariff_id = _normalize_tariff_id(payload.tariff_id) if payload.tariff_id else None
    _set_user_plan(
        uid,
        plan=plan,
        source=f"admin:{admin.get('uid')}",
        premium_until=payload.premium_until,
        premium_status="admin" if plan == "premium" else None,
        tariff_id=tariff_id,
    )
    return {
        "uid": uid,
        "plan": plan,
        "tariff_id": tariff_id,
        "premium_until": payload.premium_until,
    }


@router.get("/admin/tariffs", response_model=TariffPlanListResponse)
def admin_get_tariffs(
    platform: Optional[str] = None,
    include_inactive: bool = True,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    tariffs = _list_tariffs(include_inactive=include_inactive, platform=platform)
    return TariffPlanListResponse(tariffs=tariffs)


@router.get("/admin/tariffs/{tariff_id}", response_model=TariffPlanResponse)
def admin_get_tariff(
    tariff_id: str,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    return _get_tariff_by_id(tariff_id)


@router.post("/admin/tariffs", response_model=TariffPlanResponse)
def admin_create_tariff(
    payload: AdminTariffCreateRequest,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    requested_id = payload.tariff_id or payload.name
    return _upsert_tariff(requested_id, payload, create_only=True)


@router.put("/admin/tariffs/{tariff_id}", response_model=TariffPlanResponse)
def admin_update_tariff(
    tariff_id: str,
    payload: AdminTariffUpdateRequest,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    return _upsert_tariff(tariff_id, payload, create_only=False)


@router.patch("/admin/tariffs/{tariff_id}", response_model=TariffPlanResponse)
def admin_patch_tariff(
    tariff_id: str,
    payload: AdminTariffPatchRequest,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    return _patch_tariff(tariff_id, payload)


@router.delete("/admin/tariffs/{tariff_id}", response_model=TariffPlanResponse)
def admin_delete_tariff(
    tariff_id: str,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    tariff = _get_tariff_by_id(tariff_id)
    db = get_firestore_client()
    db.collection("tariff_plans").document(tariff.id).delete()
    return tariff


@router.get("/admin/permissions", response_model=AllPlanPermissionsResponse)
def admin_get_plan_permissions(admin: Dict[str, Any] = Depends(require_admin_user)):
    return AllPlanPermissionsResponse(
        plans={
            "free": _get_plan_permissions("free"),
            "premium": _get_plan_permissions("premium"),
        }
    )


@router.get("/admin/permissions/{plan}", response_model=PlanPermissionsResponse)
def admin_get_plan_permissions_by_plan(
    plan: str,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    plan = _normalize_plan_name(plan)
    doc = _get_plan_permissions_doc(plan)
    return PlanPermissionsResponse(
        plan=plan, permissions=doc["permissions"], updated_at=doc["updated_at"]
    )


@router.put("/admin/permissions/{plan}", response_model=PlanPermissionsResponse)
def admin_update_plan_permissions(
    plan: str,
    payload: PlanPermissionsUpdateRequest,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    plan = _normalize_plan_name(plan)
    merge = payload.merge and not payload.replace
    result = _set_plan_permissions(plan, payload.permissions, merge=merge)
    return PlanPermissionsResponse(
        plan=plan, permissions=result["permissions"], updated_at=result["updated_at"]
    )


@router.delete("/admin/permissions/{plan}", response_model=PlanPermissionsResponse)
def admin_delete_plan_permissions(
    plan: str,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    plan = _normalize_plan_name(plan)
    db = get_firestore_client()
    doc_ref = db.collection("plan_permissions").document(plan)
    doc_ref.delete()
    return PlanPermissionsResponse(plan=plan, permissions={}, updated_at=None)


@router.get("/admin/ads/config", response_model=AllAdsConfigResponse)
def admin_get_ads_config(
    admin: Dict[str, Any] = Depends(require_admin_user),
    settings: Settings = Depends(get_settings),
):
    platforms = {}
    for platform in ("ios", "android"):
        doc = _get_ads_config_doc(platform, settings)
        platforms[platform] = AdsConfigResponse(
            platform=platform,
            config=doc["config"],
            updated_at=doc["updated_at"],
        )
    return AllAdsConfigResponse(platforms=platforms)


@router.get("/admin/ads/config/{platform}", response_model=AdsConfigResponse)
def admin_get_ads_config_by_platform(
    platform: str,
    admin: Dict[str, Any] = Depends(require_admin_user),
    settings: Settings = Depends(get_settings),
):
    platform = _normalize_ads_platform(platform)
    doc = _get_ads_config_doc(platform, settings)
    return AdsConfigResponse(platform=platform, config=doc["config"], updated_at=doc["updated_at"])


@router.put("/admin/ads/config/{platform}", response_model=AdsConfigResponse)
def admin_update_ads_config(
    platform: str,
    payload: AdsConfigUpdateRequest,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    platform = _normalize_ads_platform(platform)
    merge = payload.merge and not payload.replace
    result = _set_ads_config(platform, payload.config, merge=merge)
    return AdsConfigResponse(
        platform=platform,
        config=result["config"],
        updated_at=result["updated_at"],
    )


@router.delete("/admin/ads/config/{platform}", response_model=AdsConfigResponse)
def admin_delete_ads_config(
    platform: str,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    platform = _normalize_ads_platform(platform)
    db = get_firestore_client()
    doc_ref = db.collection("ads_config").document(platform)
    doc_ref.delete()
    return AdsConfigResponse(platform=platform, config={}, updated_at=None)


@router.post(
    "/admin/notifications/broadcast",
    response_model=AdminBroadcastNotificationResponse,
)
def admin_broadcast_notifications(
    payload: AdminBroadcastNotificationRequest,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    admin_uid = str(admin.get("uid") or "admin")
    try:
        return broadcast_notification_to_all_users(payload, admin_uid=admin_uid)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/health")
def health():
    return {"status": "ok"}
