from __future__ import annotations

import logging
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Optional

import requests

from .config import Settings
from .firebase import get_firestore_client


_CACHE: Dict[str, Any] = {
    "data": None,
    "fetched_at": 0.0,
}
_BASE_CURRENCY = "UZS"
_FX_DAILY_COLLECTION = "fx_rates_daily"
logger = logging.getLogger("fx")


def _parse_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    # Handle comma decimal if needed.
    if "," in text and "." not in text:
        text = text.replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None


def _parse_cbu_date(value: Any) -> Optional[date]:
    text = str(value or "").strip()
    if not text:
        return None
    parts = text.split(".")
    if len(parts) != 3:
        return None
    try:
        day, month, year = (int(parts[0]), int(parts[1]), int(parts[2]))
        return date(year, month, day)
    except Exception:
        return None


def _normalize_rates_and_deltas(raw: Any) -> Dict[str, Any]:
    rates: Dict[str, float] = {_BASE_CURRENCY: 1.0}
    delta_rates: Dict[str, float] = {_BASE_CURRENCY: 0.0}
    raw_date: Optional[str] = None
    if not isinstance(raw, list):
        return {
            "rates": rates,
            "delta_rates": delta_rates,
            "raw_date": raw_date,
            "date": None,
        }
    for item in raw:
        if not isinstance(item, dict):
            continue
        code = str(item.get("Ccy") or "").strip().upper()
        if not code:
            continue
        rate = _parse_float(item.get("Rate"))
        nominal = _parse_float(item.get("Nominal")) or 1.0
        if not rate or nominal <= 0:
            continue
        normalized_rate = rate / nominal
        rates[code] = normalized_rate

        diff = _parse_float(item.get("Diff"))
        if diff is not None:
            # CBU Diff is relative to previous day for the same nominal.
            delta_rates[code] = diff / nominal

        if raw_date is None:
            raw_date_candidate = str(item.get("Date") or "").strip()
            raw_date = raw_date_candidate or None

    parsed_date = _parse_cbu_date(raw_date)
    return {
        "rates": rates,
        "delta_rates": delta_rates,
        "raw_date": raw_date,
        "date": parsed_date,
    }


def _normalize_stored_rates(raw: Any) -> Dict[str, float]:
    if not isinstance(raw, dict):
        return {}
    rates: Dict[str, float] = {}
    for code, value in raw.items():
        parsed = _parse_float(value)
        if parsed is None:
            continue
        rates[str(code).upper()] = parsed
    if _BASE_CURRENCY not in rates:
        rates[_BASE_CURRENCY] = 1.0
    return rates


def _store_daily_rates(
    rates_date: str,
    *,
    rates: Dict[str, float],
    updated_at: str,
    source: str,
) -> None:
    try:
        db = get_firestore_client()
    except Exception as exc:
        logger.warning("FX store skipped: Firestore unavailable: %s", exc)
        return
    payload = {
        "date": rates_date,
        "base": _BASE_CURRENCY,
        "rates": rates,
        "source": source,
        "updated_at": updated_at,
    }
    try:
        db.collection(_FX_DAILY_COLLECTION).document(rates_date).set(payload, merge=True)
    except Exception as exc:
        logger.warning("FX store failed for %s: %s", rates_date, exc)


def _load_daily_rates(rates_date: str) -> Optional[Dict[str, float]]:
    try:
        db = get_firestore_client()
    except Exception as exc:
        logger.warning("FX load skipped: Firestore unavailable: %s", exc)
        return None
    try:
        snapshot = db.collection(_FX_DAILY_COLLECTION).document(rates_date).get()
    except Exception as exc:
        logger.warning("FX load failed for %s: %s", rates_date, exc)
        return None
    if not snapshot.exists:
        return None
    data = snapshot.to_dict() or {}
    rates = _normalize_stored_rates(data.get("rates"))
    return rates or None


def _derive_previous_rates(
    current_rates: Dict[str, float],
    delta_rates: Dict[str, float],
) -> Optional[Dict[str, float]]:
    previous: Dict[str, float] = {_BASE_CURRENCY: 1.0}
    for code, current in current_rates.items():
        if code == _BASE_CURRENCY:
            continue
        delta = delta_rates.get(code)
        if delta is None:
            continue
        previous[code] = current - delta
    if len(previous) <= 1:
        return None
    return previous


def _compute_delta_rates(
    current_rates: Dict[str, float],
    previous_rates: Optional[Dict[str, float]],
    fallback_delta_rates: Dict[str, float],
) -> Dict[str, float]:
    deltas: Dict[str, float] = {_BASE_CURRENCY: 0.0}
    for code, current in current_rates.items():
        if code == _BASE_CURRENCY:
            continue
        previous = previous_rates.get(code) if previous_rates else None
        if previous is not None:
            deltas[code] = current - previous
            continue
        fallback = fallback_delta_rates.get(code)
        if fallback is not None:
            deltas[code] = fallback
    return deltas


def get_cbu_rates(settings: Settings) -> Dict[str, Any]:
    now = time.time()
    cached = _CACHE.get("data")
    cached_at = _CACHE.get("fetched_at", 0.0) or 0.0
    if cached and (now - cached_at) < settings.cbu_cache_ttl_seconds:
        return cached

    response = requests.get(settings.cbu_rates_url, timeout=20)
    response.raise_for_status()
    data = response.json()
    normalized = _normalize_rates_and_deltas(data)
    rates = normalized["rates"]
    fallback_delta_rates = normalized["delta_rates"]
    cbu_day: Optional[date] = normalized["date"]

    if cbu_day:
        rates_date = cbu_day.isoformat()
        previous_date = (cbu_day - timedelta(days=1)).isoformat()
    else:
        rates_date = datetime.fromtimestamp(now, tz=timezone.utc).date().isoformat()
        previous_date = (
            datetime.fromtimestamp(now, tz=timezone.utc).date() - timedelta(days=1)
        ).isoformat()

    previous_rates = _load_daily_rates(previous_date)
    previous_was_derived = False
    if previous_rates is None:
        previous_rates = _derive_previous_rates(rates, fallback_delta_rates)
        previous_was_derived = previous_rates is not None

    updated_at = datetime.fromtimestamp(now, tz=timezone.utc).isoformat()
    _store_daily_rates(rates_date, rates=rates, updated_at=updated_at, source="CBU")
    if previous_rates and previous_was_derived:
        # Keep the previous day snapshot available for consistent 1-day comparisons.
        _store_daily_rates(
            previous_date,
            rates=previous_rates,
            updated_at=updated_at,
            source="CBU-DERIVED",
        )

    delta_rates = _compute_delta_rates(rates, previous_rates, fallback_delta_rates)

    payload = {
        "base": _BASE_CURRENCY,
        "date": rates_date,
        "rates": rates,
        "previous_date": previous_date if previous_rates else None,
        "previous_rates": previous_rates,
        "delta_rates": delta_rates,
        "source": "CBU",
        "updated_at": updated_at,
    }
    _CACHE["data"] = payload
    _CACHE["fetched_at"] = now
    return payload


def convert_amount(amount: float, from_ccy: str, to_ccy: str, rates: Dict[str, float]) -> float:
    from_code = str(from_ccy or "").upper()
    to_code = str(to_ccy or "").upper()
    if from_code == to_code or not rates:
        return amount
    from_rate = 1.0 if from_code == "UZS" else rates.get(from_code)
    to_rate = 1.0 if to_code == "UZS" else rates.get(to_code)
    if not from_rate or not to_rate:
        return amount
    return (amount * from_rate) / to_rate
