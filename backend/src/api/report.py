"""POST /v1/reports/mayor: PDF desde un experimento completo exportado."""

import base64
import uuid
from typing import Any

from api.common import DEFAULT_LIMITS, _body, _error
from domain.configuration import decode_json_document
from domain.errors import ConfigurationError
from simulation.exports import MAX_DOCUMENT_BYTES
from simulation.report import build_report, render_pdf


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    request_id = str(uuid.uuid4())
    try:
        if event.get("rawPath") != "/v1/reports/mayor":
            raise ConfigurationError("NOT_FOUND", 404, "Ruta no disponible.")
        if event.get("requestContext", {}).get("http", {}).get("method") != "POST":
            raise ConfigurationError("METHOD_NOT_ALLOWED", 405, "Usa POST para generar el informe.")
        raw = _body(event, MAX_DOCUMENT_BYTES)
        try:
            document = decode_json_document(raw, max_bytes=MAX_DOCUMENT_BYTES)
        except ValueError:
            raise ConfigurationError(
                "INVALID_JSON", 400, "El cuerpo debe ser JSON UTF-8 estricto."
            ) from None
        if not isinstance(document, dict):
            raise ValueError("Se requiere un experimento.")
        pdf = render_pdf(build_report(document))
        encoded = base64.b64encode(pdf).decode("ascii")
        if len(encoded) > DEFAULT_LIMITS["maxResponseBytes"] - 1024:
            raise ConfigurationError(
                "RESULT_TOO_LARGE", 413, "El informe supera el límite permitido."
            )
        return dict(
            statusCode=200,
            isBase64Encoded=True,
            body=encoded,
            headers={
                "Content-Type": "application/pdf",
                "Content-Disposition": 'attachment; filename="informe-alcaldia.pdf"',
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
            },
        )
    except ConfigurationError as error:
        return _error(error, request_id, DEFAULT_LIMITS)
    except (ValueError, KeyError, TypeError):
        return _error(
            ConfigurationError(
                "VALIDATION_ERROR",
                422,
                "El informe requiere un experimento completo con hashes y agregados coherentes.",
            ),
            request_id,
            DEFAULT_LIMITS,
        )
    except Exception:
        return _error(
            ConfigurationError(
                "INTERNAL_ERROR",
                500,
                "No se pudo generar el informe. Intenta nuevamente.",
            ),
            request_id,
            DEFAULT_LIMITS,
        )
