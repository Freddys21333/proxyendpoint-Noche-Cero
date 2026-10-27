"""P-03: gestor, acceso, idempotencia, cola y terminales estables."""

import json
import threading
import time
from dataclasses import replace

import pytest

import simulation.experiments as experiments
import simulation.jobs as jobs
from domain.configuration import normalize_configuration, parse_request, validate_contract
from domain.errors import ConfigurationError
from domain.reproducibility import canonical_json, json_hash
from simulation.experiments import run_experiment
from simulation.exports import export_experiment, reproduce
from simulation.jobs import LocalJobManager
from simulation.network import generate_graph


def config(repetitions=2):
    return normalize_configuration(
        {
            "scenario": {"populationSize": 50, "days": 1, "beta": 0},
            "intervention": {"vaccines": 5},
            "repetitions": repetitions,
        },
        for_jobs=True,
    )


def wait(job):
    deadline = time.monotonic() + 15
    while job.status not in jobs.TERMINAL and time.monotonic() < deadline:
        time.sleep(0.01)
    assert job.status in jobs.TERMINAL
    return job


@pytest.fixture
def manager():
    instance = LocalJobManager(max_concurrent=1)
    yield instance
    instance.close()


def submit(manager, cfg=None, **kwargs):
    cfg = config() if cfg is None else cfg
    graph = generate_graph(cfg)
    return manager.create_job(cfg, json_hash(graph), graph=graph, **kwargs)


def test_completed_job_matches_sync_and_reproduces_above_thirty(manager):
    cfg = config(31)
    job = wait(submit(manager, cfg))
    assert job.status == "completed", job.error_message
    assert job.replicates_completed == 31 and job.replicates_failed == 0
    assert job.result is not None
    expected = export_experiment(run_experiment(cfg, include_representative_frames=False))
    assert job.result["manifest"]["experimentHash"] == expected["manifest"]["experimentHash"]
    assert reproduce(job.result) == expected["manifest"]["experimentHash"]
    assert [r["index"] for r in job.manifest["replicates"]] == list(range(31))
    assert len({tuple(r["initialSeedEntropy"]) for r in job.manifest["replicates"]}) == 31


def test_request_limits_are_separate_and_json_stays_strict():
    wire = config(31).to_dict()
    body = json.dumps(
        dict(schemaVersion="1.0", configuration=wire, expectedGraphHash="sha256:" + "a" * 64)
    )
    assert parse_request(body, operation="jobs").configuration.repetitions == 31
    with pytest.raises(ConfigurationError):
        normalize_configuration(wire)
    with pytest.raises(ConfigurationError):
        normalize_configuration({**wire, "repetitions": 101}, for_jobs=True)
    for body in ['{"schemaVersion":"1.0","schemaVersion":"1.0"}', '{"configuration":{"beta":NaN}}']:
        with pytest.raises(ConfigurationError) as error:
            parse_request(body, operation="jobs")
        assert error.value.code == "INVALID_JSON"


def test_idempotency_scope_conflict_capacity_and_no_secret_storage(manager):
    job = submit(manager, capability="secret", idempotency_key="once", auto_start=False)
    assert submit(manager, capability="secret", idempotency_key="once", auto_start=False) is job
    with pytest.raises(ConfigurationError) as error:
        submit(
            manager,
            replace(config(), root_seed=123),
            capability="secret",
            idempotency_key="once",
            auto_start=False,
        )
    assert error.value.code == "IDEMPOTENCY_CONFLICT"
    other = submit(manager, capability="other", idempotency_key="once", auto_start=False)
    assert other.job_id != job.job_id
    assert job.capability_hash != "secret"
    assert "secret" not in json.dumps(manager.snapshot(job.job_id, "secret"))
    with pytest.raises(ConfigurationError) as error:
        manager.snapshot(job.job_id, "wrong")
    assert error.value.code == "JOB_NOT_FOUND"
    with pytest.raises(ConfigurationError) as error:
        manager.result(job.job_id, "secret")
    assert error.value.code == "JOB_NOT_READY"


def test_queue_capacity_and_retention():
    manager = LocalJobManager(max_jobs=1)
    try:
        job = submit(manager, auto_start=False, capability="secret", idempotency_key="one")
        assert submit(manager, auto_start=False, capability="secret", idempotency_key="one") is job
        with pytest.raises(ConfigurationError) as error:
            submit(manager, auto_start=False)
        assert error.value.code == "COMPUTE_UNAVAILABLE"
        assert manager.cancel_job(job.job_id)
        job._finished_at = time.monotonic() - 3601
        with pytest.raises(ConfigurationError):
            manager.snapshot(job.job_id, "secret")
        assert (
            submit(manager, auto_start=False, capability="secret", idempotency_key="one").job_id
            != job.job_id
        )
    finally:
        manager.close()


