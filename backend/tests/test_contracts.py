"""Contrato estático compartido; no valida todavía handlers ni el motor."""

import copy
import json
from pathlib import Path
from typing import Any

import pytest
import yaml
from jsonschema import Draft202012Validator, FormatChecker
from openapi_spec_validator import validate
from referencing import Registry, Resource

SCHEMAS = Path(__file__).resolve().parents[2] / "schemas"


def read_json(path: Path) -> Any:
    def reject_constant(constant: str) -> None:
        raise ValueError(f"Número no permitido en JSON: {constant}")

    return json.loads(path.read_text(encoding="utf-8"), parse_constant=reject_constant)


def validator(name: str) -> Draft202012Validator:
    registry: Registry[Any] = Registry().with_resources(
        (path.as_uri(), Resource.from_contents(read_json(path)))
        for path in SCHEMAS.glob("*.schema.json")
    )
    return Draft202012Validator(
        {"$ref": (SCHEMAS / name).as_uri()},
        registry=registry,
        format_checker=FormatChecker(),
    )


def example(name: str) -> Any:
    return read_json(SCHEMAS / "examples" / name)


def replace_at(document: Any, path: str, value: Any) -> Any:
    result = copy.deepcopy(document)
    current = result
    keys = path.split(".")
    for key in keys[:-1]:
        current = current[int(key)] if isinstance(current, list) else current[key]
    last = int(keys[-1]) if isinstance(current, list) else keys[-1]
    current[last] = value
    return result


def test_openapi_is_valid_and_exposes_base_and_local_job_routes() -> None:
    path = SCHEMAS / "openapi.yaml"
    specification = yaml.safe_load(path.read_text(encoding="utf-8"))
    validate(specification, base_uri=path.as_uri())
    assert specification["openapi"] == "3.1.0"
    assert specification["servers"][0]["url"] == "http://localhost:8000/v1"
    assert set(specification["paths"]) == {
        "/health",
        "/config",
        "/scenarios/preview",
        "/simulations/compare",
        "/jobs",
        "/jobs/{jobId}",
        "/jobs/{jobId}/cancel",
        "/jobs/{jobId}/result",
    }


def test_schemas_and_all_examples_are_valid() -> None:
    manifest = example("index.json")
    assert manifest["kind"] == "handcrafted-contract-examples"
    assert len(manifest["examples"]) >= 20
    for path in SCHEMAS.glob("*.schema.json"):
        Draft202012Validator.check_schema(read_json(path))
    for entry in manifest["examples"]:
        validator(entry["schema"]).validate(example(entry["file"]))


@pytest.mark.parametrize(
    "schema", ["preview-request.schema.json", "experiment-request.schema.json"]
)
def test_defaults_allow_partial_configuration_but_reject_unknown_fields(schema: str) -> None:
    request: dict[str, Any] = {"schemaVersion": "1.0"}
    if schema.startswith("experiment"):
        request.update(expectedGraphHash="sha256:" + "a" * 64, includeRepresentativeFrames=False)
    validator(schema).validate(request)
    request["configuration"] = {"scenario": {"beta": 0}}
    validator(schema).validate(request)
    assert not validator(schema).is_valid(replace_at(request, "configuration.scenario.btea", 0.1))


