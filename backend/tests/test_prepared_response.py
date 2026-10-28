"""Reusar JSON validado conserva transporte, hashes y límites."""

import base64
import gzip
import json

import pytest

from api import common
from domain.configuration import normalize_configuration
from domain.errors import ConfigurationError
from domain.reproducibility import canonical_json
from simulation.experiments import run_experiment
from simulation.exports import prepare_experiment


def test_prepared_export_matches_body_and_response_without_mutating_input():
    result = run_experiment(
        normalize_configuration(
            {
                "scenario": {"populationSize": 50, "days": 3},
                "intervention": {"vaccines": 3},
                "repetitions": 2,
            }
        )
    )
    before = canonical_json(result)
    prepared = prepare_experiment(result, request_id="prepared-test")
    assert prepared.json_body == canonical_json(prepared.document)
    assert canonical_json(result) == before
    normal = common._response(prepared.document, 200, True, common.DEFAULT_LIMITS)
    reused = common._response(
        prepared.document, 200, True, common.DEFAULT_LIMITS, serialized_body=prepared.json_body
    )
    assert normal == reused
    assert json.loads(gzip.decompress(base64.b64decode(reused["body"]))) == prepared.document


@pytest.mark.parametrize("limit", ["maxDecodedResponseBytes", "maxResponseBytes"])
def test_prepared_body_obeys_the_same_transport_limits(limit):
    payload = {"value": "data" * 1000}
    limits = {**common.DEFAULT_LIMITS, limit: 1}
    for body in (None, canonical_json(payload)):
        with pytest.raises(ConfigurationError) as failure:
            common._response(payload, 200, True, limits, serialized_body=body)
        assert failure.value.status_code == 413


def test_compare_uses_prepared_body_without_second_serialization(monkeypatch):
    from test_api import compare_request, decode, preview

    from api.compare import handler

    graph = decode(preview())
    original = common.canonical_json

    def serialize(payload):
        if "replicates" in payload:
            raise AssertionError("La respuesta completa se serializó dos veces.")
        return original(payload)

    monkeypatch.setattr(common, "canonical_json", serialize)
    response = handler(compare_request(graph["graphHash"], True), None)
    assert response["statusCode"] == 200
    assert decode(response)["progress"]["replicatesSucceeded"] == 2
