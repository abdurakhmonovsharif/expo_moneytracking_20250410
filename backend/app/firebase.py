import json
from typing import Optional

import firebase_admin
from firebase_admin import auth as admin_auth
from firebase_admin import firestore
from firebase_admin import credentials

from .config import Settings


class FirebaseNotInitialized(Exception):
    pass


def _build_credentials(path_or_json: str) -> credentials.Base:
    # Accept either a file path or a raw JSON string for the service account.
    try:
        return credentials.Certificate(path_or_json)
    except Exception:
        try:
            with open(path_or_json, "r", encoding="utf-8") as fh:
                cred_dict = json.load(fh)
            return credentials.Certificate(cred_dict)
        except Exception:
            cred_dict = json.loads(path_or_json)
            return credentials.Certificate(cred_dict)


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
