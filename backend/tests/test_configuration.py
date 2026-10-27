"""RF-01/02: defaults, límites, normalización y entrada JSON estricta."""

import copy
import json
import shutil
import subprocess
import sys
from dataclasses import FrozenInstanceError
from pathlib import Path

import pytest

from domain.configuration import normalize_configuration, parse_request, validate_contract
from domain.errors import ConfigurationError

SCHEMAS = Path(__file__).resolve().parents[2] / "schemas"


def test_contract_validation_preserves_format_and_field_errors() -> None:
    document = json.loads((SCHEMAS / "examples/health-response.json").read_text())
    validate_contract(document, "HealthResponse")
    document["generatedAt"] = "2026-99-26T00:00:00Z"
    with pytest.raises(ValueError, match="formato inválido"):
        validate_contract(document, "HealthResponse")
    document["extra"] = True
    with pytest.raises(ConfigurationError) as error:
        validate_contract(document, "HealthResponse")
    assert error.value.code == "UNKNOWN_FIELD"
    del document["extra"]
    document["generatedAt"] = float("nan")
    with pytest.raises(ConfigurationError) as error:
        validate_contract(document, "HealthResponse")
    assert error.value.fields[0].reason == "El número debe ser finito."


def test_omitted_configuration_matches_contract_defaults() -> None:
    expected = json.loads((SCHEMAS / "examples/configuration-default.json").read_text())
    assert normalize_configuration().to_dict() == expected


def test_nested_defaults_do_not_mutate_input_and_are_not_shared() -> None:
    payload = {"scenario": {"beta": 0}, "network": {"weights": {"school": 0.2}}}
    snapshot = copy.deepcopy(payload)
    result = normalize_configuration(payload)
    assert payload == snapshot
    assert result.scenario.beta == 0
    assert result.scenario.days == 90
    assert result.network.weights.school == 0.2
    assert result.network.weights.bus == 0.45
    result.to_dict()["scenario"]["beta"] = 0.9
    assert result.scenario.beta == 0
    assert normalize_configuration().scenario.beta == 0.08


def test_configuration_is_deeply_immutable() -> None:
    result = normalize_configuration()
    with pytest.raises(FrozenInstanceError):
        result.root_seed = 2
    with pytest.raises(FrozenInstanceError):
        result.scenario.beta = 0.5
    with pytest.raises(FrozenInstanceError):
        result.network.weights.school = 0.9
    assert result.policies == ("none", "random", "targeted")


def test_policy_order_and_integral_number_inputs_normalize_identically() -> None:
    first = normalize_configuration(
        {
            "policies": ["targeted", "none", "random"],
            "scenario": {"populationSize": 1000.0, "beta": 0},
            "intervention": {"vaccineEfficacy": 1},
        }
    )
    second = normalize_configuration({"scenario": {"beta": -0.0}})
    assert first.to_dict() == second.to_dict()
    assert type(first.scenario.population_size) is int
    assert type(first.scenario.beta) is float
    assert str(first.scenario.beta) == "0.0"


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"scenario": {"populationSize": 50}}, "configuration.intervention.vaccines"),
        (
            {"scenario": {"populationSize": 50}, "intervention": {"vaccines": 51}},
            "configuration.intervention.vaccines",
        ),
        (
            {"scenario": {"days": 1}, "intervention": {"interventionDay": 2}},
            "configuration.intervention.interventionDay",
        ),
        (
            {"scenario": {"origin": {"kind": "node", "value": 1000}}},
            "configuration.scenario.origin.value",
        ),
        ({"scenario": {"origin": {"kind": "node"}}}, "configuration.scenario.origin.value"),
        (
            {"scenario": {"origin": {"kind": "market", "value": 1}}},
            "configuration.scenario.origin.value",
        ),
    ],
)
def test_related_fields_and_origin_reject_invalid_values(payload: dict, field: str) -> None:
    with pytest.raises(ConfigurationError) as caught:
        normalize_configuration(payload)
    assert caught.value.status_code == 422
    assert caught.value.code == "VALIDATION_ERROR"
    assert field in {issue.path for issue in caught.value.fields}


