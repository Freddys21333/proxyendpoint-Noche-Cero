"""Adapters HTTP API v2 compartidos; sin framework ni llamadas AWS."""

import base64
import binascii
import gzip
import json
import logging
import os
import time
import uuid
from datetime import UTC, datetime
from typing import Any, Literal

from domain.configuration import normalize_configuration, parse_request, validate_contract
from domain.errors import ConfigurationError
from domain.reproducibility import canonical_json, json_hash
from simulation.experiments import run_experiment
from simulation.exports import ENGINE_VERSION, SCHEMA_VERSION, export_experiment
from simulation.network import build_preview, generate_graph

Endpoint = Literal["health", "config", "preview", "compare"]
LOGGER = logging.getLogger(__name__)
LOGGER.setLevel(logging.INFO)
DEFAULT_LIMITS = dict(
    maxRequestBytes=65536,
    maxResponseBytes=5242880,
    maxDecodedResponseBytes=33554432,
    maxEdges=100000,
    maxFrameStates=400000,
)
ENV_LIMITS = dict(
    maxRequestBytes="MAX_REQUEST_BYTES",
    maxResponseBytes="MAX_RESPONSE_BYTES",
    maxDecodedResponseBytes="MAX_DECODED_RESPONSE_BYTES",
    maxEdges="MAX_EDGES",
    maxFrameStates="MAX_FRAME_STATES",
)
ROUTES = dict(
    health=("GET", "/health"),
    config=("GET", "/config"),
    preview=("POST", "/scenarios/preview"),
    compare=("POST", "/simulations/compare"),
)
DESCRIPTION = (
    "Población sintética inspirada en Manta; synthetic-manta-v1, sin datos personales. "
    "Hogares tamaños 1..6 con probabilidades 0.10/0.20/0.25/0.25/0.15/0.05; "
    "roles 25% estudiantes, 55% trabajadores y resto comunidad. Salones hasta 25, "
    "Watts–Strogatz k≤6/p=0.1; buses 40% población hasta 40 por ruta, contacto p=min(1,6/(m-1)); "
    "vendedores max(1,floor(10% trabajadores)), visitantes diarios 20%, contacto p=min(1,8/vendedores). "
    "Cinco barrios, contacto fijo p=0.02. Lunes es día 0; hogar/barrio diarios, "
    "colegio lunes–viernes y bus/mercado lunes–sábado. Calendario hasta T inclusive. "
    "Pesos configurables: defaults hogar 1, colegio 0.6, bus 0.45, mercado 0.5, barrio 0.2."
)


def _settings() -> dict[str, int]:
    try:
        if (
            os.environ.get("ENGINE_VERSION", ENGINE_VERSION) != ENGINE_VERSION
            or os.environ.get("SCHEMA_VERSION", SCHEMA_VERSION) != SCHEMA_VERSION
        ):
            raise ValueError
        limits = {
            key: int(os.environ.get(ENV_LIMITS[key], str(value)))
            for key, value in DEFAULT_LIMITS.items()
        }
        if any(
            not (1024 if key == "maxResponseBytes" else 1) <= value <= DEFAULT_LIMITS[key]
            for key, value in limits.items()
        ):
            raise ValueError
        return limits
    except ValueError:
        raise ConfigurationError(
            "COMPUTE_UNAVAILABLE", 503, "Configuración de ejecución no disponible."
        ) from None


def _metadata(request_id: str) -> dict[str, str]:
    return dict(schemaVersion=SCHEMA_VERSION, engineVersion=ENGINE_VERSION, requestId=request_id)


def _response(
    payload: dict[str, Any], status: int, compressed: bool, limits: dict[str, int]
) -> dict[str, Any]:
    raw = canonical_json(payload)
    if len(raw) > limits["maxDecodedResponseBytes"]:
        raise ConfigurationError("RESULT_TOO_LARGE", 413, "El resultado supera el límite de JSON.")
    headers = {"Content-Type": "application/json", "Cache-Control": "no-store"}
    if compressed:
        headers["Content-Encoding"] = "gzip"
    body = (
        base64.b64encode(gzip.compress(raw, mtime=0)).decode("ascii")
        if compressed
        else raw.decode("utf-8")
    )
    response = dict(statusCode=status, headers=headers, body=body, isBase64Encoded=compressed)
    if len(json.dumps(response, ensure_ascii=True).encode("utf-8")) > limits["maxResponseBytes"]:
        raise ConfigurationError(
            "RESULT_TOO_LARGE", 413, "La respuesta supera el límite de transporte."
        )
    return response


def _error(error: ConfigurationError, request_id: str, limits: dict[str, int]) -> dict[str, Any]:
    fields = [dict(path=field.path[:128], reason=field.reason[:160]) for field in error.fields[:8]]
    payload = dict(
        **_metadata(request_id),
        error=dict(code=error.code, message=str(error)[:256], fields=fields),
    )
    # El error debe poder explicar un exceso de JSON sin usar ese mismo límite reducido.
    error_limits = {**DEFAULT_LIMITS, "maxResponseBytes": limits["maxResponseBytes"]}
    while True:
        try:
            return _response(payload, error.status_code, False, error_limits)
        except ConfigurationError:
            if fields:
                fields.pop()
            else:
                raise


