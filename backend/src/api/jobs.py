"""Handlers P-03; únicamente habilitados por el servidor local."""

from typing import Any

from api.common import dispatch


def create_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    return dispatch("jobs_create", event, context)


def get_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    return dispatch("jobs_get", event, context)


def cancel_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    return dispatch("jobs_cancel", event, context)


def result_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    return dispatch("jobs_result", event, context)
