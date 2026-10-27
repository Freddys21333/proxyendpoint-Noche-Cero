"""P-03: cola local acotada, capacidades e idempotencia; no ejecución Lambda durable."""

from __future__ import annotations

import copy
import hashlib
import hmac
import os
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal

from domain.errors import ConfigurationError
from domain.models import Configuration
from domain.reproducibility import RNG_VERSION, json_hash, seed_entropy
from simulation.experiments import ExperimentCancelled, run_experiment
from simulation.exports import ENGINE_VERSION, export_experiment, runtime_versions
from simulation.network import generate_graph

MAX_REPETITIONS = 100
MAX_CONCURRENT = 2
MAX_JOBS = 8
RETENTION_SECONDS = 3600
MAX_EDGE_DAY_REPLICATES = 50_000_000
TERMINAL = {"completed", "failed", "cancelled"}
JobStatus = Literal["pending", "running", "aggregating", "completed", "failed", "cancelled"]


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _capability_hash(capability: str) -> str:
    return hashlib.sha256(capability.encode("utf-8")).hexdigest()


@dataclass
class JobRecord:
    job_id: str
    configuration: Configuration
    expected_graph_hash: str
    include_representative_frames: bool
    manifest: dict[str, Any]
    capability_hash: str = field(repr=False)
    status: JobStatus = "pending"
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)
    replicates_completed: int = 0
    replicates_failed: int = 0
    result: dict[str, Any] | None = field(default=None, repr=False)
    error_message: str | None = None
    _cancelled: threading.Event = field(default_factory=threading.Event, repr=False)
    _completed: set[int] = field(default_factory=set, repr=False)
    _finished_at: float | None = None

    @property
    def replicates_total(self) -> int:
        return self.configuration.repetitions

    def to_dict(self, *, include_result: bool = True) -> dict[str, Any]:
        data: dict[str, Any] = dict(
            schemaVersion="1.0",
            jobId=self.job_id,
            status=self.status,
            createdAt=self.created_at,
            updatedAt=self.updated_at,
            statusUrl=f"/v1/jobs/{self.job_id}",
            resultUrl=f"/v1/jobs/{self.job_id}/result",
            progress=dict(
                replicatesTotal=self.replicates_total,
                replicatesCompleted=self.replicates_completed,
                replicatesFailed=self.replicates_failed,
            ),
            manifest=self.manifest,
        )
        if self.error_message:
            data["error"] = self.error_message
        if include_result and self.status == "completed":
            data["result"] = self.result
        return data


