"""Gestor local de trabajos Monte Carlo (P-03 / PRO-4).

Permite orquestar experimentos con seguimiento de progreso, cancelación
y agregado determinista reproducible.
"""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal

from domain.configuration import Configuration
from domain.reproducibility import json_hash
from simulation.engine import simulate_paired
from simulation.experiments import POLICIES, _policy_result, aggregate
from simulation.exports import export_experiment
from simulation.network import generate_graph

JobStatus = Literal["pending", "running", "completed", "failed", "cancelled"]


@dataclass
class JobRecord:
    job_id: str
    configuration: Configuration
    expected_graph_hash: str
    include_representative_frames: bool
    status: JobStatus = "pending"
    created_at: str = field(
        default_factory=lambda: datetime.now(UTC).isoformat().replace("+00:00", "Z")
    )
    updated_at: str = field(
        default_factory=lambda: datetime.now(UTC).isoformat().replace("+00:00", "Z")
    )
    replicates_completed: int = 0
    replicates_failed: int = 0
    replicates_total: int = 0
    result: dict[str, Any] | None = None
    error_message: str | None = None
    _cancelled: bool = False

    def to_dict(self, *, include_result: bool = True) -> dict[str, Any]:
        data: dict[str, Any] = {
            "schemaVersion": "1.0",
            "jobId": self.job_id,
            "status": self.status,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
            "progress": {
                "replicatesTotal": self.replicates_total,
                "replicatesCompleted": self.replicates_completed,
                "replicatesFailed": self.replicates_failed,
            },
        }
        if self.error_message:
            data["error"] = self.error_message
        if include_result and self.status == "completed" and self.result is not None:
            data["result"] = self.result
        return data


class LocalJobManager:
    """Administrador local de jobs Monte Carlo en memoria."""

    def __init__(self, *, max_concurrent: int = 2) -> None:
        self._jobs: dict[str, JobRecord] = {}
        self._lock = threading.Lock()
        self._max_concurrent = max_concurrent

    def create_job(
        self,
        configuration: Configuration,
        expected_graph_hash: str,
        *,
        include_representative_frames: bool = False,
        auto_start: bool = True,
    ) -> JobRecord:
        job_id = str(uuid.uuid4())
        record = JobRecord(
            job_id=job_id,
            configuration=configuration,
            expected_graph_hash=expected_graph_hash,
            include_representative_frames=include_representative_frames,
            replicates_total=configuration.repetitions,
        )
        with self._lock:
            self._jobs[job_id] = record

        if auto_start:
            thread = threading.Thread(
                target=self._run_job, args=(record,), daemon=True, name=f"job-{job_id}"
            )
            thread.start()
        return record

    def get_job(self, job_id: str) -> JobRecord | None:
        with self._lock:
            return self._jobs.get(job_id)

    def cancel_job(self, job_id: str) -> bool:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job or job.status in ("completed", "failed", "cancelled"):
                return False
            job._cancelled = True
            job.status = "cancelled"
            job.updated_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
            return True

    def _run_job(self, record: JobRecord) -> None:
        record.status = "running"
        record.updated_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")

        cfg = record.configuration
        try:
            graph = generate_graph(cfg)
            if json_hash(graph) != record.expected_graph_hash:
                record.status = "failed"
                record.error_message = "GRAPH_HASH_MISMATCH: La red no coincide."
                record.updated_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
                return

            graph_hash = json_hash(graph)
            n = cfg.repetitions
            replicates: list[dict[str, Any]] = []

            for index in range(n):
                if record._cancelled:
                    record.status = "cancelled"
                    record.updated_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
                    return

                traces = simulate_paired(cfg, graph, replicate_index=index)
                initial = [
                    event["nodeId"]
                    for event in traces["none"].events
                    if event["cause"] == "initial"
                ]
                replicates.append(
                    dict(
                        index=index,
                        initialInfectiousNodeIds=initial,
                        initialStateHash=json_hash(
                            dict(graphHash=graph_hash, initialInfectiousNodeIds=initial)
                        ),
                        randomnessHash=traces["none"].randomness_hash,
                        policies={policy: _policy_result(traces[policy]) for policy in POLICIES},
                    )
                )
                record.replicates_completed = index + 1
                record.updated_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")

            if record._cancelled:
                record.status = "cancelled"
                record.updated_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
                return

            result = aggregate(replicates, cfg.root_seed)
            selected = result.pop("representativeIndex")
            traces = simulate_paired(cfg, graph, replicate_index=selected)

            for policy in POLICIES:
                replicates[selected]["policies"][policy]["events"] = traces[policy].events

            representative = dict(
                index=selected,
                initialSeed=dict(rootSeed=cfg.root_seed, replicateIndex=selected, domain="initial"),
                frames={policy: traces[policy].frames for policy in POLICIES}
                if record.include_representative_frames
                else None,
            )

            experiment = dict(
                configuration=cfg.to_dict(),
                graph=graph,
                graphHash=graph_hash,
                **result,
                replicates=replicates,
                representative=representative,
                progress=dict(replicatesTotal=n, replicatesSucceeded=n, replicatesFailed=0),
            )

            exported = export_experiment(experiment, request_id=record.job_id)
            record.result = exported
            record.status = "completed"
            record.updated_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")

        except Exception as e:
            record.status = "failed"
            record.error_message = f"SIMULATION_FAILED: {e}"
            record.updated_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")


# Singleton accesible para el backend
GLOBAL_JOB_MANAGER = LocalJobManager()