@pytest.mark.parametrize(
    ("path", "invalid"),
    [
        ("schemaVersion", "2.0"),
        ("expectedGraphHash", "sha256:..."),
        ("includeRepresentativeFrames", "false"),
        ("configuration.rootSeed", True),
        ("configuration.rootSeed", -1),
        ("configuration.rootSeed", 2**32),
        ("configuration.networkMode", "regenerated"),
        ("configuration.repetitions", 1),
        ("configuration.repetitions", 31),
        ("configuration.policies", ["none", "random"]),
        ("configuration.policies", ["none", "none", "targeted"]),
        ("configuration.policies", ["none", "random", "oracle"]),
        ("configuration.scenario.populationSize", 49),
        ("configuration.scenario.populationSize", 2001),
        ("configuration.scenario.days", 0),
        ("configuration.scenario.days", 181),
        ("configuration.scenario.beta", "0.08"),
        ("configuration.scenario.beta", True),
        ("configuration.scenario.beta", -0.01),
        ("configuration.scenario.beta", 1.01),
        ("configuration.scenario.initialInfectious", 21),
        ("configuration.scenario.origin", {"kind": "node", "value": None}),
        ("configuration.scenario.origin", {"kind": "market", "value": 1}),
        ("configuration.scenario.origin", {"kind": "node", "value": "1"}),
        ("configuration.scenario.origin.kind", "hospital"),
        ("configuration.intervention.vaccines", -1),
        ("configuration.intervention.interventionDay", 181),
        ("configuration.intervention.vaccineEfficacy", 1.01),
        ("configuration.network.weights.school", 1.1),
        ("configuration.network.dayZero", "sunday"),
        ("configuration.network.generatorVersion", "unknown"),
    ],
)
def test_compare_rejects_invalid_configuration(path: str, invalid: Any) -> None:
    request = replace_at(example("compare-request.json"), path, invalid)
    assert not validator("experiment-request.schema.json").is_valid(request)


@pytest.mark.parametrize(
    "path",
    [
        "configuration",
        "configuration.scenario",
        "configuration.network",
        "configuration.intervention",
        "configuration.network.weights",
    ],
)
def test_unknown_nested_fields_are_rejected(path: str) -> None:
    request = example("compare-request.json")
    current = request
    for part in path.split("."):
        current = current[part]
    current["secretExtra"] = "unexpected"
    assert not validator("experiment-request.schema.json").is_valid(request)


def test_policies_order_is_not_restricted_and_node_origin_is_typed() -> None:
    request = example("compare-request.json")
    request["configuration"]["policies"] = ["targeted", "none", "random"]
    request["configuration"]["scenario"]["origin"] = {"kind": "node", "value": 0}
    validator("experiment-request.schema.json").validate(request)


def test_normalized_configuration_requires_every_field_and_canonical_policies() -> None:
    normalized = example("configuration-default.json")
    assert not validator("configuration.schema.json").is_valid({"scenario": {"beta": 0}})
    assert not validator("configuration.schema.json").is_valid(
        replace_at(normalized, "policies", ["targeted", "none", "random"])
    )


def test_json_schema_validation_does_not_apply_defaults() -> None:
    request = {"schemaVersion": "1.0", "configuration": {"scenario": {"beta": 0}}}
    unchanged = copy.deepcopy(request)
    validator("preview-request.schema.json").validate(request)
    assert request == unchanged
    # El normalizador y las comparaciones entre campos se implementan en T-04.
    request["configuration"] = {
        "scenario": {"populationSize": 50},
        "intervention": {"vaccines": 100},
    }
    validator("preview-request.schema.json").validate(request)


@pytest.mark.parametrize("invalid", ["NaN", "Infinity", "-Infinity"])
def test_example_reader_rejects_non_json_numbers(tmp_path: Path, invalid: str) -> None:
    path = tmp_path / "non-json.json"
    path.write_text('{"beta":' + invalid + "}", encoding="utf-8")
    with pytest.raises(ValueError):
        read_json(path)


@pytest.mark.parametrize(
    ("path", "value"),
    [
        ("replicates.0.policies.none.events.0.cause", "contact"),
        ("replicates.0.policies.none.events.0.to", "S"),
        ("replicates.0.policies.none.events.0.sourceNodeId", 1),
        (
            "recommendation",
            {
                "winner": "targeted",
                "confidence": "supported",
                "reasons": ["Invalid for R=2"],
                "limitations": ["Mock"],
            },
        ),
        (
            "pairedComparisons.gainVsRandom.bootstrap",
            {"level": 0.95, "resamples": 2000, "lower": 0, "upper": 0},
        ),
    ],
)
def test_response_conditionals_reject_incompatible_combinations(path: str, value: Any) -> None:
    assert not validator("experiment-result.schema.json").is_valid(
        replace_at(example("compare-response.json"), path, value)
    )


