"""POST /v1/scenarios/preview."""

from typing import Any

from api.common import dispatch


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    return dispatch("preview", event, context)
