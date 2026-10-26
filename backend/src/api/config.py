"""GET /v1/config."""

from typing import Any

from api.common import dispatch


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    return dispatch("config", event, context)
