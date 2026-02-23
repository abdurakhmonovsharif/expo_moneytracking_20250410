import base64
import binascii
import json
from pathlib import Path
from typing import Any, Optional

import requests

import firebase_admin
from google.auth.exceptions import RefreshError
from google.auth.transport import requests as google_requests
from google.oauth2 import service_account
from firebase_admin import auth as admin_auth
from firebase_admin import firestore
from firebase_admin import credentials

from .config import Settings


class FirebaseNotInitialized(Exception):
    pass


def _looks_like_filesystem_path(value: str) -> bool:
    return (
        "/" in value
        or "\\" in value
        or value.startswith(".")
        or value.startswith("~")
        or value.endswith(".json")
    )


def _load_service_account_info(path_or_json: str) -> dict[str, Any]:
    # Accept either a file path or a raw JSON (or base64-encoded JSON) string.
    raw_value = (path_or_json or "").strip()
    if not raw_value:
        raise ValueError("FIREBASE_SERVICE_ACCOUNT_PATH is empty")

    path = Path(raw_value).expanduser()
    if path.exists():
        try:
            with path.open("r", encoding="utf-8") as fh:
                return json.load(fh)
        except Exception as exc:
            raise ValueError(f"Service account file is not valid JSON: {path}") from exc

    if _looks_like_filesystem_path(raw_value):
        raise ValueError(f"Service account file not found: {path}")

    try:
        return json.loads(raw_value)
    except json.JSONDecodeError:
        pass

    try:
        decoded = base64.b64decode(raw_value.encode("utf-8"), validate=True).decode("utf-8")
        return json.loads(decoded)
    except (binascii.Error, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(
            "Service account must be an existing file path, raw JSON, or base64-encoded JSON"
        ) from exc


def _normalize_service_account_info(info: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(info)
    private_key = normalized.get("private_key")
    if isinstance(private_key, str):
        pk = private_key.strip().replace("\\n", "\n")
        if not pk.endswith("\n"):
            pk = f"{pk}\n"
        normalized["private_key"] = pk
    for field in ("client_email", "project_id", "private_key_id"):
        value = normalized.get(field)
        if isinstance(value, str):
            normalized[field] = value.strip()
    return normalized


def _active_key_ids(client_email: str) -> set[str]:
    if not client_email:
        return set()
    url = f"https://www.googleapis.com/service_accounts/v1/metadata/x509/{client_email}"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code >= 400:
            return set()
        payload = response.json()
        if isinstance(payload, dict):
            return {str(key) for key in payload.keys()}
    except Exception:
        return set()
    return set()


def _assert_service_account_refreshable(info: dict[str, Any]) -> None:
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    creds = service_account.Credentials.from_service_account_info(info, scopes=scopes)
    try:
        creds.refresh(google_requests.Request())
    except RefreshError as exc:
        reason = str(exc)
        email = str(info.get("client_email") or "<missing-client-email>")
        key_id = str(info.get("private_key_id") or "<missing-private-key-id>")
        lowered = reason.lower()
        if "invalid jwt signature" in lowered or "invalid_grant" in lowered:
            active_ids = _active_key_ids(email)
            details = (
                "Firebase service account auth failed: invalid JWT signature. "
                f"client_email={email} private_key_id={key_id}. "
                "Generate a new key for this service account in Google Cloud IAM and "
                "update FIREBASE_SERVICE_ACCOUNT_PATH."
            )
            if active_ids and key_id not in active_ids:
                details = (
                    f"{details} The configured private_key_id is not active. "
                    f"Active key ids: {', '.join(sorted(active_ids))}."
                )
            raise RuntimeError(details) from exc
        raise RuntimeError(
            "Firebase service account auth failed while refreshing access token: "
            f"{reason}. client_email={email} private_key_id={key_id}"
        ) from exc


def _build_credentials(path_or_json: str) -> credentials.Base:
    info = _normalize_service_account_info(_load_service_account_info(path_or_json))
    _assert_service_account_refreshable(info)
    return credentials.Certificate(info)


def init_firebase(settings: Settings) -> None:
    if firebase_admin._apps:
        return
    cred = _build_credentials(settings.firebase_service_account_path)
    firebase_admin.initialize_app(cred, {
        "projectId": settings.firebase_project_id,
    })


def get_or_create_user(uid: str, email: Optional[str], display_name: Optional[str], photo_url: Optional[str]):
    try:
        return admin_auth.get_user(uid)
    except admin_auth.UserNotFoundError:
        pass

    try:
        return admin_auth.create_user(
            uid=uid,
            email=email,
            display_name=display_name,
            photo_url=photo_url,
            email_verified=bool(email),
        )
    except admin_auth.EmailAlreadyExistsError:
        if not email:
            raise
        existing = admin_auth.get_user_by_email(email)
        updates = {}
        if display_name and not existing.display_name:
            updates["display_name"] = display_name
        if photo_url and not existing.photo_url:
            updates["photo_url"] = photo_url
        if not existing.email_verified:
            updates["email_verified"] = True
        if updates:
            admin_auth.update_user(existing.uid, **updates)
            return admin_auth.get_user(existing.uid)
        return existing
    except admin_auth.UidAlreadyExistsError:
        return admin_auth.get_user(uid)


def create_custom_token(uid: str, claims: Optional[dict] = None) -> str:
    if not firebase_admin._apps:
        raise FirebaseNotInitialized("Firebase not initialized")
    token_bytes = admin_auth.create_custom_token(uid, claims)
    return token_bytes.decode("utf-8")


def get_firestore_client():
    if not firebase_admin._apps:
        raise FirebaseNotInitialized("Firebase not initialized")
    return firestore.client()
