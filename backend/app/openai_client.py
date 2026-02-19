from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

import requests

from .config import Settings


class OpenAIError(RuntimeError):
    pass


def _extract_json(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(text[start : end + 1])


def analyze_transaction_text(
    settings: Settings,
    *,
    text: str,
    type_hint: Optional[str] = None,
    categories: Optional[List[str]] = None,
    locale: Optional[str] = None,
    currency: Optional[str] = None,
) -> Dict[str, Any]:
    if not settings.openai_api_key:
        raise OpenAIError("OPENAI_API_KEY is not configured")

    category_block = ""
    if categories:
        category_block = "Available categories:\n" + "\n".join(f"- {c}" for c in categories)

    hint_block = f"Type hint: {type_hint}" if type_hint else "Type hint: unknown"
    currency_block = f"Default currency: {currency}" if currency else "Default currency: unknown"
    locale_block = f"User locale/language: {locale}" if locale else "User locale/language: unknown"

    system_prompt = (
        "You extract structured transaction details from a user's sentence. "
        "Return ONLY valid JSON, no markdown."
    )
    user_prompt = (
        f"{hint_block}\n"
        f"{currency_block}\n"
        f"{locale_block}\n"
        f"{category_block}\n\n"
        "Extract fields:\n"
        '{ "type": "income|expense", "amount": number, "currency": "CODE or null", '
        '"description": "short text", "category": "best matching category or null" }\n\n'
        f"User text: {text}"
    )

    payload = {
        "model": settings.openai_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0,
    }

    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=settings.openai_timeout_seconds,
    )
    if response.status_code >= 400:
        raise OpenAIError(f"OpenAI error {response.status_code}: {response.text}")

    data = response.json()
    content = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    if not content:
        raise OpenAIError("OpenAI returned empty response")

    parsed = _extract_json(content)
    amount = parsed.get("amount")
    try:
        amount = float(amount) if amount is not None else None
    except (TypeError, ValueError):
        amount = None
    return {
        "type": parsed.get("type"),
        "amount": amount,
        "currency": parsed.get("currency"),
        "description": parsed.get("description"),
        "category": parsed.get("category"),
        "raw": content,
    }
