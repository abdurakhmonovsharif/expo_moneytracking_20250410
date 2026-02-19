from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from firebase_admin import auth as admin_auth
from firebase_admin import firestore as admin_firestore
from firebase_admin import messaging as admin_messaging
from pydantic import BaseModel, Field
import requests

from .firebase import get_firestore_client

DEFAULT_LANGUAGE = "en"
SUPPORTED_LANGUAGES = (
    "en",
    "es",
    "zh",
    "hi",
    "ar",
    "fr",
    "pt",
    "ru",
    "ja",
    "de",
    "uz",
)

NOTIFICATION_TYPE_ADMIN_BROADCAST = "admin_broadcast"
NOTIFICATION_TYPE_OVERSPENDING = "overspending_warning"
PUSH_PROVIDER_FCM = "fcm"
PUSH_PROVIDER_EXPO = "expo"
EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send"

logger = logging.getLogger("notifications")

OVERSPENDING_TITLE_MAP: Dict[str, str] = {
    "en": "Spending alert",
    "es": "Alerta de gastos",
    "zh": "支出提醒",
    "hi": "खर्च चेतावनी",
    "ar": "تنبيه الإنفاق",
    "fr": "Alerte de dépenses",
    "pt": "Alerta de gastos",
    "ru": "Предупреждение о расходах",
    "ja": "支出アラート",
    "de": "Ausgabenwarnung",
    "uz": "Xarajat ogohlantirishi",
}

OVERSPENDING_BODY_MAP: Dict[str, str] = {
    "en": (
        "You are spending faster than planned. "
        "If this continues, your balance may not last until the end of the month."
    ),
    "es": (
        "Estás gastando más rápido de lo planeado. "
        "Si esto continúa, tu saldo podría no alcanzar hasta fin de mes."
    ),
    "zh": "你当前的花费速度快于计划。若继续这样，余额可能撑不到月底。",
    "hi": "आप योजना से तेज़ खर्च कर रहे हैं। ऐसा जारी रहा तो महीने के अंत तक बैलेंस नहीं बचेगा।",
    "ar": "أنت تنفق أسرع من المخطط. إذا استمر ذلك، فقد لا يكفي رصيدك حتى نهاية الشهر.",
    "fr": (
        "Vous dépensez plus vite que prévu. "
        "Si cela continue, votre solde pourrait ne pas tenir jusqu'à la fin du mois."
    ),
    "pt": (
        "Você está gastando mais rápido do que o planejado. "
        "Se isso continuar, seu saldo pode não durar até o fim do mês."
    ),
    "ru": (
        "Вы тратите быстрее, чем планировали. "
        "Если так продолжится, средств может не хватить до конца месяца."
    ),
    "ja": "予定より早いペースで支出しています。このまま続くと月末まで残高が持たない可能性があります。",
    "de": (
        "Sie geben schneller aus als geplant. "
        "Wenn das so weitergeht, reicht Ihr Guthaben möglicherweise nicht bis Monatsende."
    ),
    "uz": (
        "Siz rejalashtirilganidan tezroq sarflayapsiz. "
        "Agar bu davom etsa, balansingiz oy oxirigacha yetmasligi mumkin."
    ),
}


class NotificationItemResponse(BaseModel):
    id: str
    type: str
    title: str
    body: str
    title_map: Dict[str, str] = Field(default_factory=dict)
    body_map: Dict[str, str] = Field(default_factory=dict)
    data: Dict[str, Any] = Field(default_factory=dict)
    created_at: str
    read_at: Optional[str] = None
    is_read: bool = False


class NotificationListResponse(BaseModel):
    items: List[NotificationItemResponse] = Field(default_factory=list)
    unread_count: int = 0


class NotificationUnreadCountResponse(BaseModel):
    unread_count: int


class NotificationMarkReadResponse(BaseModel):
    id: str
    read_at: Optional[str] = None
    is_read: bool = False


