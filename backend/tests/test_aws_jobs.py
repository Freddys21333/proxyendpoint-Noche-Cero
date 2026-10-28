"""P-04: SDK real contra emulación local; no acredita ejecución en AWS."""

import copy
import json
import time

import boto3
import pytest
from moto import mock_aws

from domain.configuration import normalize_configuration, validate_contract
from domain.errors import ConfigurationError
from domain.reproducibility import json_hash
from simulation.aws_jobs import AwsJobs
from simulation.exports import reproduce
from simulation.network import generate_graph


class States:
    def __init__(self):
        self.started = []
        self.stopped = []

    def start_execution(self, **kwargs):
        self.started.append(kwargs)

    def describe_execution(self, **kwargs):
        return {"status": "RUNNING"}

    def stop_execution(self, **kwargs):
        self.stopped.append(kwargs)


@pytest.fixture
def repo():
    with mock_aws():
        db = boto3.client("dynamodb", region_name="us-east-2")
        db.create_table(
            TableName="jobs",
            KeySchema=[{"AttributeName": "pk", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "pk", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        s3 = boto3.client("s3", region_name="us-east-2")
        s3.create_bucket(
            Bucket="p04-jobs-test", CreateBucketConfiguration={"LocationConstraint": "us-east-2"}
        )
        yield AwsJobs(
            db,
            s3,
            States(),
            table="jobs",
            bucket="p04-jobs-test",
            state_machine="arn:aws:states:us-east-2:123456789012:stateMachine:jobs",
        )


def create(repo, key="idempotency-test-0001", repetitions=6):
    cfg = normalize_configuration(
        {
            "scenario": {"populationSize": 50, "days": 3},
            "intervention": {"vaccines": 10},
            "repetitions": repetitions,
        },
        for_aws_jobs=True,
    )
    graph = generate_graph(cfg)
    return repo.create(cfg.to_dict(), json_hash(graph), True, "a" * 64, key)


def test_durable_flow_retry_and_reproduction(repo):
    job = create(repo)
    assert create(repo) == job
    chunks = repo.prepare(job)["batches"]
    for chunk in reversed(chunks):
        repo.work(job, chunk["start"], chunk["indices"])
        repo.work(job, chunk["start"], chunk["indices"])
    snapshot = repo.snapshot(job, "a" * 64)
    assert snapshot["progress"]["replicatesCompleted"] == 6
    repo.aggregate(job)
    snapshot = repo.snapshot(job, "a" * 64)
    validate_contract(
        dict(schemaVersion="1.0", engineVersion="0.1.0", requestId="test", **snapshot),
        "JobStatusResponse",
    )
    assert snapshot["status"] == "completed"
    assert repo.item("LOCK") is None
    document = repo.get_json(f"jobs/{job}/result.json.gz")
    assert reproduce(document) == document["manifest"]["experimentHash"]
    assert repo.result(job, "a" * 64)["downloadUrl"].startswith("https://")


def test_lock_cancel_expiry_and_capability(repo):
    job = create(repo)
    with pytest.raises(ConfigurationError):
        create(repo, "another-idempotency-0001")
    with pytest.raises(ConfigurationError):
        repo.snapshot(job, "b" * 64)
    repo.cancel(job, "a" * 64)
    with pytest.raises(ValueError):
        repo.work(job, 0, list(range(5)))
    repo.finish(job, "completed")
    assert repo.snapshot(job, "a" * 64)["status"] == "cancelled"
    assert repo.states.stopped
    repo.db.update_item(
        TableName="jobs",
        Key={"pk": {"S": "JOB#" + job}},
        UpdateExpression="SET expires=:expiry",
        ExpressionAttributeValues={":expiry": {"N": str(int(time.time()) - 1)}},
    )
    with pytest.raises(ConfigurationError):
        repo.snapshot(job, "a" * 64)


def test_idempotency_conflict_and_daily_admission(repo):
    job = create(repo)
    with pytest.raises(ConfigurationError) as error:
        create(repo, repetitions=8)
    assert error.value.code == "IDEMPOTENCY_CONFLICT"
    repo.cancel(job, "a" * 64)
    for index in range(2):
        job = create(repo, f"another-idempotency-{index:04d}")
        repo.cancel(job, "a" * 64)
    with pytest.raises(ConfigurationError):
        create(repo, "fourth-idempotency-0001")


def test_http_transport_uses_durable_repository(repo, monkeypatch):
    import api.aws_jobs as endpoint

    monkeypatch.setattr(endpoint, "repository", lambda: repo)
    cfg = normalize_configuration(
        {
            "scenario": {"populationSize": 50, "days": 3},
            "intervention": {"vaccines": 10},
            "repetitions": 2,
        }
    )
    event = {
        "rawPath": "/v1/jobs",
        "requestContext": {"http": {"method": "POST"}},
        "headers": {"X-Job-Token": "a" * 64, "Idempotency-Key": "transport-idempotency-001"},
        "body": json.dumps(
            {
                "schemaVersion": "1.0",
                "configuration": cfg.to_dict(),
                "expectedGraphHash": json_hash(generate_graph(cfg)),
            }
        ),
    }
    response = endpoint.handler(event, None)
    assert response["statusCode"] == 202
    created = json.loads(response["body"])
    for chunk in repo.prepare(created["jobId"])["batches"]:
        repo.work(chunk["jobId"], chunk["start"], chunk["indices"])
    repo.aggregate(created["jobId"])
    status_event = {
        **event,
        "rawPath": f"/v1/jobs/{created['jobId']}",
        "requestContext": {"http": {"method": "GET"}},
    }
    status = endpoint.handler(status_event, None)
    assert json.loads(status["body"])["status"] == "completed"
    link = endpoint.handler({**status_event, "rawPath": status_event["rawPath"] + "/result"}, None)
    assert link["statusCode"] == 200
    assert json.loads(link["body"])["expiresIn"] == 300
    changed = copy.deepcopy(event)
    changed["headers"]["X-Job-Token"] = "invalid"
    assert endpoint.handler(changed, None)["statusCode"] == 422


def test_failed_execution_releases_lock_and_does_not_invent_failed_replicates(repo):
    job = create(repo)
    repo.states.describe_execution = lambda **kwargs: {"status": "TIMED_OUT"}
    result = repo.snapshot(job, "a" * 64)
    assert result["status"] == "failed"
    assert result["progress"] == {
        "replicatesTotal": 6,
        "replicatesCompleted": 0,
        "replicatesFailed": 0,
    }
    assert repo.item("LOCK") is None
