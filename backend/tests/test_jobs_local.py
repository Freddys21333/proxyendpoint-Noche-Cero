"""Pruebas de trabajos Monte Carlo locales (P-03)."""

import time

import pytest

from domain.configuration import normalize_configuration
from domain.reproducibility import json_hash
from simulation.experiments import run_experiment
from simulation.exports import export_experiment
from simulation.jobs import LocalJobManager
from simulation.network import generate_graph


def test_create_job_returns_pending_status():
    """Un trabajo creado sin auto_start queda en pending."""
    manager = LocalJobManager()
    config = normalize_configuration({
        "scenario": {"populationSize": 50, "days": 3},
        "repetitions": 5
    })
    graph = generate_graph(config)
    graph_hash = json_hash(graph)
    
    job = manager.create_job(config, graph_hash, auto_start=False)
    
    assert job.status == "pending"
    assert job.replicates_total == 5
    assert job.replicates_completed == 0
    assert job.replicates_failed == 0
    assert job.job_id is not None


def test_job_completes_and_returns_result():
    """Un trabajo ejecutado completa y devuelve resultado válido."""
    manager = LocalJobManager()
    config = normalize_configuration({
        "scenario": {"populationSize": 50, "days": 3},
        "repetitions": 2
    })
    graph = generate_graph(config)
    job = manager.create_job(config, json_hash(graph), auto_start=True)
    
    # Esperar hasta completar (timeout 30s)
    for _ in range(60):
        time.sleep(0.5)
        current = manager.get_job(job.job_id)
        if current and current.status in ("completed", "failed", "cancelled"):
            break
    
    assert current is not None
    assert current.status == "completed"
    assert current.replicates_completed == 2
    assert current.replicates_failed == 0
    assert current.result is not None
    assert "manifest" in current.result
    assert current.result["manifest"]["experimentHash"]


def test_cancel_running_job_stops_execution():
    """Cancelar un trabajo en ejecución lo detiene cooperativamente."""
    manager = LocalJobManager()
    config = normalize_configuration({
        "scenario": {"populationSize": 100, "days": 10},
        "repetitions": 50
    })
    graph = generate_graph(config)
    job = manager.create_job(config, json_hash(graph), auto_start=True)
    
    time.sleep(1.0)  # Dejar que empiece
    success = manager.cancel_job(job.job_id)
    
    assert success is True
    time.sleep(0.5)
    current = manager.get_job(job.job_id)
    assert current is not None
    assert current.status == "cancelled"
    assert current.replicates_completed < 50


def test_cancel_completed_job_returns_false():
    """Cancelar un trabajo ya completado devuelve False."""
    manager = LocalJobManager()
    config = normalize_configuration({
        "scenario": {"populationSize": 50, "days": 3},
        "repetitions": 2
    })
    graph = generate_graph(config)
    job = manager.create_job(config, json_hash(graph), auto_start=True)
    
    # Esperar a que complete
    for _ in range(60):
        time.sleep(0.5)
        current = manager.get_job(job.job_id)
        if current and current.status == "completed":
            break
    
    success = manager.cancel_job(job.job_id)
    assert success is False


def test_get_nonexistent_job_returns_none():
    """Consultar un trabajo inexistente devuelve None."""
    manager = LocalJobManager()
    job = manager.get_job("00000000-0000-0000-0000-000000000000")
    assert job is None


def test_graph_hash_mismatch_fails_job():
    """Un hash de grafo incorrecto hace fallar el trabajo."""
    manager = LocalJobManager()
    config = normalize_configuration({
        "scenario": {"populationSize": 50, "days": 3},
        "repetitions": 2
    })
    wrong_hash = "sha256:0000000000000000000000000000000000000000000000000000000000000000"
    
    job = manager.create_job(config, wrong_hash, auto_start=True)
    
    for _ in range(20):
        time.sleep(0.5)
        current = manager.get_job(job.job_id)
        if current and current.status == "failed":
            break
    
    assert current is not None
    assert current.status == "failed"
    assert current.error_message is not None
    assert "GRAPH_HASH_MISMATCH" in current.error_message


def test_job_result_matches_sync_compare():
    """El hash de trabajo asíncrono coincide con ejecución síncrona."""
    config = normalize_configuration({
        "scenario": {"populationSize": 50, "days": 3},
        "repetitions": 3
    })
    
    # Ejecución síncrona
    sync_result = run_experiment(config)
    sync_export = export_experiment(sync_result)
    sync_hash = sync_export["manifest"]["experimentHash"]
    
    # Ejecución asíncrona
    manager = LocalJobManager()
    graph = generate_graph(config)
    job = manager.create_job(config, json_hash(graph), auto_start=True)
    
    for _ in range(60):
        time.sleep(0.5)
        current = manager.get_job(job.job_id)
        if current and current.status == "completed":
            break
    
    assert current is not None
    assert current.status == "completed"
    async_hash = current.result["manifest"]["experimentHash"]
    assert async_hash == sync_hash


def test_job_progress_increases_during_execution():
    """El progreso de réplicas completadas aumenta durante la ejecución."""
    manager = LocalJobManager()
    config = normalize_configuration({
        "scenario": {"populationSize": 80, "days": 5},
        "repetitions": 10
    })
    graph = generate_graph(config)
    job = manager.create_job(config, json_hash(graph), auto_start=True)
    
    seen_progress = []
    for _ in range(50):
        time.sleep(0.5)
        current = manager.get_job(job.job_id)
        if current:
            seen_progress.append(current.replicates_completed)
            if current.status in ("completed", "failed", "cancelled"):
                break
    
    # Debe haber progreso creciente
    assert len(seen_progress) > 0
    assert seen_progress[-1] >= seen_progress[0]
    # Al menos dos valores diferentes de progreso
    assert len(set(seen_progress)) >= 2


def test_job_to_dict_includes_result_when_completed():
    """El método to_dict incluye result solo cuando está completed."""
    manager = LocalJobManager()
    config = normalize_configuration({
        "scenario": {"populationSize": 50, "days": 3},
        "repetitions": 2
    })
    graph = generate_graph(config)
    job = manager.create_job(config, json_hash(graph), auto_start=True)
    
    for _ in range(60):
        time.sleep(0.5)
        current = manager.get_job(job.job_id)
        if current and current.status == "completed":
            break
    
    data_with_result = current.to_dict(include_result=True)
    data_without_result = current.to_dict(include_result=False)
    
    assert "result" in data_with_result
    assert "result" not in data_without_result
    assert data_with_result["status"] == "completed"
