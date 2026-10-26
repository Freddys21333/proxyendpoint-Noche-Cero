"""Defaults y validación del contrato sin handlers, simulación ni dependencia de AWS."""

import copy
import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal, cast, overload

from jsonschema import Draft202012Validator

from domain.errors import ConfigurationError, FieldIssue
from domain.models import (
    CompareRequest,
    Configuration,
    Intervention,
    Network,
    Origin,
    OriginKind,
    PreviewRequest,
    Scenario,
    Weights,
)

MAX_REQUEST_BYTES = 65536
_OMITTED = object()


@lru_cache(maxsize=1)
def _definitions() -> dict[str, Any]:
    module = Path(__file__).resolve()
    # En el ZIP schemas/ comparte raíz con domain/; en checkout está en la raíz Git.
    candidates = [
        module.parents[1] / "schemas/common.schema.json",
        module.parents[3] / "schemas/common.schema.json",
    ]
    for path in candidates:
        if path.is_file():
            document = json.loads(path.read_text(encoding="utf-8"))
            Draft202012Validator.check_schema(document)
            return cast(dict[str, Any], document["$defs"])
    raise RuntimeError("No se encontró el contrato compartido del backend.")


@lru_cache(maxsize=4)
def _validator(name: str) -> Draft202012Validator:
    return Draft202012Validator(
        {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "$defs": _definitions(),
            "$ref": "#/$defs/" + name,
        }
    )


def _fail_validation(issues: list[FieldIssue]) -> None:
    unique = {(issue.path, issue.reason): issue for issue in issues}
    raise ConfigurationError(
        "VALIDATION_ERROR",
        422,
        "La configuración contiene valores inválidos.",
        tuple(unique[key] for key in sorted(unique)),
    )


def _json_issues(value: object, path: str) -> list[FieldIssue]:
    if value is None or isinstance(value, (str, bool, int)):
        return []
    if isinstance(value, float):
        return [] if math.isfinite(value) else [FieldIssue(path, "El número debe ser finito.")]
    if isinstance(value, list):
        return [
            issue
            for i, item in enumerate(value)
            for issue in _json_issues(item, f"{path}.{i}".strip("."))
        ]
    if isinstance(value, dict):
        issues = []
        for key, item in value.items():
            if not isinstance(key, str):
                issues.append(FieldIssue(path or "$", "Las claves deben ser texto."))
            else:
                issues.extend(_json_issues(item, f"{path}.{key}".strip(".")))
        return issues
    return [FieldIssue(path or "$", "El valor debe ser compatible con JSON.")]


def _validate(value: object, definition: str, prefix: str = "") -> None:
    issues = _json_issues(value, prefix)
    if issues:
        _fail_validation(issues)
    issues = []
    unknown: list[FieldIssue] = []
    for error in _validator(definition).iter_errors(value):
        path = ".".join([*([prefix] if prefix else []), *map(str, error.absolute_path)])
        if error.validator == "additionalProperties" and isinstance(error.instance, dict):
            allowed = error.schema.get("properties", {})
            unknown.extend(
                FieldIssue(f"{path}.{key}".strip("."), "Campo desconocido.")
                for key in error.instance
                if key not in allowed
            )
        elif error.validator == "required":
            issues.extend(
                FieldIssue(f"{path}.{key}".strip("."), "Campo obligatorio.")
                for key in error.validator_value
                if key not in error.instance
            )
        else:
            reason = {
                "type": "Tipo de dato inválido.",
                "minimum": "Valor fuera del rango permitido.",
                "maximum": "Valor fuera del rango permitido.",
                "const": "Valor no admitido.",
                "enum": "Valor no admitido.",
                "uniqueItems": "Los elementos no deben repetirse.",
                "minItems": "Cantidad de elementos inválida.",
                "maxItems": "Cantidad de elementos inválida.",
                "pattern": "Formato de valor inválido.",
            }.get(error.validator, "El valor no cumple el contrato.")
            issues.append(FieldIssue(path or "$", reason))
    if unknown:
        raise ConfigurationError(
            "UNKNOWN_FIELD",
            400,
            "La solicitud contiene campos desconocidos.",
            tuple(sorted(unknown, key=lambda issue: issue.path)),
        )
    if issues:
        _fail_validation(issues)


