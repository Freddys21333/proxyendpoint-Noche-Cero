"""P-03: contratos HTTP reales en loopback y capacidad de acceso."""

import gzip
import json
import threading
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import pytest
from test_jobs import config

import api.common as common
from domain.configuration import validate_contract
from simulation.jobs import LocalJobManager


@pytest.fixture
def local_api(monkeypatch):
    import importlib.util
    from pathlib import Path

    path = Path(__file__).resolve().parents[2] / "scripts/serve_api.py"
    spec = importlib.util.spec_from_file_location("jobs_server", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    monkeypatch.setenv("LOCAL_JOBS_ENABLED", "1")
    manager = LocalJobManager(max_concurrent=1)
    monkeypatch.setattr(common, "GLOBAL_JOB_MANAGER", manager)
    server = module.create_server(port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}", manager
    server.shutdown()
    server.server_close()
    thread.join(5)
    manager.close()


def request(base, path, *, method="GET", body=None, token="a" * 64, key="one"):
    headers = {"X-Job-Token": token, "Idempotency-Key": key, "Content-Type": "application/json"}
    req = Request(
        base + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers=headers,
        method=method,
    )
    try:
        response = urlopen(req, timeout=15)
    except HTTPError as error:
        response = error
    with response:
        raw = response.read()
        if response.headers.get("Content-Encoding") == "gzip":
            raw = gzip.decompress(raw)
        return response.status, json.loads(raw)


def job_body(base):
    cfg = config().to_dict()
    status, preview = request(
        base,
        "/v1/scenarios/preview",
        method="POST",
        body=dict(schemaVersion="1.0", configuration=cfg),
    )
    assert status == 200
    return dict(
        schemaVersion="1.0",
        configuration=cfg,
        expectedGraphHash=preview["graphHash"],
        includeRepresentativeFrames=False,
    )


def test_http_create_poll_result_and_idempotent_cancel(local_api):
    base, _ = local_api
    status, configuration = request(base, "/v1/config")
    assert status == 200 and configuration["features"]["asyncJobs"] is True
    body = job_body(base)
    body["includeRepresentativeFrames"] = True
    status, created = request(base, "/v1/jobs", method="POST", body=body)
    assert status == 202, created
    validate_contract(created, "JobCreateResponse")
    status, duplicate = request(base, "/v1/jobs", method="POST", body=body)
    assert status == 202 and duplicate["jobId"] == created["jobId"]
    for _ in range(100):
        status, job = request(base, created["statusUrl"])
        assert status == 200
        validate_contract(job, "JobStatusResponse")
        assert "result" not in job
        if job["status"] in ("completed", "failed"):
            break
        time.sleep(0.02)
    assert job["status"] == "completed", job
    status, result = request(base, created["resultUrl"])
    assert status == 200
    validate_contract(result, "CompareResponse")
    assert result["representative"]["frames"] is not None
    status, sync = request(base, "/v1/simulations/compare", method="POST", body=body)
    assert status == 200
    assert sync["manifest"]["experimentHash"] == result["manifest"]["experimentHash"]
    for _ in range(2):
        status, cancelled = request(base, created["statusUrl"] + "/cancel", method="POST")
        assert status == 202 and cancelled["status"] == "completed"
        validate_contract(cancelled, "JobCancelResponse")
    assert "a" * 64 not in json.dumps(result)


def test_http_access_errors_conflict_and_limits(local_api):
    base, manager = local_api
    body = job_body(base)
    status, created = request(base, "/v1/jobs", method="POST", body=body)
    assert status == 202
    for suffix in ["", "/result", "/cancel"]:
        status, error = request(
            base,
            created["statusUrl"] + suffix,
            method="POST" if suffix == "/cancel" else "GET",
            token="b" * 64,
        )
        assert status == 404 and error["error"]["code"] == "JOB_NOT_FOUND"
    body["configuration"]["rootSeed"] += 1
    # The graph changes too: preview must be refreshed before testing idempotency conflict.
    from domain.configuration import normalize_configuration
    from domain.reproducibility import json_hash
    from simulation.network import generate_graph

    body["expectedGraphHash"] = json_hash(
        generate_graph(normalize_configuration(body["configuration"]))
    )
    status, error = request(base, "/v1/jobs", method="POST", body=body)
    assert status == 409 and error["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    body["configuration"]["repetitions"] = 101
    status, error = request(base, "/v1/jobs", method="POST", body=body, key="two")
    assert status == 422
    status, _ = request(base, "/v1/jobs", method="POST", body=body, token="")
    assert status == 422
    assert len(manager._jobs) == 1


def test_http_pending_result_and_repeated_cancel(local_api):
    base, manager = local_api
    from domain.reproducibility import json_hash
    from simulation.network import generate_graph

    cfg = config()
    job = manager.create_job(
        cfg, json_hash(generate_graph(cfg)), auto_start=False, capability="a" * 64
    )
    path = f"/v1/jobs/{job.job_id}"
    status, error = request(base, path + "/result")
    assert status == 409 and error["error"]["code"] == "JOB_NOT_READY"
    for _ in range(2):
        status, result = request(base, path + "/cancel", method="POST")
        assert status == 202 and result["status"] == "cancelled"
    assert job.replicates_completed == 0
