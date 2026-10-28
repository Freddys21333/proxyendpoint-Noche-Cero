"""Atajo de registros: aceptación estricta y respaldo para esquemas no soportados."""

import copy

import pytest
from jsonschema import Draft202012Validator

from domain import configuration as cfg


@pytest.mark.parametrize("value", [0, 1, 180, -1, 181, True, False, 1.0, "1", None])
def test_record_checker_accepts_only_native_valid_integers(value):
    schema = {
        "type": "object",
        "properties": {"day": {"type": "integer", "minimum": 0, "maximum": 180}},
        "required": ["day"],
        "additionalProperties": False,
    }
    check = cfg._record_checker(schema)
    assert check is not None
    assert check({"day": value}) == (type(value) is int and 0 <= value <= 180)
    assert not check({})
    assert not check({"day": 0, "extra": 1})
    wrapper = {"type": "array", "items": schema}
    assert cfg._ResultValidator(wrapper).is_valid([{"day": value}]) == Draft202012Validator(
        wrapper
    ).is_valid([{"day": value}])


@pytest.mark.parametrize("days", [[0, 1], [], [1, 1], [True], [1.0], [181], ["1"], None])
def test_record_array_and_fallback_match_reference(days):
    schema = {
        "type": "object",
        "properties": {
            "days": {
                "type": "array",
                "items": {"type": "integer", "minimum": 0, "maximum": 180},
                "minItems": 1,
                "maxItems": 181,
                "uniqueItems": True,
            }
        },
        "required": ["days"],
        "additionalProperties": False,
    }
    document = [{"days": days}]
    before = copy.deepcopy(document)
    wrapper = {"type": "array", "items": schema}
    assert cfg._ResultValidator(wrapper).is_valid(document) == Draft202012Validator(
        wrapper
    ).is_valid(document)
    assert document == before


@pytest.mark.parametrize(
    "extra",
    [
        {"allOf": [{"maxProperties": 0}]},
        {"minProperties": 2},
        {"$id": "https://example.invalid/schema"},
    ],
)
def test_unrecognized_object_constraints_disable_shortcut(extra):
    schema = {
        "type": "object",
        "properties": {"day": {"type": "integer"}},
        "required": ["day"],
        "additionalProperties": False,
        **extra,
    }
    assert cfg._record_checker(schema) is None


def test_unsupported_optional_property_falls_back_only_when_present():
    schema = {
        "type": "object",
        "properties": {"day": {"type": "integer"}, "code": {"type": "string", "pattern": "^ok$"}},
        "required": ["day"],
        "additionalProperties": False,
    }
    check = cfg._record_checker(schema)
    assert check is not None and check({"day": 0})
    assert not check({"day": 0, "code": "bad"})
    assert not check({"day": 0, "code": "ok"})  # Respaldo estándar, sin aceptar patrón por atajo.