class NotificationMarkAllReadResponse(BaseModel):
    updated_count: int = 0


class AdminBroadcastNotificationRequest(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    title_map: Dict[str, str] = Field(default_factory=dict)
    body_map: Dict[str, str] = Field(default_factory=dict)
    data: Dict[str, Any] = Field(default_factory=dict)
    dedupe_key: Optional[str] = None
    send_push: bool = True


class AdminBroadcastNotificationResponse(BaseModel):
    delivered_users: int = 0
    created_count: int = 0
    deduped_count: int = 0
    push_attempted: int = 0
    push_sent: int = 0
    push_failed: int = 0


class PushTokenRegisterRequest(BaseModel):
    token: str
    provider: str = PUSH_PROVIDER_FCM
    platform: Optional[str] = None
    app_version: Optional[str] = None
    locale: Optional[str] = None


class PushTokenRegisterResponse(BaseModel):
    token_id: str
    provider: str
    platform: Optional[str] = None
    active: bool = True


class PushTokenUnregisterRequest(BaseModel):
    token: str
    provider: Optional[str] = None


class PushTokenUnregisterResponse(BaseModel):
    token_id: str
    removed: bool = False


class OverspendingNotificationRequest(BaseModel):
    period_key: Optional[str] = None
    actual_spent: float
    expected_spent: float
    currency: Optional[str] = None
    language: Optional[str] = None


class OverspendingNotificationResponse(BaseModel):
    triggered: bool = False
    notification_id: Optional[str] = None
    reason: Optional[str] = None
    push_attempted: int = 0
    push_sent: int = 0
    push_failed: int = 0


def normalize_language(language: Optional[str]) -> str:
    code = str(language or "").strip().lower()
    if code in SUPPORTED_LANGUAGES:
        return code
    return DEFAULT_LANGUAGE


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _user_notifications_collection(uid: str):
    db = get_firestore_client()
    return db.collection("users").document(uid).collection("notifications")


def _push_tokens_collection():
    db = get_firestore_client()
    return db.collection("push_tokens")


def _push_token_id(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _normalize_push_provider(provider: Optional[str]) -> str:
    raw = str(provider or "").strip().lower()
    if raw in {PUSH_PROVIDER_FCM, PUSH_PROVIDER_EXPO}:
        return raw
    raise ValueError(f"Unsupported push provider: {raw or '<empty>'}")


def _get_user_language(uid: str, fallback: Optional[str] = None) -> str:
    fallback_code = normalize_language(fallback)
    try:
        db = get_firestore_client()
        snapshot = db.collection("users").document(uid).get()
        if snapshot.exists:
            data = snapshot.to_dict() or {}
            return normalize_language(data.get("language") or fallback_code)
    except Exception:
        return fallback_code
    return fallback_code


def _normalize_localized_map(
    raw: Optional[Dict[str, Any]],
    *,
    fallback_text: Optional[str] = None,
) -> Dict[str, str]:
    normalized: Dict[str, str] = {}
    if isinstance(raw, dict):
        for key, value in raw.items():
            lang = normalize_language(str(key).lower())
            text = str(value or "").strip()
            if text:
                normalized[lang] = text
    if not normalized and fallback_text:
        text = str(fallback_text).strip()
        if text:
            normalized[DEFAULT_LANGUAGE] = text
    return normalized


def _resolve_localized_text(text_map: Dict[str, str], language: str, fallback: str = "") -> str:
    if not text_map:
        return fallback
    return (
        text_map.get(language)
        or text_map.get(DEFAULT_LANGUAGE)
        or next(iter(text_map.values()), fallback)
    )


def _set_push_token_state(token_id: str, patch: Dict[str, Any]) -> None:
    if not patch:
        return
    patch = {**patch, "updated_at": _now_iso()}
    _push_tokens_collection().document(token_id).set(patch, merge=True)


def _stringify_push_data(data: Optional[Dict[str, Any]]) -> Dict[str, str]:
    result: Dict[str, str] = {}
    if not isinstance(data, dict):
        return result
    for key, value in data.items():
        if value is None:
            continue
        text_key = str(key)
        if isinstance(value, str):
            result[text_key] = value
        elif isinstance(value, (int, float, bool)):
            result[text_key] = str(value)
        else:
            result[text_key] = str(value)
    return result


def register_push_token(uid: str, payload: PushTokenRegisterRequest) -> PushTokenRegisterResponse:
    token = str(payload.token or "").strip()
    if not token:
        raise ValueError("token is required")
    provider = _normalize_push_provider(payload.provider)

    token_id = _push_token_id(token)
    doc_ref = _push_tokens_collection().document(token_id)
    snapshot = doc_ref.get()
    existing = snapshot.to_dict() if snapshot.exists else {}
    now_iso = _now_iso()
    doc_ref.set(
        {
            "id": token_id,
            "uid": uid,
            "token": token,
            "provider": provider,
            "platform": payload.platform,
            "app_version": payload.app_version,
            "locale": normalize_language(payload.locale),
            "active": True,
            "created_at": existing.get("created_at") or now_iso,
            "updated_at": now_iso,
            "last_error": None,
            "last_error_at": None,
            "last_sent_at": existing.get("last_sent_at"),
        },
        merge=True,
    )
    return PushTokenRegisterResponse(
        token_id=token_id,
        provider=provider,
        platform=payload.platform,
        active=True,
    )


def unregister_push_token(uid: str, payload: PushTokenUnregisterRequest) -> PushTokenUnregisterResponse:
    token = str(payload.token or "").strip()
    if not token:
        raise ValueError("token is required")
    expected_provider = (
        _normalize_push_provider(payload.provider) if payload.provider else None
    )
    token_id = _push_token_id(token)
    doc_ref = _push_tokens_collection().document(token_id)
    snapshot = doc_ref.get()
    if not snapshot.exists:
        return PushTokenUnregisterResponse(token_id=token_id, removed=False)
    data = snapshot.to_dict() or {}
    if str(data.get("uid") or "") != uid:
        return PushTokenUnregisterResponse(token_id=token_id, removed=False)
    provider = str(data.get("provider") or "").strip().lower()
    if expected_provider and provider and provider != expected_provider:
        return PushTokenUnregisterResponse(token_id=token_id, removed=False)
    _set_push_token_state(
        token_id,
        {
            "active": False,
        },
    )
    return PushTokenUnregisterResponse(token_id=token_id, removed=True)


def _list_active_push_tokens(uid: str) -> List[Dict[str, Any]]:
    snapshots = (
        _push_tokens_collection()
        .where("uid", "==", uid)
        .where("active", "==", True)
        .stream()
    )
    tokens: List[Dict[str, Any]] = []
    for snapshot in snapshots:
        raw = snapshot.to_dict() or {}
        token = str(raw.get("token") or "").strip()
        provider = str(raw.get("provider") or "").strip().lower()
        if not token or provider not in {PUSH_PROVIDER_FCM, PUSH_PROVIDER_EXPO}:
            continue
        raw["id"] = raw.get("id") or snapshot.id
        raw["token"] = token
        raw["provider"] = provider
        tokens.append(raw)
    return tokens


def _send_fcm_push(
    tokens: List[Dict[str, Any]],
    *,
    title: str,
    body: str,
    data: Dict[str, str],
) -> Dict[str, int]:
    if not tokens:
        return {"attempted": 0, "sent": 0, "failed": 0}
    fcm_tokens = [str(item["token"]) for item in tokens if item.get("token")]
    if not fcm_tokens:
        return {"attempted": 0, "sent": 0, "failed": 0}

    result = {"attempted": len(fcm_tokens), "sent": 0, "failed": 0}
    try:
        multicast = admin_messaging.MulticastMessage(
            tokens=fcm_tokens,
            notification=admin_messaging.Notification(title=title, body=body),
            data=data,
            android=admin_messaging.AndroidConfig(priority="high"),
            apns=admin_messaging.APNSConfig(
                headers={"apns-priority": "10"},
                payload=admin_messaging.APNSPayload(
                    aps=admin_messaging.Aps(sound="default")
                ),
            ),
        )
        response = admin_messaging.send_each_for_multicast(multicast)
        for index, send_response in enumerate(response.responses):
            token_meta = tokens[index] if index < len(tokens) else {}
            token_id = str(token_meta.get("id") or "")
            if send_response.success:
                result["sent"] += 1
                if token_id:
                    _set_push_token_state(
                        token_id,
                        {"last_sent_at": _now_iso(), "last_error": None, "last_error_at": None},
                    )
                continue

            result["failed"] += 1
            exc = send_response.exception
            error_text = str(exc) if exc else "unknown_fcm_error"
            if token_id:
                _set_push_token_state(
                    token_id,
                    {"last_error": error_text, "last_error_at": _now_iso()},
                )
            if token_id and isinstance(
                exc,
                (
                    admin_messaging.UnregisteredError,
                    admin_messaging.SenderIdMismatchError,
                ),
            ):
                _set_push_token_state(token_id, {"active": False})
    except Exception as exc:
        logger.exception("FCM push send failed: %s", exc)
        result["failed"] = result["attempted"]
    return result


def _send_expo_push(
    tokens: List[Dict[str, Any]],
    *,
    title: str,
    body: str,
    data: Dict[str, Any],
) -> Dict[str, int]:
    if not tokens:
        return {"attempted": 0, "sent": 0, "failed": 0}
    messages: List[Dict[str, Any]] = []
    valid_tokens: List[Dict[str, Any]] = []
    for token_meta in tokens:
        token = str(token_meta.get("token") or "").strip()
        if not token:
            continue
        messages.append(
            {
                "to": token,
                "title": title,
                "body": body,
                "data": data,
                "sound": "default",
                "priority": "high",
                "channelId": "default",
            }
        )
        valid_tokens.append(token_meta)
    if not messages:
        return {"attempted": 0, "sent": 0, "failed": 0}

    result = {"attempted": len(messages), "sent": 0, "failed": 0}
    for start in range(0, len(messages), 100):
        message_chunk = messages[start : start + 100]
        token_chunk = valid_tokens[start : start + 100]
        try:
            response = requests.post(
                EXPO_PUSH_API_URL,
                json=message_chunk,
                headers={
                    "Accept": "application/json",
                    "Accept-encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
            response.raise_for_status()
            payload = response.json() if response.content else {}
            entries = payload.get("data") if isinstance(payload, dict) else None
            if not isinstance(entries, list):
                entries = [{} for _ in message_chunk]
        except Exception as exc:
            logger.exception("Expo push send failed: %s", exc)
            result["failed"] += len(message_chunk)
            for token_meta in token_chunk:
                token_id = str(token_meta.get("id") or "")
                if token_id:
                    _set_push_token_state(
                        token_id,
                        {"last_error": str(exc), "last_error_at": _now_iso()},
                    )
            continue

        for idx in range(len(token_chunk)):
            entry = entries[idx] if idx < len(entries) else {}
            token_meta = token_chunk[idx]
            token_id = str(token_meta.get("id") or "")
            status = str((entry or {}).get("status") or "").strip().lower()
            if status == "ok":
                result["sent"] += 1
                if token_id:
                    _set_push_token_state(
                        token_id,
                        {"last_sent_at": _now_iso(), "last_error": None, "last_error_at": None},
                    )
                continue

            result["failed"] += 1
            details = (entry or {}).get("details") if isinstance(entry, dict) else {}
            error_code = (
                str(details.get("error") or "")
                if isinstance(details, dict)
                else str((entry or {}).get("message") or "unknown_expo_error")
            )
            if token_id:
                _set_push_token_state(
                    token_id,
                    {"last_error": error_code, "last_error_at": _now_iso()},
                )
            if token_id and error_code == "DeviceNotRegistered":
                _set_push_token_state(token_id, {"active": False})
    return result


def send_push_notification_to_user(
    uid: str,
    *,
    title_map: Dict[str, str],
    body_map: Dict[str, str],
    data: Optional[Dict[str, Any]] = None,
    language: Optional[str] = None,
) -> Dict[str, int]:
    tokens = _list_active_push_tokens(uid)
    if not tokens:
        return {"attempted": 0, "sent": 0, "failed": 0}

    resolved_language = _get_user_language(uid, language)
    title = _resolve_localized_text(title_map, resolved_language)
    body = _resolve_localized_text(body_map, resolved_language)
    if not title and not body:
        return {"attempted": 0, "sent": 0, "failed": 0}

    fcm_tokens = [item for item in tokens if item.get("provider") == PUSH_PROVIDER_FCM]
    expo_tokens = [item for item in tokens if item.get("provider") == PUSH_PROVIDER_EXPO]

    payload_data = data or {}
    fcm_result = _send_fcm_push(
        fcm_tokens,
        title=title,
        body=body,
        data=_stringify_push_data(payload_data),
    )
    expo_result = _send_expo_push(
        expo_tokens,
        title=title,
        body=body,
        data=payload_data,
    )
    return {
        "attempted": fcm_result["attempted"] + expo_result["attempted"],
        "sent": fcm_result["sent"] + expo_result["sent"],
        "failed": fcm_result["failed"] + expo_result["failed"],
    }


def create_user_notification(
    uid: str,
    *,
    notification_type: str,
    title_map: Dict[str, str],
    body_map: Dict[str, str],
    data: Optional[Dict[str, Any]] = None,
    dedupe_key: Optional[str] = None,
    skip_if_exists: bool = False,
    created_by: Optional[str] = None,
    send_push: bool = True,
    language: Optional[str] = None,
) -> Dict[str, Any]:
    collection_ref = _user_notifications_collection(uid)

    if dedupe_key and skip_if_exists:
        existing = collection_ref.where("dedupe_key", "==", dedupe_key).limit(1).get()
        if existing:
            return {"created": False, "notification_id": existing[0].id}

    doc_ref = collection_ref.document()
    base_data = data or {}
    payload = {
        "id": doc_ref.id,
        "type": notification_type,
        "title_map": title_map,
        "body_map": body_map,
        "data": base_data,
        "created_at": _now_iso(),
        "read_at": None,
        "dedupe_key": dedupe_key,
        "created_by": created_by,
    }
    doc_ref.set(payload)
    push_result = {"attempted": 0, "sent": 0, "failed": 0}
    if send_push:
        push_result = send_push_notification_to_user(
            uid,
            title_map=title_map,
            body_map=body_map,
            data={
                **base_data,
                "notification_id": doc_ref.id,
                "notification_type": notification_type,
            },
            language=language,
        )
    return {
        "created": True,
        "notification_id": doc_ref.id,
        "push_attempted": push_result["attempted"],
        "push_sent": push_result["sent"],
        "push_failed": push_result["failed"],
    }


def _to_notification_item(raw: Dict[str, Any], language: str) -> NotificationItemResponse:
    title_map = _normalize_localized_map(raw.get("title_map"), fallback_text=raw.get("title"))
    body_map = _normalize_localized_map(raw.get("body_map"), fallback_text=raw.get("body"))
    read_at = raw.get("read_at")
    return NotificationItemResponse(
        id=str(raw.get("id") or ""),
        type=str(raw.get("type") or ""),
        title=_resolve_localized_text(title_map, language),
        body=_resolve_localized_text(body_map, language),
        title_map=title_map,
        body_map=body_map,
        data=raw.get("data") or {},
        created_at=str(raw.get("created_at") or _now_iso()),
        read_at=str(read_at) if read_at else None,
        is_read=bool(read_at),
    )


def get_unread_notification_count(uid: str) -> int:
    collection_ref = _user_notifications_collection(uid)
    unread = collection_ref.where("read_at", "==", None).stream()
    return sum(1 for _ in unread)


def list_user_notifications(
    uid: str,
    *,
    limit: int = 20,
    unread_only: bool = False,
    language: Optional[str] = None,
) -> NotificationListResponse:
    capped_limit = max(1, min(limit, 100))
    scan_limit = min(max(capped_limit * 4, capped_limit), 300)
    resolved_language = _get_user_language(uid, language)

    collection_ref = _user_notifications_collection(uid)
    snapshots = (
        collection_ref.order_by("created_at", direction=admin_firestore.Query.DESCENDING)
        .limit(scan_limit)
        .stream()
    )

    items: List[NotificationItemResponse] = []
    for snapshot in snapshots:
        raw = snapshot.to_dict() or {}
        raw["id"] = raw.get("id") or snapshot.id
        item = _to_notification_item(raw, resolved_language)
        if unread_only and item.is_read:
            continue
        items.append(item)
        if len(items) >= capped_limit:
            break

    unread_count = get_unread_notification_count(uid)
    return NotificationListResponse(items=items, unread_count=unread_count)


def mark_notification_read(uid: str, notification_id: str) -> NotificationMarkReadResponse:
    doc_ref = _user_notifications_collection(uid).document(notification_id)
    snapshot = doc_ref.get()
    if not snapshot.exists:
        return NotificationMarkReadResponse(id=notification_id, read_at=None, is_read=False)
    data = snapshot.to_dict() or {}
    if data.get("read_at"):
        return NotificationMarkReadResponse(
            id=notification_id,
            read_at=str(data.get("read_at")),
            is_read=True,
        )
    read_at = _now_iso()
    doc_ref.set({"read_at": read_at}, merge=True)
    return NotificationMarkReadResponse(id=notification_id, read_at=read_at, is_read=True)


def mark_all_notifications_read(uid: str) -> NotificationMarkAllReadResponse:
    collection_ref = _user_notifications_collection(uid)
    unread = list(collection_ref.where("read_at", "==", None).stream())
    if not unread:
        return NotificationMarkAllReadResponse(updated_count=0)

    db = get_firestore_client()
    batch = db.batch()
    now_iso = _now_iso()
    updated = 0
    pending_writes = 0
    for snapshot in unread:
        batch.set(snapshot.reference, {"read_at": now_iso}, merge=True)
        updated += 1
        pending_writes += 1
        if pending_writes >= 400:
            batch.commit()
            batch = db.batch()
            pending_writes = 0
    if pending_writes > 0:
        batch.commit()
    return NotificationMarkAllReadResponse(updated_count=updated)


def _resolve_broadcast_maps(
    payload: AdminBroadcastNotificationRequest,
) -> Dict[str, Dict[str, str]]:
    title_map = _normalize_localized_map(payload.title_map, fallback_text=payload.title)
    body_map = _normalize_localized_map(payload.body_map, fallback_text=payload.body)
    return {"title_map": title_map, "body_map": body_map}


def broadcast_notification_to_all_users(
    payload: AdminBroadcastNotificationRequest,
    *,
    admin_uid: str,
) -> AdminBroadcastNotificationResponse:
    maps = _resolve_broadcast_maps(payload)
    title_map = maps["title_map"]
    body_map = maps["body_map"]
    if not title_map or not body_map:
        raise ValueError("Either title/body or localized title_map/body_map is required")

    db = get_firestore_client()
    page_token: Optional[str] = None
    delivered_users = 0
    created_count = 0
    deduped_count = 0
    push_attempted = 0
    push_sent = 0
    push_failed = 0
    now_iso = _now_iso()

    while True:
        page = admin_auth.list_users(page_token=page_token, max_results=1000)
        batch = db.batch()
        pending_writes = 0
        push_queue: List[Dict[str, str]] = []

        def flush_push_queue() -> None:
            nonlocal push_attempted, push_sent, push_failed
            if not payload.send_push or not push_queue:
                return
            while push_queue:
                item = push_queue.pop()
                push_result = send_push_notification_to_user(
                    item["uid"],
                    title_map=title_map,
                    body_map=body_map,
                    data={
                        **(payload.data or {}),
                        "notification_id": item["notification_id"],
                        "notification_type": NOTIFICATION_TYPE_ADMIN_BROADCAST,
                    },
                )
                push_attempted += push_result["attempted"]
                push_sent += push_result["sent"]
                push_failed += push_result["failed"]

        for user in page.users:
            uid = user.uid
            delivered_users += 1
            collection_ref = db.collection("users").document(uid).collection("notifications")

            if payload.dedupe_key:
                existing = (
                    collection_ref.where("dedupe_key", "==", payload.dedupe_key)
                    .limit(1)
                    .get()
                )
                if existing:
                    deduped_count += 1
                    continue

            doc_ref = collection_ref.document()
            doc_payload = {
                "id": doc_ref.id,
                "type": NOTIFICATION_TYPE_ADMIN_BROADCAST,
                "title_map": title_map,
                "body_map": body_map,
                "data": payload.data or {},
                "created_at": now_iso,
                "read_at": None,
                "dedupe_key": payload.dedupe_key,
                "created_by": admin_uid,
            }
            batch.set(doc_ref, doc_payload)
            pending_writes += 1
            created_count += 1
            if payload.send_push:
                push_queue.append({"uid": uid, "notification_id": doc_ref.id})

            if pending_writes >= 400:
                batch.commit()
                flush_push_queue()
                batch = db.batch()
                pending_writes = 0

        if pending_writes > 0:
            batch.commit()
        flush_push_queue()

        if not page.next_page_token:
            break
        page_token = page.next_page_token

    return AdminBroadcastNotificationResponse(
        delivered_users=delivered_users,
        created_count=created_count,
        deduped_count=deduped_count,
        push_attempted=push_attempted,
        push_sent=push_sent,
        push_failed=push_failed,
    )


def create_overspending_notification(
    uid: str,
    payload: OverspendingNotificationRequest,
) -> OverspendingNotificationResponse:
    if payload.expected_spent <= 0:
        return OverspendingNotificationResponse(triggered=False, reason="expected_spent_must_be_positive")
    if payload.actual_spent <= payload.expected_spent:
        return OverspendingNotificationResponse(triggered=False, reason="below_threshold")

    period_key = str(payload.period_key or datetime.now(timezone.utc).date().isoformat())
    dedupe_key = f"{NOTIFICATION_TYPE_OVERSPENDING}:{period_key}"
    result = create_user_notification(
        uid,
        notification_type=NOTIFICATION_TYPE_OVERSPENDING,
        title_map=OVERSPENDING_TITLE_MAP,
        body_map=OVERSPENDING_BODY_MAP,
        data={
            "period_key": period_key,
            "actual_spent": payload.actual_spent,
            "expected_spent": payload.expected_spent,
            "currency": payload.currency,
            "language": normalize_language(payload.language),
        },
        dedupe_key=dedupe_key,
        skip_if_exists=True,
        created_by="system:overspending",
        language=payload.language,
    )
    if not result.get("created"):
        return OverspendingNotificationResponse(
            triggered=False,
            notification_id=result.get("notification_id"),
            reason="deduped",
        )
    return OverspendingNotificationResponse(
        triggered=True,
        notification_id=result.get("notification_id"),
        push_attempted=int(result.get("push_attempted") or 0),
        push_sent=int(result.get("push_sent") or 0),
        push_failed=int(result.get("push_failed") or 0),
    )
