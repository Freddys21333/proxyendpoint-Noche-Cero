"""T-11: integración real de handlers Lambda, motor y contratos."""

import base64
import gzip
import json

import pytest

from api.health import handler as health
from domain.configuration import validate_contract


def event(path, method="GET", body=None):
    return dict(
        version="2.0",
        rawPath="/v1" + path,
        requestContext=dict(http=dict(method=method)),
        body=body,
        isBase64Encoded=False,
    )


def decode(response):
    if response.get("isBase64Encoded"):
        assert response["headers"]["Content-Encoding"] == "gzip"
        data = base64.b64decode(response["body"])
        assert data[4:8] == b"\x00" * 4
        return json.loads(gzip.decompress(data))
    return json.loads(response["body"])


def test_health_real_metadata_and_contract(monkeypatch):
    monkeypatch.setenv("BUILD_COMMIT", "test-commit")
    monkeypatch.setenv("AWS_REGION", "us-east-2")
    response = health(event("/health"), None)
    assert response["statusCode"] == 200
    result = decode(response)
    validate_contract(result, "HealthResponse")
    assert result["buildCommit"] == "test-commit" and result["region"] == "us-east-2"


CONFIG = {
    "scenario": {"populationSize": 50, "days": 3},
    "intervention": {"vaccines": 10},
    "repetitions": 2,
}


def preview():
    from api.preview import handler

    return handler(
        event(
            "/scenarios/preview",
            "POST",
            json.dumps(dict(schemaVersion="1.0", configuration=CONFIG)),
        ),
        None,
    )


def compare_request(graph_hash, frames=False):
    return event(
        "/simulations/compare",
        "POST",
        json.dumps(
            dict(
                schemaVersion="1.0",
                configuration=CONFIG,
                expectedGraphHash=graph_hash,
                includeRepresentativeFrames=frames,
            )
        ),
    )


def test_config_defaults_limits_and_contract():
    from api.config import handler

    response = handler(event("/config"), None)
    assert response["statusCode"] == 200
    payload = decode(response)
    validate_contract(payload, "ConfigResponse")
    assert payload["defaults"]["rootSeed"] == 20261026
    assert payload["limits"]["maxEdges"] == 100000
    assert payload["features"]["asyncJobs"] is False


def test_staging_profile_publishes_explicit_defaults_and_rejects_excess(monkeypatch):
    from api.compare import handler as compare
    from api.config import handler as config

    monkeypatch.setenv("DEPLOYMENT_PROFILE", "staging-bounded-v1")
    defaults = decode(config(event("/config"), None))["defaults"]
    assert defaults["scenario"]["populationSize"] == 300
    assert defaults["scenario"]["days"] == 30
    assert defaults["repetitions"] == 30
    graph_hash = decode(preview())["graphHash"]
    monkeypatch.setenv("MAX_SYNC_EDGE_DAY_REPLICATES", "1")
    response = compare(compare_request(graph_hash), None)
    assert response["statusCode"] == 422
    assert "síncrono" in decode(response)["error"]["message"]


@pytest.mark.parametrize("frames", [False, True])
def test_preview_compare_real_schema_and_reproduction(frames):
    from api.compare import handler
    from simulation.exports import reproduce

    response = preview()
    assert response["statusCode"] == 200
    network = decode(response)
    validate_contract(network, "PreviewResponse")
    response = handler(compare_request(network["graphHash"], frames), None)
    assert response["statusCode"] == 200
    result = decode(response)
    validate_contract(result, "CompareResponse")
    assert result["graphHash"] == network["graphHash"]
    assert result["progress"]["replicatesSucceeded"] == 2
    assert reproduce(result) == result["manifest"]["experimentHash"]


