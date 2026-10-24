import re

from verified_data import lookup_stock

SAFETY_WORDS = [
    "unwell",
    "sick",
    "injured",
    "hospital",
    "poison",
    "contaminated",
    "health",
    "allergic",
]

INJECTION_SIGNALS = [
    "ignore instructions",
    "ignore previous",
    "override",
    "mark this resolved",
    "disregard",
    "forget instructions",
    "you are now",
    "new instructions",
    "system prompt",
    "act as",
]

STOCKOUT_SIGNALS = ["stockout", "unavailable", "out of stock"]

NUMBER_PATTERN = re.compile(r"[\$₹€£]?\s*\d+(?:,\d{3})*(?:\.\d+)?%?")


def _allowed_numbers(field_update: str) -> set[str]:
    allowed = {m.group(0) for m in NUMBER_PATTERN.finditer(field_update)}
    # Verified table quantities that may be cited
    allowed.update({"0", "12", "48"})
    normalized = set()
    for item in allowed:
        digits = re.sub(r"[^\d.]", "", item)
        if digits:
            normalized.add(digits)
            normalized.add(item.strip())
    return normalized


def _strip_invented_figures(text: str, allowed: set[str]) -> str:
    if not text:
        return text

    def replace(match: re.Match) -> str:
        token = match.group(0)
        digits = re.sub(r"[^\d.]", "", token)
        if token.strip() in allowed or digits in allowed:
            return token
        return ""

    stripped = NUMBER_PATTERN.sub(replace, text)
    stripped = re.sub(r"\s{2,}", " ", stripped).strip(" ,;.-")
    return stripped


def apply_human_review_rules(
    result: dict,
    field_update: str,
    outlet_name: str | None = None,
    sku: str | None = None,
) -> dict:
    field_lower = field_update.lower()

    if any(word in field_lower for word in SAFETY_WORDS):
        result["urgency"] = "critical"
        result["needs_human_review"] = True
        result["issue_category"] = "safety"
        result["review_reason"] = (
            "Potential health or safety incident. Do not diagnose. Escalate immediately."
        )

    if any(signal in field_lower for signal in INJECTION_SIGNALS):
        result["issue_category"] = "prompt_injection"
        result["urgency"] = "critical"
        result["needs_human_review"] = True
        result["review_reason"] = "Possible prompt injection attempt detected in field input."
        result["recommended_next_action"] = "Quarantine input and notify security team."

    if any(signal in field_lower for signal in STOCKOUT_SIGNALS):
        stock = lookup_stock(outlet_name or "", sku or "")
        if stock is not None and stock > 0:
            result["issue_category"] = "data_conflict"
            result["needs_human_review"] = True
            conflict_note = "System stock conflicts with field report. Physical audit required."
            existing = result.get("review_reason")
            if existing:
                if conflict_note not in existing:
                    result["review_reason"] = f"{existing} {conflict_note}"
            else:
                result["review_reason"] = conflict_note

    allowed = _allowed_numbers(field_update)
    action = result.get("recommended_next_action")
    if isinstance(action, str):
        result["recommended_next_action"] = _strip_invented_figures(action, allowed)

    evidence = result.get("evidence") or {}
    for key in ("from_field_update", "from_verified_data"):
        items = evidence.get(key)
        if isinstance(items, list):
            evidence[key] = [
                _strip_invented_figures(item, allowed) if isinstance(item, str) else item
                for item in items
            ]

    # Guard against LLM falsely citing a different outlet when the queried outlet is unknown
    if outlet_name and lookup_stock(outlet_name, sku or "") is None:
        verified_items = evidence.get("from_verified_data") or []
        evidence["from_verified_data"] = [
            item for item in verified_items
            if outlet_name.lower().strip() in item.lower()
        ]

    result["evidence"] = evidence

    return result
