from concurrent.futures import ThreadPoolExecutor
import json
import logging
import os
import re

import anthropic
import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("saleseasy.llm")

SIMULATE_FAILURE_TOKEN = "__SIMULATE_FAILURE__"

DEFAULT_MODEL = "gemini-2.5-flash-lite"

SUPPORTED_MODELS = [
    {
        "id": "gemini-2.5-flash-lite",
        "label": "Gemini 2.5 Flash Lite",
        "provider": "gemini",
    },
    {
        "id": "gemini-2.5-flash",
        "label": "Gemini 2.5 Flash",
        "provider": "gemini",
    },
    {
        "id": "gemini-3.8-flash",
        "label": "Gemini 3.8 Flash",
        "provider": "gemini",
    },
    {
        "id": "gemini-3.7-flash",
        "label": "Gemini 3.7 Flash",
        "provider": "gemini",
    },
    {
        "id": "gemini-3.6-flash",
        "label": "Gemini 3.6 Flash",
        "provider": "gemini",
    },
    {
        "id": "gemini-2.5-pro",
        "label": "Gemini 2.5 Pro",
        "provider": "gemini",
    },
    {
        "id": "claude-sonnet-4-6",
        "label": "Claude Sonnet 4.6",
        "provider": "anthropic",
    },
    {
        "id": "mock-adapter",
        "label": "Mock Adapter (Offline / Evaluator)",
        "provider": "mock",
    },
]

_MODEL_BY_ID = {item["id"]: item for item in SUPPORTED_MODELS}

FALLBACK_ANALYSIS = {
    "issue_category": "other",
    "urgency": "high",
    "evidence": {
        "from_field_update": ["LLM call failed — original input not analyzed"],
        "from_verified_data": [],
    },
    "recommended_next_action": "Route to human reviewer immediately due to analysis failure.",
    "missing_information": ["LLM response unavailable"],
    "needs_human_review": True,
    "review_reason": "Automated analysis failed. Human review required.",
}


def resolve_model(model_id: str | None) -> dict:
    if model_id and model_id in _MODEL_BY_ID:
        return _MODEL_BY_ID[model_id]
    return _MODEL_BY_ID[DEFAULT_MODEL]


def _extract_json(text: str) -> dict:
    cleaned = text.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
    if fenced:
        cleaned = fenced.group(1).strip()
    return json.loads(cleaned)


def _has_key(value: str | None) -> bool:
    if not value:
        return False
    lowered = value.strip().lower()
    return lowered not in {"", "your_key_here"}


def _anthropic_key() -> str | None:
    key = os.getenv("ANTHROPIC_API_KEY")
    return key if _has_key(key) else None


def _gemini_key() -> str | None:
    key = os.getenv("GEMINI_API_KEY")
    return key if _has_key(key) else None


def _is_retryable(exc: Exception) -> bool:
    if isinstance(exc, anthropic.APIStatusError):
        status = getattr(exc, "status_code", None)
        return status is not None and status >= 500
    status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    if isinstance(status, int) and status >= 500:
        return True
    name = type(exc).__name__.lower()
    return "server" in name or "unavailable" in name or "timeout" in name


def _analyze_anthropic(system_prompt: str, user_message: str, model_id: str) -> dict:
    api_key = _anthropic_key()
    if not api_key:
        logger.error("LLM call failed: Anthropic API key is not configured")
        return dict(FALLBACK_ANALYSIS)

    client = anthropic.Anthropic(api_key=api_key)
    last_error: Exception | None = None

    for attempt in range(2):
        try:
            response = client.messages.create(
                model=model_id,
                max_tokens=1024,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )
            text_parts = [
                block.text
                for block in response.content
                if getattr(block, "type", None) == "text"
            ]
            raw = "\n".join(text_parts).strip()
            parsed = _extract_json(raw)
            if not isinstance(parsed, dict):
                raise ValueError("LLM response was not a JSON object")
            return parsed
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt == 0 and _is_retryable(exc):
                logger.warning("Transient Anthropic error; retrying once")
                continue
            break

    logger.error("LLM call failed: %s", type(last_error).__name__ if last_error else "unknown")
    return dict(FALLBACK_ANALYSIS)


