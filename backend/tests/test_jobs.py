"""P-03: Pruebas del gestor local de trabajos Monte Carlo (PRO-4)."""

import time

from domain.configuration import normalize_configuration
from domain.reproducibility import json_hash
from simulation.jobs import LocalJobManager
from simulation.network import generate_graph


def test_job_manager_lifecycle_completed():
    """Un job Monte Carlo local corre asíncronamente y completa todas las réplicas."""
    cfg = normalize_configuration(
        {
            "scenario": {"populationSize": 50, "days": 3},
            "repetitions": 4,
            "intervention": {"vaccines": 5},
        }
    )
    graph = generate_graph(cfg)
    graph_hash = json_hash(graph)

    manager = LocalJobManager()
    job = manager.create_job(cfg, graph_hash, include_representative_frames=False)

    assert job.status in ("pending", "running")
    assert job.replicates_total == 4

    # Esperar a que el thread local complete
    max_wait = 15.0
    start = time.monotonic()
    while job.status not in ("completed", "failed") and time.monotonic() - start < max_wait:
        time.sleep(0.1)

    assert job.status == "completed"
    assert job.replicates_completed == 4
    assert job.result is not None
    assert "replicates" in job.result
    assert len(job.result["replicates"]) == 4

    # Consulta con get_job
    queried = manager.get_job(job.job_id)
    assert queried is not None
    assert queried.status == "completed"
    data = queried.to_dict()
    assert data["jobId"] == job.job_id
    assert data["progress"]["replicatesCompleted"] == 4


def test_job_manager_cancel():
    """Un job puede ser cancelado antes o durante su ejecución."""
    cfg = normalize_configuration(
        {
            "scenario": {"populationSize": 50, "days": 5},
            "repetitions": 10,
            "intervention": {"vaccines": 5},
        }
    )
    graph = generate_graph(cfg)
    graph_hash = json_hash(graph)

    manager = LocalJobManager()
    job = manager.create_job(cfg, graph_hash, auto_start=False)
    assert job.status == "pending"

    success = manager.cancel_job(job.job_id)
    assert success is True
    assert job.status == "cancelled"

    # Intentar cancelar de nuevo devuelve False
    assert manager.cancel_job(job.job_id) is False


def test_job_manager_graph_mismatch_fails():
    """Si el hash de la red no coincide, el job falla limpiamente."""
    cfg = normalize_configuration(
        {
            "scenario": {"populationSize": 50, "days": 2},
            "repetitions": 2,
            "intervention": {"vaccines": 5},
        }
    )
    manager = LocalJobManager()
    job = manager.create_job(cfg, "sha256:incorrect_hash", auto_start=True)

    max_wait = 5.0
    start = time.monotonic()
    while job.status not in ("completed", "failed") and time.monotonic() - start < max_wait:
        time.sleep(0.1)

    assert job.status == "failed"
    assert "GRAPH_HASH_MISMATCH" in str(job.error_message)