def test_errors_include_all_related_violations_in_stable_order() -> None:
    payload = {
        "scenario": {"populationSize": 50, "days": 1, "origin": {"kind": "node", "value": 50}},
        "intervention": {"vaccines": 51, "interventionDay": 2},
    }
    with pytest.raises(ConfigurationError) as caught:
        normalize_configuration(payload)
    paths = [issue.path for issue in caught.value.fields]
    assert paths == [
        "configuration.intervention.interventionDay",
        "configuration.intervention.vaccines",
        "configuration.scenario.origin.value",
    ]


@pytest.mark.parametrize(
    "payload",
    [
        None,
        [],
        True,
        "configuration",
        {"scenario": None},
        {"network": []},
        {"scenario": {"populationSize": True}},
        {"rootSeed": False},
        {"scenario": {"beta": True}},
        {"scenario": {"beta": "0.08"}},
        {"scenario": {"beta": 1.01}},
        {"scenario": {"beta": float("nan")}},
        {"scenario": {"sigma": float("inf")}},
        {"network": {"weights": {"bus": -float("inf")}}},
        {"repetitions": 1},
        {"repetitions": 31},
        {"rootSeed": 2**32},
        {"policies": ["none", "none", "targeted"]},
        {"policies": ["none", "random"]},
        {"scenario": {"days": 1.5}},
        {"network": {"dayZero": "sunday"}},
        {"scenario": {"initialInfectious": 21}},
    ],
)
def test_invalid_shapes_types_and_ranges_are_rejected(payload: object) -> None:
    with pytest.raises(ConfigurationError) as caught:
        normalize_configuration(payload)
    assert caught.value.status_code == 422
    assert caught.value.code == "VALIDATION_ERROR"
    assert caught.value.fields


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"unexpected": "do-not-echo-secret"}, "configuration.unexpected"),
        ({"scenario": {"btea": 0.5}}, "configuration.scenario.btea"),
        ({"network": {"weights": {"airport": 1}}}, "configuration.network.weights.airport"),
    ],
)
def test_unknown_fields_have_distinct_error_and_do_not_echo_values(
    payload: dict, field: str
) -> None:
    with pytest.raises(ConfigurationError) as caught:
        normalize_configuration(payload)
    assert caught.value.status_code == 400
    assert caught.value.code == "UNKNOWN_FIELD"
    assert field in {issue.path for issue in caught.value.fields}
    assert "do-not-echo-secret" not in str(caught.value)
    assert all("do-not-echo-secret" not in issue.reason for issue in caught.value.fields)


@pytest.mark.parametrize("population", [50, 2000])
def test_inclusive_related_boundaries_are_valid(population: int) -> None:
    result = normalize_configuration(
        {
            "rootSeed": 2**32 - 1,
            "repetitions": 2,
            "scenario": {
                "populationSize": population,
                "days": 180,
                "initialInfectious": 20,
                "origin": {"kind": "node", "value": population - 1},
                "beta": 1,
                "sigma": 0,
                "gamma": 1,
            },
            "intervention": {"vaccines": population, "interventionDay": 180, "vaccineEfficacy": 0},
        }
    )
    assert result.intervention.vaccines == population
    assert result.scenario.origin.value == population - 1


def test_zero_resources_and_day_zero_are_preserved() -> None:
    result = normalize_configuration(
        {"rootSeed": 0, "intervention": {"vaccines": 0, "interventionDay": 0, "vaccineEfficacy": 0}}
    )
    assert result.root_seed == 0
    assert result.intervention.vaccines == 0
    assert result.intervention.vaccine_efficacy == 0