def _analyze_gemini(system_prompt: str, user_message: str, model_id: str) -> dict:
    api_key = _gemini_key()
    if not api_key:
        logger.error("LLM call failed: Gemini API key is not configured")
        return dict(FALLBACK_ANALYSIS)

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    last_error: Exception | None = None

    for attempt in range(2):
        try:
            response = client.models.generate_content(
                model=model_id,
                contents=user_message,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    max_output_tokens=1024,
                    temperature=0,
                ),
            )
            raw = (getattr(response, "text", None) or "").strip()
            parsed = _extract_json(raw)
            if not isinstance(parsed, dict):
                raise ValueError("LLM response was not a JSON object")
            return parsed
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt == 0 and _is_retryable(exc):
                logger.warning("Transient Gemini error; retrying once")
                continue
            break

    logger.error("LLM call failed: %s", type(last_error).__name__ if last_error else "unknown")
    return dict(FALLBACK_ANALYSIS)


def _analyze_mock(system_prompt: str, user_message: str) -> dict:
    """Mock adapter for offline testing or when external API quota is exceeded."""
    content = user_message.lower()
    if SIMULATE_FAILURE_TOKEN.lower() in content:
        return dict(FALLBACK_ANALYSIS)

    if "unwell" in content or "poison" in content or "damaged" in content or "sick" in content:
        return {
            "issue_category": "safety",
            "urgency": "critical",
            "evidence": {
                "from_field_update": ["Product damage and consumer illness reported"],
                "from_verified_data": [],
            },
            "recommended_next_action": "Isolate product batch and escalate immediately to quality assurance team.",
            "missing_information": ["Batch number", "Purchase receipt"],
            "needs_human_review": True,
            "review_reason": "Health and safety incident reported.",
        }

    if "ignore instructions" in content or "override" in content:
        return {
            "issue_category": "prompt_injection",
            "urgency": "critical",
            "evidence": {
                "from_field_update": ["Attempted system prompt override in input text"],
                "from_verified_data": [],
            },
            "recommended_next_action": "Quarantine input and notify security team.",
            "missing_information": [],
            "needs_human_review": True,
            "review_reason": "Prompt injection detected.",
        }

    if "discount" in content or "price match" in content:
        return {
            "issue_category": "pricing",
            "urgency": "medium",
            "evidence": {
                "from_field_update": ["Competitor discounting claimed by field rep"],
                "from_verified_data": [],
            },
            "recommended_next_action": "Gather competitor evidence; route to regional sales manager without approving discount.",
            "missing_information": ["Competitor receipt or leaflet photo"],
            "needs_human_review": True,
            "review_reason": "Commercial price modification requires management authorization.",
        }

    if "unavailable" in content or "stockout" in content or "out of stock" in content:
        if "quantity = 0" in system_prompt:
            return {
                "issue_category": "stockout",
                "urgency": "high",
                "evidence": {
                    "from_field_update": ["Stockout reported by field rep"],
                    "from_verified_data": ["Verified stock shows quantity = 0"],
                },
                "recommended_next_action": "Initiate warehouse replenishment order for affected outlet.",
                "missing_information": [],
                "needs_human_review": False,
                "review_reason": None,
            }
        elif "quantity =" in system_prompt:
            return {
                "issue_category": "data_conflict",
                "urgency": "high",
                "evidence": {
                    "from_field_update": ["Field claims stockout"],
                    "from_verified_data": ["Verified stock table indicates stock is present"],
                },
                "recommended_next_action": "Audit physical inventory before re-ordering.",
                "missing_information": [],
                "needs_human_review": True,
                "review_reason": "System stock conflicts with field report.",
            }
        else:
            return {
                "issue_category": "stockout",
                "urgency": "medium",
                "evidence": {
                    "from_field_update": ["Stockout reported at outlet"],
                    "from_verified_data": [],
                },
                "recommended_next_action": "Verify outlet master record and confirm warehouse replenishment.",
                "missing_information": ["Outlet not found in verified stock database"],
                "needs_human_review": True,
                "review_reason": "Unregistered outlet in verified system.",
            }

    return {
        "issue_category": "other",
        "urgency": "low",
        "evidence": {
            "from_field_update": ["Vague field update received"],
            "from_verified_data": [],
        },
        "recommended_next_action": "Request rep provide specific outlet name, SKU, and nature of the issue.",
        "missing_information": ["Outlet name", "SKU", "Issue description"],
        "needs_human_review": True,
        "review_reason": "Insufficient details to take action.",
    }


def analyze_with_llm(
    system_prompt: str,
    user_message: str,
    model_id: str | None = None,
) -> dict:
    """Call the selected model and return a dict matching SalesAnalysis. Never raises."""
    if SIMULATE_FAILURE_TOKEN in user_message:
        return dict(FALLBACK_ANALYSIS)

    model = resolve_model(model_id)
    if model["provider"] == "mock":
        return _analyze_mock(system_prompt, user_message)
    if model["provider"] == "gemini":
        return _analyze_gemini(system_prompt, user_message, model["id"])
    return _analyze_anthropic(system_prompt, user_message, model["id"])


