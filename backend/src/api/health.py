"""GET /v1/health."""

from typing import Any

from api.common import dispatch


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    return dispatch("health", event, context)
