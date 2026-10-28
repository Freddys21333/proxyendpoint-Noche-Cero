"""Rendimiento: conservar aceptación/rechazo del validador de referencia."""

import copy
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from domain.configuration import _definitions, validate_contract

DEFINITIONS = json.loads(
    (Path(__file__).resolve().parents[2] / "schemas/common.schema.json").read_text(encoding="utf-8")
)["$defs"]


@pytest.mark.parametrize(
    "days",
    [
        [],
        [0],
        [0, 1, 180],
        [True],
        [False, 1],
        [0, 181],
        [-1],
        [1, 1],
        [1, 1.0],
        [1.0],
        ["1"],
        [None],
        list(range(182)),
    ],
)
def test_edge_days_match_reference_including_float_integer_semantics(days):
    edge = {"id": 0, "u": 0, "v": 1, "context": "household", "weight": 1, "activeDays": days}
    original = copy.deepcopy(edge)
    reference = Draft202012Validator({"$defs": DEFINITIONS, "$ref": "#/$defs/Edge"})
    if reference.is_valid(edge):
        validate_contract(edge, "Edge")
    else:
        with pytest.raises(ValueError):
            validate_contract(edge, "Edge")
    assert edge == original


def test_calendar_fast_validation_must_still_reject_other_edge_errors():
    edge = {"id": 0, "u": 0, "v": 1, "context": "household", "weight": 1, "activeDays": [0, 1, 2]}
    for field, value in [("weight", -1), ("unexpected", 1), ("context", "invented"), ("u", True)]:
        changed = {**edge, field: value}
        with pytest.raises(ValueError):
            validate_contract(changed, "Edge")


@pytest.mark.parametrize("state", ["S", "E", "I", "R", "", "Z", 1, True, None, {"state": "S"}])
def test_frame_state_and_reference_resolution_match_original_contract(state):
    frame = ["S"] * 50
    frame[0] = state
    document = {
        "index": 0,
        "initialSeed": {"rootSeed": 42, "replicateIndex": 0, "domain": "initial"},
        "frames": {policy: [frame, frame] for policy in ("none", "random", "targeted")},
    }
    reference = Draft202012Validator({"$defs": DEFINITIONS, "$ref": "#/$defs/Representative"})
    if reference.is_valid(document):
        validate_contract(document, "Representative")
    else:
        with pytest.raises(ValueError):
            validate_contract(document, "Representative")


def test_frame_lengths_and_shared_schema_are_not_changed_by_optimization():
    snapshot = copy.deepcopy(_definitions())
    for size in (49, 50, 2000, 2001):
        document = {
            "index": 0,
            "initialSeed": {"rootSeed": 42, "replicateIndex": 0, "domain": "initial"},
            "frames": {policy: [["S"] * size] * 2 for policy in ("none", "random", "targeted")},
        }
        if 50 <= size <= 2000:
            validate_contract(document, "Representative")
        else:
            with pytest.raises(ValueError):
                validate_contract(document, "Representative")
    assert _definitions() == snapshot


@pytest.mark.parametrize("value", [-1, 0, 1999, 2000, True, False, 1.0, 0.5, "1", None])
def test_integer_properties_remain_equivalent_with_bounds_and_non_native_values(value):
    edge = {"id": 0, "u": value, "v": 1, "context": "household", "weight": 1, "activeDays": [0]}
    reference = Draft202012Validator({"$defs": DEFINITIONS, "$ref": "#/$defs/Edge"})
    if reference.is_valid(edge):
        validate_contract(edge, "Edge")
    else:
        with pytest.raises(ValueError):
            validate_contract(edge, "Edge")


def test_required_and_extra_properties_still_checked_with_native_integers():
    edge = {"id": 0, "u": 0, "v": 1, "context": "household", "weight": 1, "activeDays": [0]}
    del edge["u"]
    with pytest.raises(ValueError):
        validate_contract(edge, "Edge")
    edge["u"] = 0
    edge["extra"] = 0
    with pytest.raises(ValueError):
        validate_contract(edge, "Edge")


@pytest.mark.parametrize(
    "field,value",
    [
        ("weight", 0),
        ("weight", 0.5),
        ("weight", 1),
        ("weight", -0.01),
        ("weight", 1.01),
        ("weight", True),
        ("weight", "0.5"),
        ("weight", 10**400),
        ("context", "school"),
        ("context", "invalid"),
        ("context", None),
        ("context", 1),
    ],
)
def test_flat_number_and_enum_properties_match_reference(field, value):
    edge = {"id": 0, "u": 0, "v": 1, "context": "household", "weight": 1, "activeDays": [0]}
    edge[field] = value
    reference = Draft202012Validator({"$defs": DEFINITIONS, "$ref": "#/$defs/Edge"})
    if reference.is_valid(edge):
        validate_contract(edge, "Edge")
    else:
        with pytest.raises(ValueError):
            validate_contract(edge, "Edge")