def _merge(defaults: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(defaults)
    for key, value in overrides.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _merge(result[key], value)
        else:
            result[key] = copy.deepcopy(value)
    return result


def _float(value: int | float) -> float:
    return 0.0 if value == 0 else float(value)


def normalize_configuration(payload: object = _OMITTED) -> Configuration:
    """None explícito nunca equivale a configuración omitida."""
    if payload is _OMITTED:
        payload = {}
    _validate(payload, "ConfigurationInput", "configuration")
    defaults = {
        key: prop["default"]
        for key, prop in _definitions()["ConfigurationInput"]["properties"].items()
    }
    candidate = _merge(defaults, cast(dict[str, Any], payload))
    scenario = candidate["scenario"]
    intervention = candidate["intervention"]
    origin = scenario["origin"]
    issues = []
    if intervention["vaccines"] > scenario["populationSize"]:
        issues.append(
            FieldIssue(
                "configuration.intervention.vaccines", "Las vacunas no pueden superar la población."
            )
        )
    if intervention["interventionDay"] > scenario["days"]:
        issues.append(
            FieldIssue(
                "configuration.intervention.interventionDay",
                "El día de intervención no puede superar el horizonte.",
            )
        )
    if scenario["initialInfectious"] > scenario["populationSize"]:
        issues.append(
            FieldIssue(
                "configuration.scenario.initialInfectious",
                "Los casos iniciales no pueden superar la población.",
            )
        )
    if origin["kind"] == "node" and origin["value"] >= scenario["populationSize"]:
        issues.append(
            FieldIssue(
                "configuration.scenario.origin.value", "El nodo debe pertenecer a la población."
            )
        )
    if issues:
        _fail_validation(issues)
    weights = candidate["network"]["weights"]
    result = Configuration(
        root_seed=int(candidate["rootSeed"]),
        network_mode="fixed",
        repetitions=int(candidate["repetitions"]),
        scenario=Scenario(
            population_size=int(scenario["populationSize"]),
            days=int(scenario["days"]),
            beta=_float(scenario["beta"]),
            sigma=_float(scenario["sigma"]),
            gamma=_float(scenario["gamma"]),
            initial_infectious=int(scenario["initialInfectious"]),
            origin=Origin(
                kind=cast(OriginKind, origin["kind"]),
                value=None if origin["value"] is None else int(origin["value"]),
            ),
        ),
        intervention=Intervention(
            vaccines=int(intervention["vaccines"]),
            intervention_day=int(intervention["interventionDay"]),
            vaccine_efficacy=_float(intervention["vaccineEfficacy"]),
        ),
        policies=("none", "random", "targeted"),
        network=Network(
            generator_version="synthetic-manta-v1",
            day_zero="monday",
            weights=Weights(**{key: _float(value) for key, value in weights.items()}),
        ),
    )
    _validate(result.to_dict(), "Configuration", "configuration")
    return result


def _strict_float(value: str) -> float:
    parsed = float(value)
    if not math.isfinite(parsed):
        raise ValueError("Número no finito.")
    return parsed


def _reject_constant(value: str) -> None:
    raise ValueError("Número JSON no permitido.")


def _unique_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Clave duplicada.")
        result[key] = value
    return result


def decode_json_document(body: bytes, *, max_bytes: int) -> Any:
    """Lector JSON estricto compartido por importación de experimentos."""
    if len(body) > max_bytes:
        raise ValueError("El documento supera el límite permitido.")
    try:
        return json.loads(
            body.decode("utf-8"),
            parse_constant=_reject_constant,
            parse_float=_strict_float,
            object_pairs_hook=_unique_keys,
        )
    except (ValueError, UnicodeError, RecursionError):
        raise ValueError("El documento debe ser JSON UTF-8 estricto.") from None


def validate_contract(value: object, definition: str) -> None:
    """Valida un documento contra el contrato local compartido, sin red."""
    _validate(value, definition)
    formatted = _validator(definition).evolve(format_checker=Draft202012Validator.FORMAT_CHECKER)
    if not formatted.is_valid(value):
        raise ValueError("El documento contiene un formato inválido.")


@overload
def parse_request(
    body: str | bytes,
    *,
    operation: Literal["preview"] = "preview",
    max_request_bytes: int = MAX_REQUEST_BYTES,
) -> PreviewRequest: ...


@overload
def parse_request(
    body: str | bytes, *, operation: Literal["compare"], max_request_bytes: int = MAX_REQUEST_BYTES
) -> CompareRequest: ...


def parse_request(
    body: str | bytes,
    *,
    operation: Literal["preview", "compare"] = "preview",
    max_request_bytes: int = MAX_REQUEST_BYTES,
) -> PreviewRequest | CompareRequest:
    """Entrada pura de JSON; la respuesta HTTP corresponde al futuro adapter."""
    if operation not in ("preview", "compare"):
        raise ValueError("Operación de entrada no soportada.")
    if type(max_request_bytes) is not int or max_request_bytes < 1:
        raise ValueError("El límite de request debe ser un entero positivo.")
    try:
        raw = body.encode("utf-8") if isinstance(body, str) else body
        if len(raw) > max_request_bytes:
            raise ConfigurationError(
                "REQUEST_TOO_LARGE", 413, "El cuerpo supera el límite permitido."
            )
        text = raw.decode("utf-8")
        payload = json.loads(
            text,
            parse_constant=_reject_constant,
            parse_float=_strict_float,
            object_pairs_hook=_unique_keys,
        )
    except (ValueError, UnicodeError, RecursionError) as error:
        if isinstance(error, ConfigurationError):
            raise
        raise ConfigurationError(
            "INVALID_JSON", 400, "El cuerpo debe ser JSON UTF-8 válido."
        ) from None
    _validate(payload, "PreviewRequest" if operation == "preview" else "CompareRequest")
    configuration = normalize_configuration(payload.get("configuration", _OMITTED))
    if operation == "compare":
        return CompareRequest(
            schema_version="1.0",
            configuration=configuration,
            expected_graph_hash=payload["expectedGraphHash"],
            include_representative_frames=payload["includeRepresentativeFrames"],
        )
    return PreviewRequest(schema_version="1.0", configuration=configuration)
