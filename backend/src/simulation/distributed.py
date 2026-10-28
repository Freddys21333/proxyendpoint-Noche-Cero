"""P-04: partición reproducible; los índices siempre pertenecen al experimento global."""

from collections.abc import Callable
from typing import Any

from domain.models import Configuration
from domain.reproducibility import json_hash
from simulation.engine import _EdgeIndex, simulate_paired
from simulation.experiments import POLICIES, _policy_result, run_experiment


def batch(
    configuration: Configuration,
    graph: dict[str, Any],
    indices: list[int],
    checkpoint: Callable[[], None] | None = None,
) -> list[dict[str, Any]]:
    if (
        not indices
        or len(set(indices)) != len(indices)
        or any(
            type(index) is not int or not 0 <= index < configuration.repetitions
            for index in indices
        )
    ):
        raise ValueError("Índices de lote inválidos.")
    edge_index = _EdgeIndex(graph["edges"], configuration.scenario.population_size)
    graph_hash = json_hash(graph)
    rows = []
    for index in indices:
        if checkpoint:
            checkpoint()
        traces = simulate_paired(
            configuration, graph, replicate_index=index, _edge_index=edge_index
        )
        initial = [
            event["nodeId"] for event in traces["none"].events if event["cause"] == "initial"
        ]
        rows.append(
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
    return rows


def assemble(
    configuration: Configuration,
    graph: dict[str, Any],
    rows: list[dict[str, Any]],
    *,
    frames: bool = False,
) -> dict[str, Any]:
    return run_experiment(
        configuration, graph=graph, include_representative_frames=frames, completed_replicates=rows
    )