class LocalJobManager:
    """Dos trabajadores como máximo por defecto; cola/retención limitadas en memoria."""

    def __init__(
        self,
        *,
        max_concurrent: int = MAX_CONCURRENT,
        max_jobs: int = MAX_JOBS,
        retention_seconds: int = RETENTION_SECONDS,
    ) -> None:
        if any(type(v) is not int or v < 1 for v in (max_concurrent, max_jobs, retention_seconds)):
            raise ValueError("Límites de trabajos inválidos.")
        self._jobs: dict[str, JobRecord] = {}
        self._keys: dict[tuple[str, str], str] = {}
        self._lock = threading.RLock()
        self._executor = ThreadPoolExecutor(
            max_workers=max_concurrent, thread_name_prefix="monte-carlo"
        )
        self._max_jobs = max_jobs
        self._retention = retention_seconds
        self._closed = False

    def _prune(self) -> None:
        expired = {
            key
            for key, job in self._jobs.items()
            if job._finished_at is not None
            and time.monotonic() - job._finished_at >= self._retention
        }
        for key in expired:
            del self._jobs[key]
        self._keys = {key: job_id for key, job_id in self._keys.items() if job_id not in expired}

    def create_job(
        self,
        configuration: Configuration,
        expected_graph_hash: str,
        *,
        include_representative_frames: bool = False,
        auto_start: bool = True,
        capability: str = "",
        idempotency_key: str | None = None,
        graph: dict[str, Any] | None = None,
    ) -> JobRecord:
        if not 2 <= configuration.repetitions <= MAX_REPETITIONS:
            raise ConfigurationError(
                "VALIDATION_ERROR", 422, "Trabajos locales admiten 2..100 réplicas."
            )
        digest = _capability_hash(capability)
        request_hash = json_hash(
            dict(
                configuration=configuration.to_dict(),
                expectedGraphHash=expected_graph_hash,
                includeRepresentativeFrames=include_representative_frames,
            )
        )
        key = (digest, idempotency_key) if idempotency_key is not None else None
        with self._lock:
            self._prune()
            if key is not None and key in self._keys:
                existing = self._jobs[self._keys[key]]
                if existing.manifest["requestHash"] != request_hash:
                    raise ConfigurationError(
                        "IDEMPOTENCY_CONFLICT", 409, "La clave ya identifica otra solicitud."
                    )
                return existing
            if self._closed or len(self._jobs) >= self._max_jobs:
                raise ConfigurationError(
                    "COMPUTE_UNAVAILABLE", 503, "La cola o retención local está llena."
                )
            manifest = dict(
                runtimeVersions=runtime_versions(),
                modelVersion="local-jobs-v1",
                configurationHash=json_hash(configuration.to_dict()),
                graphHash=expected_graph_hash,
                requestHash=request_hash,
                rootSeed=configuration.root_seed,
                engineVersion=ENGINE_VERSION,
                rngVersion=RNG_VERSION,
                replicates=[
                    dict(
                        index=i,
                        initialSeedEntropy=list(
                            seed_entropy(configuration.root_seed, "initial", i)
                        ),
                    )
                    for i in range(configuration.repetitions)
                ],
            )
            record = JobRecord(
                str(uuid.uuid4()),
                configuration,
                expected_graph_hash,
                include_representative_frames,
                manifest,
                digest,
            )
            self._jobs[record.job_id] = record
            if key is not None:
                self._keys[key] = record.job_id
            if auto_start:
                self._executor.submit(self._run_job, record, graph)
            return record

    def get_job(self, job_id: str) -> JobRecord | None:
        """Acceso interno; el transporte utiliza snapshot con capacidad."""
        with self._lock:
            self._prune()
            return self._jobs.get(job_id)

    def find_retry(
        self,
        configuration: Configuration,
        expected_graph_hash: str,
        *,
        include_representative_frames: bool,
        capability: str,
        idempotency_key: str,
    ) -> JobRecord | None:
        """Resolver reintentos antes de volver a validar/calcular el grafo."""
        with self._lock:
            self._prune()
            key = (_capability_hash(capability), idempotency_key)
            if key not in self._keys:
                return None
            job = self._jobs[self._keys[key]]
            digest = json_hash(
                dict(
                    configuration=configuration.to_dict(),
                    expectedGraphHash=expected_graph_hash,
                    includeRepresentativeFrames=include_representative_frames,
                )
            )
            if digest != job.manifest["requestHash"]:
                raise ConfigurationError(
                    "IDEMPOTENCY_CONFLICT", 409, "La clave ya identifica otra solicitud."
                )
            return job

    def _authorized(self, job_id: str, capability: str) -> JobRecord:
        self._prune()
        job = self._jobs.get(job_id)
        if job is None or not hmac.compare_digest(
            job.capability_hash, _capability_hash(capability)
        ):
            raise ConfigurationError("JOB_NOT_FOUND", 404, "Trabajo no disponible.")
        return job

    def snapshot(self, job_id: str, capability: str) -> dict[str, Any]:
        with self._lock:
            return copy.deepcopy(self._authorized(job_id, capability).to_dict(include_result=False))

    def result(self, job_id: str, capability: str) -> dict[str, Any]:
        with self._lock:
            job = self._authorized(job_id, capability)
            if job.status != "completed" or job.result is None:
                raise ConfigurationError(
                    "JOB_NOT_READY", 409, "El trabajo no tiene un resultado completo."
                )
            return copy.deepcopy(job.result)

    def cancel_job(self, job_id: str, *, capability: str | None = None) -> bool:
        with self._lock:
            job = (
                self._authorized(job_id, capability)
                if capability is not None
                else self._jobs.get(job_id)
            )
            if job is None or job.status in TERMINAL:
                return False
            job._cancelled.set()
            self._finish(job, "cancelled")
            return True

    def _finish(self, job: JobRecord, status: JobStatus) -> None:
        job.status = status
        job.updated_at = _now()
        job._finished_at = time.monotonic()

    def _run_job(self, record: JobRecord, graph: dict[str, Any] | None = None) -> None:
        def checkpoint() -> None:
            if record._cancelled.is_set():
                raise ExperimentCancelled

        def progress(index: int) -> None:
            with self._lock:
                checkpoint()
                record._completed.add(index)
                record.replicates_completed = len(record._completed)
                record.updated_at = _now()

        def aggregating() -> None:
            with self._lock:
                checkpoint()
                record.status = "aggregating"
                record.updated_at = _now()

        def failed(index: int) -> None:
            with self._lock:
                checkpoint()
                record.replicates_failed = 1

        with self._lock:
            if record.status in TERMINAL:
                return
            record.status = "running"
            record.updated_at = _now()
        try:
            checkpoint()
            if runtime_versions() != record.manifest["runtimeVersions"]:
                raise ValueError("El runtime ya no coincide con el manifiesto fijado.")
            cfg = record.configuration
            graph = generate_graph(cfg) if graph is None else graph
            if json_hash(graph) != record.expected_graph_hash:
                raise ValueError("Graph mismatch")
            if len(graph["edges"]) * cfg.scenario.days * cfg.repetitions > MAX_EDGE_DAY_REPLICATES:
                raise ValueError("Local work limit")
            result = run_experiment(
                cfg,
                graph=graph,
                include_representative_frames=record.include_representative_frames,
                checkpoint=checkpoint,
                on_replicate=progress,
                on_replicate_failed=failed,
                on_aggregating=aggregating,
                replicate_attempts=2,
            )
            checkpoint()
            document = export_experiment(
                result,
                request_id=record.job_id,
                build_commit=os.environ.get("BUILD_COMMIT", "unknown"),
            )
            with self._lock:
                checkpoint()
                record.result = document
                self._finish(record, "completed")
        except ExperimentCancelled:
            with self._lock:
                if record.status not in TERMINAL:
                    self._finish(record, "cancelled")
        except Exception as error:
            with self._lock:
                if record.status not in TERMINAL:
                    record.error_message = (
                        "RESULT_TOO_LARGE"
                        if isinstance(error, ConfigurationError)
                        and error.code == "RESULT_TOO_LARGE"
                        else "SIMULATION_FAILED"
                    )
                    self._finish(record, "failed")

    def close(self) -> None:
        with self._lock:
            self._closed = True
            for job in self._jobs.values():
                if job.status not in TERMINAL:
                    job._cancelled.set()
                    self._finish(job, "cancelled")
        self._executor.shutdown(wait=True, cancel_futures=True)


GLOBAL_JOB_MANAGER = LocalJobManager()