@pytest.mark.parametrize(
    "body,status,code",
    [
        ('{"schemaVersion":"1.0","x":1}', 400, "UNKNOWN_FIELD"),
        ('{"schemaVersion":"1.0","schemaVersion":"1.0"}', 400, "INVALID_JSON"),
        ('{"schemaVersion":"1.0","configuration":{"scenario":{"beta":NaN}}}', 400, "INVALID_JSON"),
        ("{", 400, "INVALID_JSON"),
        (
            '{"schemaVersion":"1.0","configuration":{"scenario":{"populationSize":49}}}',
            422,
            "VALIDATION_ERROR",
        ),
    ],
)
def test_request_errors_are_contract_valid(body, status, code):
    from api.preview import handler

    response = handler(event("/scenarios/preview", "POST", body), None)
    assert response["statusCode"] == status
    assert response["isBase64Encoded"] is False
    assert "Content-Encoding" not in response["headers"]
    payload = decode(response)
    validate_contract(payload, "ErrorResponse")
    assert payload["error"]["code"] == code


def test_wrong_graph_hash_rejected_before_simulation(monkeypatch):
    from api import common
    from api.compare import handler

    def forbidden(*args, **kwargs):
        pytest.fail("wrong hash must not simulate")

    monkeypatch.setattr(common, "run_experiment", forbidden)
    response = handler(compare_request("sha256:" + "0" * 64), None)
    assert response["statusCode"] == 409
    assert decode(response)["error"]["code"] == "GRAPH_HASH_MISMATCH"


def test_policies_must_be_complete():
    from api.compare import handler

    request = compare_request("sha256:" + "0" * 64)
    body = json.loads(request["body"])
    body["configuration"]["policies"] = ["none", "targeted"]
    request["body"] = json.dumps(body)
    assert handler(request, None)["statusCode"] == 422


def test_base64_input_and_size_limit(monkeypatch):
    from api.preview import handler

    request = event(
        "/scenarios/preview", "POST", json.dumps(dict(schemaVersion="1.0", configuration=CONFIG))
    )
    request.update(body=base64.b64encode(request["body"].encode()).decode(), isBase64Encoded=True)
    assert handler(request, None)["statusCode"] == 200
    monkeypatch.setenv("MAX_REQUEST_BYTES", "20")
    response = handler(request, None)
    assert response["statusCode"] == 413
    assert decode(response)["error"]["code"] == "REQUEST_TOO_LARGE"


@pytest.mark.parametrize("body", ["%%%", "/w=="])
def test_invalid_base64_or_utf8(body):
    from api.preview import handler

    request = event("/scenarios/preview", "POST", body)
    request["isBase64Encoded"] = True
    assert handler(request, None)["statusCode"] == 400


@pytest.mark.parametrize(
    "variable,value,code",
    [
        ("MAX_EDGES", "1", "GRAPH_TOO_LARGE"),
        ("MAX_DECODED_RESPONSE_BYTES", "1000", "RESULT_TOO_LARGE"),
        ("MAX_RESPONSE_BYTES", "1024", "RESULT_TOO_LARGE"),
    ],
)
def test_preview_limits(monkeypatch, variable, value, code):
    monkeypatch.setenv(variable, value)
    response = preview()
    assert response["statusCode"] == 413
    assert decode(response)["error"]["code"] == code


def test_frame_limit_before_simulating(monkeypatch):
    from api.compare import handler

    graph_hash = decode(preview())["graphHash"]
    monkeypatch.setenv("MAX_FRAME_STATES", "1")
    response = handler(compare_request(graph_hash, True), None)
    assert response["statusCode"] == 413
    assert decode(response)["error"]["code"] == "FRAMES_TOO_LARGE"
    assert handler(compare_request(graph_hash, False), None)["statusCode"] == 200


def test_internal_error_sanitized(monkeypatch):
    from api import common

    def fail(*args, **kwargs):
        raise RuntimeError("secret-access-key")

    monkeypatch.setattr(common, "build_preview", fail)
    response = preview()
    assert response["statusCode"] == 500
    assert "secret-access-key" not in response["body"]
    validate_contract(decode(response), "ErrorResponse")