def test_main_preview_and_compare_examples_form_a_consistent_mock_flow() -> None:
    preview_request = example("preview-request.json")
    preview_response = example("preview-response.json")
    compare_request = example("compare-request.json")
    compare_response = example("compare-response.json")
    assert (
        preview_request["configuration"]
        == preview_response["configuration"]
        == compare_request["configuration"]
        == compare_response["configuration"]
    )
    assert (
        preview_response["graphHash"]
        == compare_request["expectedGraphHash"]
        == compare_response["graphHash"]
    )
    assert len(compare_response["replicates"]) == compare_response["configuration"]["repetitions"]
    assert compare_response["progress"]["replicatesTotal"] == 2
    assert compare_response["progress"]["replicatesSucceeded"] == 2
    assert all(
        len(result["daily"]) == 2
        for replicate in compare_response["replicates"]
        for result in replicate["policies"].values()
    )


@pytest.mark.parametrize("field", ["schemaVersion", "engineVersion", "requestId", "error"])
def test_errors_require_common_envelope(field: str) -> None:
    error = example("error-422-validation.json")
    del error[field]
    assert not validator("error.schema.json").is_valid(error)


@pytest.mark.parametrize(
    ("file", "schema", "path", "value"),
    [
        ("health-response.json", "health-result.schema.json", "generatedAt", "yesterday"),
        ("config-response.json", "config-result.schema.json", "defaults.scenario.beta", -1),
        ("preview-response.json", "preview-result.schema.json", "graph.edges.0.weight", -1),
        ("preview-response.json", "preview-result.schema.json", "graphHash", "placeholder"),
        ("compare-response.json", "experiment-result.schema.json", "progress.replicatesFailed", 1),
        (
            "compare-response.json",
            "experiment-result.schema.json",
            "summaryByPolicy.none.peakDay.mean",
            -1,
        ),
        (
            "compare-response-vaccines.json",
            "experiment-result.schema.json",
            "replicates.0.policies.targeted.selections.0.stateAtDecision",
            "I",
        ),
        (
            "compare-response-bootstrap.json",
            "experiment-result.schema.json",
            "pairedComparisons.gainVsRandom.bootstrap",
            None,
        ),
        (
            "compare-response.json",
            "experiment-result.schema.json",
            "recommendation.winner",
            "oracle",
        ),
        (
            "compare-response.json",
            "experiment-result.schema.json",
            "replicates.0.policies.none.daily.0.s",
            -1,
        ),
        (
            "compare-response.json",
            "experiment-result.schema.json",
            "summaryByPolicy.none.peakDay.p95",
            None,
        ),
        (
            "compare-response.json",
            "experiment-result.schema.json",
            "representative.frames.none.0.0",
            "Z",
        ),
        (
            "compare-response.json",
            "experiment-result.schema.json",
            "manifest.bitGenerator",
            "unknown",
        ),
    ],
)
def test_responses_reject_invalid_data(file: str, schema: str, path: str, value: Any) -> None:
    assert not validator(schema).is_valid(replace_at(example(file), path, value))


def test_error_codes_match_http_status_and_examples_are_wired_to_operations() -> None:
    specification = yaml.safe_load((SCHEMAS / "openapi.yaml").read_text(encoding="utf-8"))
    manifest = example("index.json")
    for entry in manifest["examples"]:
        if "method" not in entry:
            continue
        operation = specification["paths"][entry["path"]][entry["method"]]
        if entry["direction"] == "request":
            media = operation["requestBody"]["content"]["application/json"]
        else:
            media = operation["responses"][str(entry["status"])]["content"]["application/json"]
        wired_examples = media["examples"].values()
        assert any(
            item.get("externalValue") == "./examples/" + entry["file"] for item in wired_examples
        ), entry["file"]
        response_schema = media["schema"]["$ref"]
        assert response_schema == "./" + entry["schema"]
        if entry.get("status", 0) >= 400:
            assert (
                example(entry["file"])["error"]["code"]
                in operation["responses"][str(entry["status"])]["x-error-codes"]
            )