def _check_gemini_online(model_id: str) -> tuple[bool, str | None]:
    api_key = _gemini_key()
    if not api_key:
        return False, "Gemini API key not configured"
    try:
        response = httpx.get(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}",
            headers={"x-goog-api-key": api_key},
            timeout=8.0,
        )
        if response.status_code == 200:
            return True, None
        if response.status_code in {401, 403}:
            return False, "Gemini key rejected"
        if response.status_code == 404:
            return False, "Model not available"
        return False, "Gemini API unreachable"
    except Exception:  # noqa: BLE001
        return False, "Gemini API unreachable"


def _check_anthropic_online(model_id: str) -> tuple[bool, str | None]:
    api_key = _anthropic_key()
    if not api_key:
        return False, "Anthropic API key not configured"
    try:
        response = httpx.get(
            f"https://api.anthropic.com/v1/models/{model_id}",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
            timeout=8.0,
        )
        if response.status_code == 200:
            return True, None
        if response.status_code in {401, 403}:
            return False, "Anthropic key rejected"
        if response.status_code == 404:
            return False, "Model not available"
        return False, "Anthropic API unreachable"
    except Exception:  # noqa: BLE001
        return False, "Anthropic API unreachable"


def _check_model_status_item(item: dict) -> dict:
    if item["provider"] == "mock":
        return {
            "id": item["id"],
            "label": item["label"],
            "provider": item["provider"],
            "online": True,
            "status_reason": "Local deterministic adapter (No external API quota needed)",
        }
    if item["provider"] == "gemini":
        online, reason = _check_gemini_online(item["id"])
    else:
        online, reason = _check_anthropic_online(item["id"])
    return {
        "id": item["id"],
        "label": item["label"],
        "provider": item["provider"],
        "online": online,
        "status_reason": reason,
    }


def list_model_status() -> dict:
    with ThreadPoolExecutor(max_workers=min(len(SUPPORTED_MODELS), 8)) as executor:
        models = list(executor.map(_check_model_status_item, SUPPORTED_MODELS))
    return {"models": models, "default_model": DEFAULT_MODEL}


def ping_model(model_id: str) -> dict:
    import time
    start = time.time()
    model = resolve_model(model_id)
    if model["provider"] == "mock":
        return {
            "online": True,
            "latency_ms": 2,
            "model_id": model["id"],
            "provider": "mock",
            "message": "Responsive in 2ms (Mock Evaluator Mode)",
        }
    if model["provider"] == "gemini":
        api_key = _gemini_key()
        if not api_key:
            return {"online": False, "status_reason": "Gemini API key not configured", "model_id": model["id"]}
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            res = client.models.generate_content(
                model=model["id"],
                contents="test ping",
            )
            elapsed_ms = round((time.time() - start) * 1000)
            return {
                "online": True,
                "latency_ms": elapsed_ms,
                "model_id": model["id"],
                "provider": "gemini",
                "message": f"Responsive in {elapsed_ms}ms",
            }
        except Exception as exc:
            elapsed_ms = round((time.time() - start) * 1000)
            err_str = str(exc)
            if "429" in err_str:
                reason = "Quota limit reached (Free tier)"
            elif "503" in err_str:
                reason = "High demand / busy spike (503)"
            else:
                reason = type(exc).__name__
            return {
                "online": False,
                "latency_ms": elapsed_ms,
                "model_id": model["id"],
                "provider": "gemini",
                "status_reason": reason,
            }
    else:
        api_key = _anthropic_key()
        if not api_key:
            return {"online": False, "status_reason": "Anthropic API key not configured", "model_id": model["id"]}
        try:
            client = anthropic.Anthropic(api_key=api_key)
            client.messages.create(
                model=model["id"],
                max_tokens=10,
                messages=[{"role": "user", "content": "ping"}],
            )
            elapsed_ms = round((time.time() - start) * 1000)
            return {
                "online": True,
                "latency_ms": elapsed_ms,
                "model_id": model["id"],
                "provider": "anthropic",
                "message": f"Responsive in {elapsed_ms}ms",
            }
        except Exception as exc:
            return {
                "online": False,
                "model_id": model["id"],
                "provider": "anthropic",
                "status_reason": type(exc).__name__,
            }