@pytest.mark.parametrize(
    "variable,value",
    [
        ("ENGINE_VERSION", "wrong"),
        ("SCHEMA_VERSION", "2.0"),
        ("MAX_EDGES", "invalid"),
        ("MAX_RESPONSE_BYTES", "1"),
    ],
)
def test_invalid_runtime_settings_unavailable(monkeypatch, variable, value):
    monkeypatch.setenv(variable, value)
    response = health(event("/health"), None)
    assert response["statusCode"] == 503
    assert decode(response)["error"]["code"] == "COMPUTE_UNAVAILABLE"


def test_wrong_route_and_http_method():
    assert health(event("/missing"), None)["statusCode"] == 404
    assert health(event("/health", "POST"), None)["statusCode"] == 404


def test_compare_never_returns_partial_success(monkeypatch):
    from api import common
    from api.compare import handler

    graph_hash = decode(preview())["graphHash"]
    actual = common.run_experiment

    def partial(*args, **kwargs):
        result = actual(*args, **kwargs)
        result["progress"]["replicatesSucceeded"] = 1
        return result

    monkeypatch.setattr(common, "run_experiment", partial)
    response = handler(compare_request(graph_hash), None)
    assert response["statusCode"] == 500
    payload = decode(response)
    assert payload["error"]["code"] == "SIMULATION_FAILED"
    assert "recommendation" not in payload


def test_insufficient_lambda_time_and_context_id():
    from api.preview import handler

    class Context:
        aws_request_id = "lambda-request-test"

        def get_remaining_time_in_millis(self):
            return 500

    response = handler(event("/scenarios/preview", "POST", '{"schemaVersion":"1.0"}'), Context())
    assert response["statusCode"] == 503
    assert decode(response)["requestId"] == "lambda-request-test"


def test_error_details_fit_response_cap(monkeypatch):
    from api.preview import handler
    from domain.reproducibility import canonical_json

    monkeypatch.setenv("MAX_RESPONSE_BYTES", "1024")
    body = json.dumps({"schemaVersion": "1.0", **{("field" + str(i)) * 20: 0 for i in range(30)}})
    response = handler(event("/scenarios/preview", "POST", body), None)
    assert response["statusCode"] == 400
    assert len(canonical_json(response)) <= 1024
    assert len(json.dumps(response, ensure_ascii=True).encode()) <= 1024
    validate_contract(decode(response), "ErrorResponse")


def test_request_limit_counts_utf8_bytes():
    from api.preview import handler

    body = json.dumps({"schemaVersion": "1.0", "unknown": "ñ" * 40000}, ensure_ascii=False)
    response = handler(event("/scenarios/preview", "POST", body), None)
    assert response["statusCode"] == 413
    assert decode(response)["error"]["code"] == "REQUEST_TOO_LARGE"


def test_same_graph_with_changed_vaccine_budget():
    from api.compare import handler

    graph_hash = decode(preview())["graphHash"]
    request = compare_request(graph_hash)
    body = json.loads(request["body"])
    body["configuration"]["intervention"]["vaccines"] = 0
    request["body"] = json.dumps(body)
    response = handler(request, None)
    assert response["statusCode"] == 200
    result = decode(response)
    assert result["configuration"]["intervention"]["vaccines"] == 0
    for rep in result["replicates"]:
        assert rep["policies"]["none"]["daily"] == rep["policies"]["targeted"]["daily"]


def test_malformed_http_event_and_base64_flag():
    from api.preview import handler

    malformed = event("/health")
    malformed["requestContext"] = None
    assert health(malformed, None)["statusCode"] == 400
    request = event("/scenarios/preview", "POST", '{"schemaVersion":"1.0"}')
    request["isBase64Encoded"] = "false"
    assert handler(request, None)["statusCode"] == 400


def test_structured_logs_do_not_include_request_body(caplog):
    response = preview()
    assert response["statusCode"] == 200
    records = [
        json.loads(record.message) for record in caplog.records if record.name == "api.common"
    ]
    assert records[-1]["populationSize"] == 50
    assert records[-1]["repetitions"] == 2
    assert records[-1]["phase"] == "preview"
    assert "rootSeed" not in caplog.text
    assert "activeDays" not in caplog.text