def test_cancelled_pending_job_cannot_restart(manager):
    job = submit(manager, auto_start=False)
    assert manager.cancel_job(job.job_id)
    assert not manager.cancel_job(job.job_id)
    manager._run_job(job)
    assert job.status == "cancelled" and job.replicates_completed == 0 and job.result is None


def test_worker_limit_and_cancelled_queue_do_not_execute(manager, monkeypatch):
    started, release = threading.Event(), threading.Event()
    original = jobs.run_experiment
    calls = []

    def blocked(*args, **kwargs):
        calls.append(1)
        started.set()
        assert release.wait(10)
        return original(*args, **kwargs)

    monkeypatch.setattr(jobs, "run_experiment", blocked)
    try:
        first = submit(manager)
        assert started.wait(5)
        second = submit(manager)
        assert second.status == "pending" and len(calls) == 1
        assert manager.cancel_job(second.job_id)
        release.set()
        assert wait(first).status == "completed"
        manager.close()
        assert second.status == "cancelled" and len(calls) == 1
    finally:
        release.set()


def test_cancel_during_aggregation_never_publishes_result(manager, monkeypatch):
    started, release = threading.Event(), threading.Event()
    original = jobs.export_experiment

    def blocked(*args, **kwargs):
        started.set()
        assert release.wait(10)
        return original(*args, **kwargs)

    monkeypatch.setattr(jobs, "export_experiment", blocked)
    try:
        job = submit(manager)
        assert started.wait(8)
        assert job.status == "aggregating" and job.replicates_completed == 2
        assert manager.cancel_job(job.job_id)
        release.set()
        manager.close()
        assert job.status == "cancelled" and job.result is None
    finally:
        release.set()


def test_retry_recomputes_same_index_without_double_count(manager, monkeypatch):
    original = experiments.simulate_paired
    attempted = False

    def transient(*args, **kwargs):
        nonlocal attempted
        if kwargs.get("replicate_index") == 0 and not attempted:
            attempted = True
            raise RuntimeError("temporary")
        return original(*args, **kwargs)

    monkeypatch.setattr(experiments, "simulate_paired", transient)
    job = wait(submit(manager))
    assert attempted and job.status == "completed" and job.replicates_completed == 2
    assert job.replicates_failed == 0 and job._completed == {0, 1}
    assert job.result is not None
    assert reproduce(job.result) == job.result["manifest"]["experimentHash"]


def test_failure_is_terminal_sanitized_and_has_no_result(manager, monkeypatch):
    def failure(*args, **kwargs):
        raise RuntimeError("private data must not escape")

    monkeypatch.setattr(experiments, "simulate_paired", failure)
    job = wait(submit(manager))
    assert job.status == "failed" and job.replicates_failed == 1
    assert job.error_message == "SIMULATION_FAILED" and job.result is None
    assert not manager.cancel_job(job.job_id)
    snapshot = manager.snapshot(job.job_id, "")
    assert "private" not in json.dumps(snapshot)
    validate_contract(
        {**snapshot, "engineVersion": "0.1.0", "requestId": "test"}, "JobStatusResponse"
    )


def test_status_snapshot_is_detached_from_store(manager):
    job = submit(manager, auto_start=False)
    snapshot = manager.snapshot(job.job_id, "")
    snapshot["manifest"]["replicates"].clear()
    assert len(job.manifest["replicates"]) == 2
    assert canonical_json(snapshot) != canonical_json(manager.snapshot(job.job_id, ""))


def test_job_with_reversed_replica_order_matches_sequential_result(manager, monkeypatch):
    original = jobs.run_experiment

    def reversed_order(configuration, **kwargs):
        return original(
            configuration,
            replicate_order=tuple(reversed(range(configuration.repetitions))),
            **kwargs,
        )

    monkeypatch.setattr(jobs, "run_experiment", reversed_order)
    cfg = config(3)
    job = wait(submit(manager, cfg))
    assert job.status == "completed" and job.result is not None
    expected = export_experiment(run_experiment(cfg, include_representative_frames=False))
    assert job.result["manifest"]["experimentHash"] == expected["manifest"]["experimentHash"]
    assert job._completed == {0, 1, 2}
    assert job.manifest["runtimeVersions"]["engineVersion"] == job.result["engineVersion"]


def test_queued_job_refuses_changed_runtime(manager, monkeypatch):
    job = submit(manager, auto_start=False)
    versions = {**job.manifest["runtimeVersions"], "engineVersion": "999.0.0"}
    monkeypatch.setattr(jobs, "runtime_versions", lambda: versions)
    manager._run_job(job)
    assert job.status == "failed" and job.replicates_completed == 0
    assert job.replicates_failed == 0  # Falló runtime, no una réplica ejecutada.
    assert job.result is None and job.error_message == "SIMULATION_FAILED"