def _body(event: dict[str, Any], limit: int) -> bytes:
    body = event.get("body")
    encoded = event.get("isBase64Encoded", False)
    if not isinstance(body, str) or type(encoded) is not bool:
        raise ConfigurationError("INVALID_JSON", 400, "El cuerpo debe contener JSON UTF-8.")
    if not encoded and len(body) > limit:
        raise ConfigurationError("REQUEST_TOO_LARGE", 413, "El cuerpo supera el límite permitido.")
    if encoded and len(body) > 4 * ((limit + 2) // 3):
        raise ConfigurationError("REQUEST_TOO_LARGE", 413, "El cuerpo supera el límite permitido.")
    try:
        if encoded:
            raw = base64.b64decode(body, validate=True)
        else:
            raw = body.encode("utf-8")
    except (ValueError, UnicodeError, binascii.Error):
        raise ConfigurationError(
            "INVALID_JSON", 400, "El cuerpo debe contener JSON UTF-8 válido."
        ) from None
    if len(raw) > limit:
        raise ConfigurationError("REQUEST_TOO_LARGE", 413, "El cuerpo supera el límite permitido.")
    return raw


def _execute(
    endpoint: Endpoint, event: dict[str, Any], request_id: str, limits: dict[str, int]
) -> dict[str, Any]:
    metadata = _metadata(request_id)
    if endpoint == "health":
        return dict(
            **metadata,
            status="ok",
            region=os.environ.get("AWS_REGION", "us-east-2"),
            buildCommit=os.environ.get("BUILD_COMMIT", "unknown"),
            generatedAt=datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        )
    if endpoint == "config":
        return dict(
            **metadata,
            defaults=normalize_configuration().to_dict(),
            limits=limits,
            features=dict(asyncJobs=False, representativeFrames=True),
            generatorDescription=DESCRIPTION,
        )
    raw = _body(event, limits["maxRequestBytes"])
    if endpoint == "preview":
        preview = parse_request(
            raw, operation="preview", max_request_bytes=limits["maxRequestBytes"]
        )
        return dict(
            **metadata, **build_preview(preview.configuration, max_edges=limits["maxEdges"])
        )
    request = parse_request(raw, operation="compare", max_request_bytes=limits["maxRequestBytes"])
    configuration = request.configuration
    if (
        request.include_representative_frames
        and configuration.scenario.population_size * (configuration.scenario.days + 1)
        > limits["maxFrameStates"]
    ):
        raise ConfigurationError("FRAMES_TOO_LARGE", 413, "Los frames superan el límite permitido.")
    graph = generate_graph(configuration, max_edges=limits["maxEdges"])
    if json_hash(graph) != request.expected_graph_hash:
        raise ConfigurationError(
            "GRAPH_HASH_MISMATCH", 409, "La red cambió; solicita una nueva vista previa."
        )
    experiment = run_experiment(
        configuration,
        graph=graph,
        include_representative_frames=request.include_representative_frames,
    )
    total = configuration.repetitions
    if experiment["progress"] != dict(
        replicatesTotal=total, replicatesSucceeded=total, replicatesFailed=0
    ) or [rep["index"] for rep in experiment["replicates"]] != list(range(total)):
        raise ConfigurationError("SIMULATION_FAILED", 500, "El experimento no está completo.")
    result = export_experiment(
        experiment,
        build_commit=os.environ.get("BUILD_COMMIT", "unknown"),
        request_id=request_id,
    )
    return result


def dispatch(endpoint: Endpoint, event: dict[str, Any], context: Any) -> dict[str, Any]:
    started = time.monotonic()
    candidate = getattr(context, "aws_request_id", None)
    request_id = (
        candidate if isinstance(candidate, str) and 0 < len(candidate) <= 128 else str(uuid.uuid4())
    )
    limits = DEFAULT_LIMITS.copy()
    error_code = None
    payload: dict[str, Any] = {}
    try:
        limits = _settings()
        method, path = ROUTES[endpoint]
        if not isinstance(event, dict) or event.get("version") != "2.0":
            raise ConfigurationError("INVALID_JSON", 400, "Se requiere un evento HTTP API v2.")
        request_context = event.get("requestContext")
        if not isinstance(request_context, dict) or not isinstance(
            request_context.get("http"), dict
        ):
            raise ConfigurationError("INVALID_JSON", 400, "Contexto HTTP inválido.")
        http = request_context["http"]
        if http.get("method") != method or event.get("rawPath") not in (path, "/v1" + path):
            raise ConfigurationError("NOT_FOUND", 404, "Ruta no encontrada.")
        remaining = getattr(context, "get_remaining_time_in_millis", None)
        if endpoint in ("preview", "compare") and callable(remaining) and remaining() < 1000:
            raise ConfigurationError(
                "COMPUTE_UNAVAILABLE", 503, "Tiempo de ejecución no disponible."
            )
        payload = _execute(endpoint, event, request_id, limits)
        definition = {
            "health": "HealthResponse",
            "config": "ConfigResponse",
            "preview": "PreviewResponse",
            "compare": "CompareResponse",
        }[endpoint]
        # export_experiment ya valida el documento final, incluido requestId,
        # además de verificar los hashes de integridad del experimento.
        if endpoint != "compare":
            validate_contract(payload, definition)
        response = _response(payload, 200, endpoint in ("preview", "compare"), limits)
    except ConfigurationError as error:
        error_code = error.code
        response = _error(error, request_id, limits)
    except Exception:
        error_code = "INTERNAL_ERROR"
        response = _error(
            ConfigurationError("INTERNAL_ERROR", 500, "No se pudo completar la solicitud."),
            request_id,
            limits,
        )
    configuration = payload.get("configuration", {})
    LOGGER.info(
        canonical_json(
            dict(
                requestId=request_id,
                engineVersion=ENGINE_VERSION,
                phase=endpoint,
                status=response["statusCode"],
                error=error_code,
                durationMs=round((time.monotonic() - started) * 1000, 3),
                populationSize=configuration.get("scenario", {}).get("populationSize"),
                edges=len(payload["graph"]["edges"]) if "graph" in payload else None,
                repetitions=configuration.get("repetitions"),
            )
        ).decode()
    )
    return response
