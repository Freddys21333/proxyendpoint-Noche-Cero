"""P-04: repositorio AWS durable; ningún cliente se crea al importar el módulo."""

import gzip
import hashlib
import hmac
import importlib
import json
import os
import time
import uuid
from datetime import UTC, datetime
from typing import Any, cast

from domain.configuration import normalize_configuration
from domain.errors import ConfigurationError
from domain.reproducibility import RNG_VERSION, canonical_json, json_hash, seed_entropy
from simulation.distributed import assemble, batch
from simulation.exports import (
    ENGINE_VERSION,
    MAX_DOCUMENT_BYTES,
    export_experiment,
    runtime_versions,
)
from simulation.network import generate_graph

TERMINAL = {"completed", "failed", "cancelled"}
MAX_REPETITIONS = 1000
MAX_WORK = 50_000_000
BATCH_SIZE = 5
RETENTION = 86400


def now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


class AwsJobs:
    """Accesos: GetItem por PK; transacciones admisión y progreso; sin Scan/GSI."""

    def __init__(
        self, dynamodb: Any, s3: Any, states: Any, *, table: str, bucket: str, state_machine: str
    ) -> None:
        self.db, self.s3, self.states = dynamodb, s3, states
        self.table, self.bucket, self.machine = table, bucket, state_machine

    def item(self, key: str) -> dict[str, Any] | None:
        return cast(
            dict[str, Any] | None,
            self.db.get_item(TableName=self.table, Key={"pk": {"S": key}}, ConsistentRead=True).get(
                "Item"
            ),
        )

    def put_json(self, key: str, document: Any, *, immutable: bool = False) -> None:
        self.s3.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=gzip.compress(canonical_json(document), mtime=0),
            ContentType="application/json",
            ContentEncoding="gzip",
            **({"IfNoneMatch": "*"} if immutable else {}),
        )

    def get_json(self, key: str) -> Any:
        response = self.s3.get_object(Bucket=self.bucket, Key=key)
        with gzip.GzipFile(fileobj=response["Body"]) as stream:
            raw = stream.read(MAX_DOCUMENT_BYTES + 1)
        if len(raw) > MAX_DOCUMENT_BYTES:
            raise ValueError("Artefacto demasiado grande.")
        return json.loads(raw)

    def record(self, job_id: str, token: str | None = None) -> dict[str, Any]:
        item = self.item("JOB#" + job_id)
        if not item or int(item["expires"]["N"]) <= time.time():
            raise ConfigurationError("JOB_NOT_FOUND", 404, "Trabajo no disponible.")
        if token is not None and not hmac.compare_digest(
            item["capability"]["S"], hashlib.sha256(token.encode()).hexdigest()
        ):
            raise ConfigurationError("JOB_NOT_FOUND", 404, "Trabajo no disponible.")
        return item

    def snapshot(self, job_id: str, token: str) -> dict[str, Any]:
        item = self.record(job_id, token)
        document = self.get_json(f"jobs/{job_id}/input.json.gz")
        status = item["status"]["S"]
        if status not in TERMINAL:
            execution = self.states.describe_execution(executionArn=item["execution"]["S"])
            if execution["status"] in {"FAILED", "TIMED_OUT", "ABORTED"}:
                self.finish(job_id, "failed")
                item = self.record(job_id, token)
                status = item["status"]["S"]
        result = dict(
            jobId=job_id,
            status=status,
            createdAt=item["created"]["S"],
            updatedAt=item["updated"]["S"],
            statusUrl=f"/v1/jobs/{job_id}",
            resultUrl=f"/v1/jobs/{job_id}/result",
            manifest=document["manifest"],
            progress=dict(
                replicatesTotal=int(item["total"]["N"]),
                replicatesCompleted=int(item["done"]["N"]),
                replicatesFailed=0,  # Un fallo de infraestructura no prueba una réplica fallida.
            ),
        )
        if status == "failed":
            result["error"] = "SIMULATION_FAILED"
        return result

    def create(
        self,
        configuration: dict[str, Any],
        graph_hash: str,
        frames: bool,
        token: str,
        idempotency: str,
    ) -> str:
        cfg = normalize_configuration(configuration, for_aws_jobs=True)
        capability = hashlib.sha256(token.encode()).hexdigest()
        job_id = str(uuid.uuid5(uuid.NAMESPACE_URL, capability + ":" + idempotency))
        request_hash = json_hash(
            dict(
                configuration=cfg.to_dict(),
                expectedGraphHash=graph_hash,
                includeRepresentativeFrames=frames,
            )
        )
        existing = self.item("JOB#" + job_id)
        if existing:
            if existing["requestHash"]["S"] != request_hash:
                raise ConfigurationError(
                    "IDEMPOTENCY_CONFLICT", 409, "La clave identifica otra solicitud."
                )
            self.record(job_id, token)
            if existing["status"]["S"] not in TERMINAL:
                self.start(job_id)
            return job_id
        timestamp, epoch = now(), int(time.time())
        execution = self.machine.replace(":stateMachine:", ":execution:") + ":job-" + job_id
        item = {
            "pk": {"S": "JOB#" + job_id},
            "capability": {"S": capability},
            "requestHash": {"S": request_hash},
            "status": {"S": "pending"},
            "created": {"S": timestamp},
            "updated": {"S": timestamp},
            "total": {"N": str(cfg.repetitions)},
            "done": {"N": "0"},
            "expires": {"N": str(epoch + RETENTION)},
            "execution": {"S": execution},
        }
        # Rechazo barato antes de escribir; la transacción repite estas condiciones sin carreras.
        lock = self.item("LOCK")
        daily = self.item("DAY#" + timestamp[:10])
        if (lock and int(lock["expires"]["N"]) >= epoch) or (
            daily and int(daily.get("admitted", {"N": "0"})["N"]) >= 3
        ):
            raise ConfigurationError(
                "COMPUTE_UNAVAILABLE",
                503,
                "Hay un trabajo activo o se alcanzó el máximo diario (3).",
            )
        graph = generate_graph(cfg, max_edges=100000)
        if json_hash(graph) != graph_hash:
            raise ConfigurationError("GRAPH_HASH_MISMATCH", 409, "Consulta otra vez la red.")
        if len(graph["edges"]) * cfg.scenario.days * cfg.repetitions > MAX_WORK:
            raise ConfigurationError(
                "VALIDATION_ERROR", 422, "El lote supera el límite AWS de trabajo."
            )
        if cfg.scenario.population_size * (cfg.scenario.days + 1) > 400000 and frames:
            raise ConfigurationError("FRAMES_TOO_LARGE", 413, "Los frames superan el límite.")
        # La entrada es determinista y se escribe antes de admitir/iniciar el trabajo.
        manifest = dict(
            runtimeVersions=runtime_versions(),
            modelVersion="aws-jobs-v1",
            configurationHash=json_hash(cfg.to_dict()),
            graphHash=graph_hash,
            requestHash=request_hash,
            rootSeed=cfg.root_seed,
            engineVersion=ENGINE_VERSION,
            rngVersion=RNG_VERSION,
            replicates=[
                dict(index=i, initialSeedEntropy=list(seed_entropy(cfg.root_seed, "initial", i)))
                for i in range(cfg.repetitions)
            ],
        )
        try:
            self.put_json(
                f"jobs/{job_id}/input.json.gz",
                dict(configuration=cfg.to_dict(), graph=graph, frames=frames, manifest=manifest),
                immutable=True,
            )
        except Exception as error:
            if getattr(error, "response", {}).get("Error", {}).get("Code") != "PreconditionFailed":
                raise
            if (
                self.get_json(f"jobs/{job_id}/input.json.gz")["manifest"]["requestHash"]
                != request_hash
            ):
                raise ConfigurationError(
                    "IDEMPOTENCY_CONFLICT", 409, "La clave identifica otra solicitud."
                ) from None
        try:
            self.db.transact_write_items(
                TransactItems=[
                    {
                        "Put": {
                            "TableName": self.table,
                            "Item": item,
                            "ConditionExpression": "attribute_not_exists(pk)",
                        }
                    },
                    {
                        "Put": {
                            "TableName": self.table,
                            "Item": {
                                "pk": {"S": "LOCK"},
                                "owner": {"S": job_id},
                                "expires": {"N": str(epoch + 4200)},
                            },
                            "ConditionExpression": "attribute_not_exists(pk) OR expires < :now",
                            "ExpressionAttributeValues": {":now": {"N": str(epoch)}},
                        }
                    },
                    {
                        "Update": {
                            "TableName": self.table,
                            "Key": {"pk": {"S": "DAY#" + timestamp[:10]}},
                            "UpdateExpression": "SET expires=:ttl ADD admitted :one",
                            "ConditionExpression": "attribute_not_exists(admitted) OR admitted < :max",
                            "ExpressionAttributeValues": {
                                ":ttl": {"N": str(epoch + 172800)},
                                ":one": {"N": "1"},
                                ":max": {"N": "3"},
                            },
                        }
                    },
                ]
            )
        except Exception as error:
            if (
                getattr(error, "response", {}).get("Error", {}).get("Code")
                != "TransactionCanceledException"
            ):
                raise
            raise ConfigurationError(
                "COMPUTE_UNAVAILABLE",
                503,
                "Hay un trabajo activo o se alcanzó el máximo diario (3).",
            ) from None
        self.start(job_id)
        return job_id

    def start(self, job_id: str) -> None:
        try:
            self.states.start_execution(
                stateMachineArn=self.machine,
                name="job-" + job_id,
                input=json.dumps({"jobId": job_id}, separators=(",", ":")),
            )
        except Exception as error:
            if (
                getattr(error, "response", {}).get("Error", {}).get("Code")
                != "ExecutionAlreadyExists"
            ):
                raise

    def checkpoint(self, job_id: str) -> None:
        if self.record(job_id)["status"]["S"] in TERMINAL:
            raise ValueError("Trabajo terminal; ejecución detenida.")

    def finish(self, job_id: str, status: str) -> None:
        try:
            self.db.update_item(
                TableName=self.table,
                Key={"pk": {"S": "JOB#" + job_id}},
                UpdateExpression="SET #s=:s, updated=:u",
                ConditionExpression="#s IN (:p,:r,:a)",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={
                    ":s": {"S": status},
                    ":u": {"S": now()},
                    ":p": {"S": "pending"},
                    ":r": {"S": "running"},
                    ":a": {"S": "aggregating"},
                },
            )
        except Exception as error:
            if (
                getattr(error, "response", {}).get("Error", {}).get("Code")
                != "ConditionalCheckFailedException"
            ):
                raise
            self.release(job_id)
            return
        self.release(job_id)

    def release(self, job_id: str) -> None:
        try:
            self.db.delete_item(
                TableName=self.table,
                Key={"pk": {"S": "LOCK"}},
                ConditionExpression="#o=:job",
                ExpressionAttributeNames={"#o": "owner"},
                ExpressionAttributeValues={":job": {"S": job_id}},
            )
        except Exception as error:
            if (
                getattr(error, "response", {}).get("Error", {}).get("Code")
                != "ConditionalCheckFailedException"
            ):
                raise

    def prepare(self, job_id: str) -> dict[str, Any]:
        self.checkpoint(job_id)
        total = int(self.record(job_id)["total"]["N"])
        return {
            "jobId": job_id,
            "batches": [
                dict(jobId=job_id, start=i, indices=list(range(i, min(i + BATCH_SIZE, total))))
                for i in range(0, total, BATCH_SIZE)
            ],
        }

    def work(self, job_id: str, start: int, indices: list[int]) -> dict[str, Any]:
        self.checkpoint(job_id)
        total = int(self.record(job_id)["total"]["N"])
        if start % BATCH_SIZE or indices != list(range(start, min(start + BATCH_SIZE, total))):
            raise ValueError("Partición inválida.")
        marker = f"BATCH#{job_id}#{start}"
        if self.item(marker):
            return {"start": start}
        document = self.get_json(f"jobs/{job_id}/input.json.gz")
        if document["manifest"]["runtimeVersions"] != runtime_versions():
            raise ValueError("El entorno cambió durante el trabajo.")
        cfg = normalize_configuration(document["configuration"], for_aws_jobs=True)
        rows = batch(cfg, document["graph"], indices, lambda: self.checkpoint(job_id))
        self.put_json(f"jobs/{job_id}/batches/{start}.json.gz", rows)
        try:
            self.db.transact_write_items(
                TransactItems=[
                    {
                        "Put": {
                            "TableName": self.table,
                            "Item": {
                                "pk": {"S": marker},
                                "expires": {"N": str(int(time.time()) + RETENTION)},
                            },
                            "ConditionExpression": "attribute_not_exists(pk)",
                        }
                    },
                    {
                        "Update": {
                            "TableName": self.table,
                            "Key": {"pk": {"S": "JOB#" + job_id}},
                            "UpdateExpression": "SET #s=:running, updated=:u ADD done :count",
                            "ConditionExpression": "#s IN (:pending,:running)",
                            "ExpressionAttributeNames": {"#s": "status"},
                            "ExpressionAttributeValues": {
                                ":pending": {"S": "pending"},
                                ":running": {"S": "running"},
                                ":u": {"S": now()},
                                ":count": {"N": str(len(rows))},
                            },
                        }
                    },
                ]
            )
        except Exception:
            if not self.item(marker):
                raise
        return {"start": start}

    def aggregate(self, job_id: str) -> dict[str, Any]:
        self.checkpoint(job_id)
        item = self.record(job_id)
        if item["done"] != item["total"]:
            raise ValueError("Faltan réplicas confirmadas.")
        self.db.update_item(
            TableName=self.table,
            Key={"pk": {"S": "JOB#" + job_id}},
            UpdateExpression="SET #s=:a, updated=:u",
            ConditionExpression="#s IN (:p,:r,:a)",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":p": {"S": "pending"},
                ":r": {"S": "running"},
                ":a": {"S": "aggregating"},
                ":u": {"S": now()},
            },
        )
        document = self.get_json(f"jobs/{job_id}/input.json.gz")
        if document["manifest"]["runtimeVersions"] != runtime_versions():
            raise ValueError("El entorno cambió durante el trabajo.")
        cfg = normalize_configuration(document["configuration"], for_aws_jobs=True)
        rows = []
        for start in range(0, cfg.repetitions, BATCH_SIZE):
            self.checkpoint(job_id)
            if not self.item(f"BATCH#{job_id}#{start}"):
                raise ValueError("Falta el marcador de un lote.")
            rows.extend(self.get_json(f"jobs/{job_id}/batches/{start}.json.gz"))
        result = export_experiment(
            assemble(cfg, document["graph"], rows, frames=document["frames"]),
            build_commit=os.environ.get("BUILD_COMMIT", "unknown"),
        )
        if len(canonical_json(result)) > MAX_DOCUMENT_BYTES:
            raise ValueError("El resultado supera 32 MiB.")
        self.put_json(f"jobs/{job_id}/result.json.gz", result)
        self.finish(job_id, "completed")
        return {"jobId": job_id}

    def cancel(self, job_id: str, token: str) -> None:
        item = self.record(job_id, token)
        if item["status"]["S"] in TERMINAL:
            return
        self.finish(job_id, "cancelled")
        try:
            self.states.stop_execution(
                executionArn=item["execution"]["S"],
                error="Cancelled",
                cause="Cancelado por el operador",
            )
        except Exception as error:
            if getattr(error, "response", {}).get("Error", {}).get("Code") not in {
                "ExecutionDoesNotExist",
                "ExecutionNotRunning",
            }:
                raise

    def result(self, job_id: str, token: str) -> dict[str, Any]:
        item = self.record(job_id, token)
        if item["status"]["S"] != "completed":
            raise ConfigurationError(
                "COMPUTE_UNAVAILABLE", 409, "El resultado aún no está disponible."
            )
        url = self.s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": f"jobs/{job_id}/result.json.gz"},
            ExpiresIn=300,
        )
        return {"downloadUrl": url, "expiresIn": 300}


def repository() -> AwsJobs:
    boto3 = importlib.import_module("boto3")
    config = importlib.import_module("botocore.config").Config(
        signature_version="s3v4", s3={"addressing_style": "virtual"}
    )
    return AwsJobs(
        boto3.client("dynamodb"),
        boto3.client("s3", config=config),
        boto3.client("stepfunctions"),
        table=os.environ["JOBS_TABLE"],
        bucket=os.environ["JOBS_BUCKET"],
        state_machine=os.environ.get("JOBS_STATE_MACHINE", ""),
    )


def prepare_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    return repository().prepare(event["jobId"])


def worker_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    return repository().work(event["jobId"], event["start"], event["indices"])


def aggregate_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    return repository().aggregate(event["jobId"])


def failure_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    job_id = event["jobId"].removeprefix("job-")
    repository().finish(job_id, "failed")
    return {"jobId": job_id}
