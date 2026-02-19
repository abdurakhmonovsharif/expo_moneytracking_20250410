#!/usr/bin/env python3
import argparse
from datetime import datetime, timezone
from typing import Any, Dict

from app.config import get_settings
from app.firebase import init_firebase, get_firestore_client


def normalize_permissions(raw: Dict[str, Any]) -> Dict[str, Any]:
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


def seed_permissions(merge: bool, replace: bool) -> None:
    settings = get_settings()
    init_firebase(settings)
    db = get_firestore_client()
    now_iso = datetime.now(timezone.utc).isoformat()

    plan_defaults = {
        "free": normalize_permissions(settings.default_permissions_free_dict),
        "premium": normalize_permissions(settings.default_permissions_premium_dict),
    }

    for plan, defaults in plan_defaults.items():
        if not defaults:
            print(f"[skip] {plan}: defaults empty")
            continue

        doc_ref = db.collection("plan_permissions").document(plan)
        if replace:
            doc_ref.set({"permissions": defaults, "updated_at": now_iso})
            print(f"[replace] {plan}: {defaults}")
            continue

        snapshot = doc_ref.get()
        if merge:
            existing = snapshot.to_dict() if snapshot.exists else {}
            existing_perms = existing.get("permissions") or {}
            if not isinstance(existing_perms, dict):
                existing_perms = {}
            merged = {**normalize_permissions(existing_perms), **defaults}
            doc_ref.set({"permissions": merged, "updated_at": now_iso}, merge=True)
            print(f"[merge] {plan}: {merged}")
            continue

        if not snapshot.exists:
            doc_ref.set({"permissions": defaults, "updated_at": now_iso})
            print(f"[create] {plan}: {defaults}")
        else:
            print(f"[skip] {plan}: doc exists (use --merge or --replace)")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed plan permissions in Firestore from DEFAULT_PERMISSIONS_* env values."
    )
    parser.add_argument(
        "--merge",
        action="store_true",
        help="Merge defaults into existing permissions (updates overlapping keys).",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Replace existing permissions with defaults (overwrites entire permissions map).",
    )
    args = parser.parse_args()

    if args.merge and args.replace:
        raise SystemExit("Use only one of --merge or --replace.")

    seed_permissions(merge=args.merge, replace=args.replace)


if __name__ == "__main__":
    main()