def test_normalization_is_idempotent_and_independent_of_working_directory(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.chdir(tmp_path)
    result = normalize_configuration({"scenario": {"origin": {}}})
    assert normalize_configuration(result.to_dict()) == result


def test_preview_and_compare_requests_have_typed_configuration() -> None:
    preview = parse_request('{"schemaVersion":"1.0"}', operation="preview")
    assert preview.schema_version == "1.0"
    assert preview.configuration.scenario.population_size == 1000
    request = (SCHEMAS / "examples/compare-request.json").read_bytes()
    compare = parse_request(request, operation="compare")
    assert compare.expected_graph_hash == "sha256:" + "a" * 64
    assert compare.include_representative_frames is True
    assert compare.configuration.scenario.population_size == 50


@pytest.mark.parametrize(
    "body",
    [
        b"\xff",
        "{",
        "",
        '{"schemaVersion":"1.0","configuration":{"rootSeed":NaN}}',
        '{"schemaVersion":"1.0","configuration":{"rootSeed":Infinity}}',
        '{"schemaVersion":"1.0","configuration":{"rootSeed":1e999}}',
        '{"schemaVersion":"1.0","schemaVersion":"2.0"}',
        '{"schemaVersion":"1.0","configuration":{"scenario":{"beta":0,"beta":1}}}',
    ],
)
def test_request_parser_rejects_invalid_json_and_duplicate_keys(body: str | bytes) -> None:
    with pytest.raises(ConfigurationError) as caught:
        parse_request(body)
    assert caught.value.code == "INVALID_JSON"
    assert caught.value.status_code == 400


@pytest.mark.parametrize(
    "body",
    ["[]", "null", '{"schemaVersion":"2.0"}', "{}", '{"schemaVersion":"1.0","configuration":null}'],
)
def test_well_formed_json_with_invalid_request_shape_is_422(body: str) -> None:
    with pytest.raises(ConfigurationError) as caught:
        parse_request(body)
    assert caught.value.code == "VALIDATION_ERROR"
    assert caught.value.status_code == 422


def test_request_parser_enforces_root_fields_compare_hash_and_flag() -> None:
    with pytest.raises(ConfigurationError) as caught:
        parse_request('{"schemaVersion":"1.0","unexpected":1}')
    assert caught.value.code == "UNKNOWN_FIELD"
    assert caught.value.fields[0].path == "unexpected"
    with pytest.raises(ConfigurationError) as caught:
        parse_request('{"schemaVersion":"1.0"}', operation="compare")
    assert caught.value.code == "VALIDATION_ERROR"
    assert {issue.path for issue in caught.value.fields} == {
        "expectedGraphHash",
        "includeRepresentativeFrames",
    }


def test_request_size_is_measured_in_utf8_bytes_with_inclusive_limit() -> None:
    body = '{"schemaVersion":"1.0"}'
    assert parse_request(body, max_request_bytes=len(body.encode())).schema_version == "1.0"
    with pytest.raises(ConfigurationError) as caught:
        parse_request(body + " ", max_request_bytes=len(body.encode()))
    assert caught.value.code == "REQUEST_TOO_LARGE"
    assert caught.value.status_code == 413


def test_default_request_limit_is_exactly_64_kib() -> None:
    base = '{"schemaVersion":"1.0"}'
    body = base + " " * (65536 - len(base))
    assert parse_request(body).schema_version == "1.0"
    with pytest.raises(ConfigurationError) as caught:
        parse_request(body + " ")
    assert caught.value.status_code == 413


@pytest.mark.parametrize("kind", ["random", "household", "school", "bus", "market", "neighborhood"])
def test_context_origin_remains_valid_without_querying_a_graph(kind: str) -> None:
    result = normalize_configuration({"scenario": {"origin": {"kind": kind}}})
    assert result.scenario.origin.kind == kind
    assert result.scenario.origin.value is None


def test_domain_imports_with_bundled_schema_outside_the_checkout(tmp_path: Path) -> None:
    source = Path(__file__).resolve().parents[1] / "src/domain"
    shutil.copytree(source, tmp_path / "domain", ignore=shutil.ignore_patterns("__pycache__"))
    bundled = tmp_path / "schemas"
    bundled.mkdir()
    shutil.copyfile(SCHEMAS / "common.schema.json", bundled / "common.schema.json")
    script = (
        "import sys; sys.path.insert(0, sys.argv[1]); "
        "from domain.configuration import normalize_configuration; "
        "assert normalize_configuration().scenario.population_size == 1000"
    )
    subprocess.run([sys.executable, "-I", "-c", script, str(tmp_path)], check=True, cwd=tmp_path)


def test_deep_json_is_rejected_without_escaping_as_recursion_error() -> None:
    body = (
        '{"schemaVersion":"1.0","configuration":{"unexpected":' + "[" * 600 + "0" + "]" * 600 + "}}"
    )
    with pytest.raises(ConfigurationError) as caught:
        parse_request(body)
    assert caught.value.status_code in (400, 422)
    # Dos bytes por carácter; se rechaza por tamaño antes de JSON/forma.
    with pytest.raises(ConfigurationError) as caught:
        parse_request("é" * 10, max_request_bytes=10)
    assert caught.value.status_code == 413
