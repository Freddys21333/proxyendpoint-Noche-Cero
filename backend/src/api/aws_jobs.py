"""Transporte de trabajos AWS: capacidades opacas; errores sin datos de AWS."""

import json
import re
import uuid
from typing import Any

from api.common import DEFAULT_LIMITS, _body, _error
from domain.configuration import decode_json_document, validate_contract
from domain.errors import ConfigurationError
from simulation.aws_jobs import repository
from simulation.exports import ENGINE_VERSION, SCHEMA_VERSION


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    request_id = str(uuid.uuid4())
    try:
        headers = {str(key).lower(): value for key, value in event.get("headers", {}).items()}
        token = headers.get("x-job-token", "")
        if not isinstance(token, str) or not re.fullmatch(r"[0-9a-f]{64}", token):
            raise ConfigurationError(
                "VALIDATION_ERROR", 422, "Se requiere una credencial de trabajo válida."
            )
        method = event.get("requestContext", {}).get("http", {}).get("method")
        path = event.get("rawPath", "")
        repo = repository()
        status = 200
        if path == "/v1/jobs" and method == "POST":
            key = headers.get("idempotency-key", "")
            if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z0-9_-]{16,128}", key):
                raise ConfigurationError(
                    "VALIDATION_ERROR", 422, "Se requiere una clave de idempotencia."
                )
            data = decode_json_document(_body(event, 65536), max_bytes=65536)
            validate_contract(data, "AwsJobCreateRequest")
            job_id = repo.create(
                data.get("configuration", {}),
                data["expectedGraphHash"],
                data.get("includeRepresentativeFrames", False),
                token,
                key,
            )
            payload = repo.snapshot(job_id, token)
            status = 202
        else:
            match = re.fullmatch(r"/v1/jobs/([0-9a-f-]{36})(/cancel|/result)?", path)
            if match is None:
                raise ConfigurationError("NOT_FOUND", 404, "Ruta no disponible.")
            job_id, operation = match.groups()
            if method == "POST" and operation == "/cancel":
                repo.cancel(job_id, token)
                payload = repo.snapshot(job_id, token)
            elif method == "GET" and operation == "/result":
                payload = repo.result(job_id, token)
            elif method == "GET" and operation is None:
                payload = repo.snapshot(job_id, token)
            else:
                raise ConfigurationError("NOT_FOUND", 404, "Ruta no disponible.")
        payload = dict(
            schemaVersion=SCHEMA_VERSION,
            engineVersion=ENGINE_VERSION,
            requestId=request_id,
            **payload,
        )
        return {
            "statusCode": status,
            "body": json.dumps(payload, separators=(",", ":")),
            "headers": {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
            },
        }
    except ConfigurationError as error:
        return _error(error, request_id, DEFAULT_LIMITS)
    except (ValueError, TypeError, KeyError):
        return _error(
            ConfigurationError("VALIDATION_ERROR", 422, "Solicitud de trabajo inválida."),
            request_id,
            DEFAULT_LIMITS,
        )
    except Exception:
        return _error(
            ConfigurationError(
                "COMPUTE_UNAVAILABLE",
                503,
                "El servicio de trabajos no está disponible. Puedes reintentar con la misma clave.",
            ),
            request_id,
            DEFAULT_LIMITS,
        )
