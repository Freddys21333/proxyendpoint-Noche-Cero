"""Experimentos y estadísticas — T-09 / CA-09/10."""

import copy
import math
from collections.abc import Callable
from typing import Any

import numpy as np
from numpy.typing import NDArray

from domain.errors import ConfigurationError
from domain.models import Configuration, Policy
from domain.reproducibility import create_rng, json_hash
from simulation.engine import SimulationTrace, _EdgeIndex, simulate_paired
from simulation.network import generate_graph

POLICIES: tuple[Policy, ...] = ("none", "random", "targeted")


class ExperimentCancelled(Exception):
    """Cancelación cooperativa; nunca se convierte en resultado parcial."""


def statistics(values: list[int | float | None]) -> dict[str, Any]:
    """Los null censurados no participan; n es la cantidad efectiva."""
    data = np.asarray([value for value in values if value is not None], dtype=np.float64)
    if not np.all(np.isfinite(data)):
        raise ValueError("Estadísticas requieren valores finitos.")
    if not len(data):
        return dict(n=0, mean=None, median=None, p05=None, p95=None)
    p05, median, p95 = np.percentile(data, [5, 50, 95], method="linear")
    return dict(
        n=len(data), mean=float(data.mean()), median=float(median), p05=float(p05), p95=float(p95)
    )


def metrics(trace: SimulationTrace) -> dict[str, int | None]:
    daily = trace.daily
    if not daily:
        raise ValueError("La traza no tiene días.")
    peak = max(row["i"] for row in daily)
    return dict(
        cumulativeInfected=daily[-1]["cumulativeInfected"],
        peakInfectious=peak,
        peakDay=next(row["day"] for row in daily if row["i"] == peak),
        finalInfectious=daily[-1]["i"],
        outbreakDuration=next((row["day"] for row in daily if row["e"] + row["i"] == 0), None),
        vaccinesAssigned=trace.vaccines_assigned,
        vaccinesEffective=trace.vaccines_effective,
        vaccinesUnused=trace.vaccines_unused,
    )


def _comparison(values: list[int], indices: NDArray[np.int64] | None) -> dict[str, Any]:
    stats = statistics(list(values))
    interval = None
    if indices is not None:
        means = np.asarray(values, dtype=np.float64)[indices].mean(axis=1)
        low, high = np.percentile(means, [2.5, 97.5], method="linear")
        interval = dict(level=0.95, resamples=2000, lower=float(low), upper=float(high))
    return {
        "values": values,
        **{key: stats[key] for key in ("mean", "median", "p05", "p95")},
        "bootstrap": interval,
    }


def select_representative(cumulative: list[int]) -> int:
    """Índice más próximo a la mediana de Dirigida; empate por índice ascendente."""
    median = float(np.median(cumulative))
    return min(range(len(cumulative)), key=lambda i: (abs(cumulative[i] - median), i))


def aggregate(replicates: list[dict[str, Any]], root_seed: int) -> dict[str, Any]:
    """Agrega por índice y comparte índices bootstrap en todas las diferencias."""
    ordered = sorted(replicates, key=lambda rep: rep["index"])
    n = len(ordered)
    if n < 2 or [rep["index"] for rep in ordered] != list(range(n)):
        raise ValueError("Se requieren réplicas completas con índices consecutivos.")
    for rep in ordered:
        if set(rep["policies"]) != set(POLICIES):
            raise ValueError("Faltan políticas en la réplica.")
    summary: dict[str, Any] = {}
    curves: dict[str, Any] = {}
    cumulative: dict[str, list[int]] = {}
    for policy in POLICIES:
        results = [rep["policies"][policy] for rep in ordered]
        summary[policy] = {
            name: statistics([result["metrics"][name] for result in results])
            for name in results[0]["metrics"]
        }
        days = len(results[0]["daily"])
        if not days or any(
            [row["day"] for row in result["daily"]] != list(range(days)) for result in results
        ):
            raise ValueError("Series diarias incompletas.")
        curves[policy] = [
            dict(
                day=day,
                **{
                    name: statistics([result["daily"][day][name] for result in results])
                    for name in ("s", "e", "i", "r", "cumulativeInfected")
                },
            )
            for day in range(days)
        ]
        cumulative[policy] = [result["metrics"]["cumulativeInfected"] for result in results]
    if len({len(curves[p]) for p in POLICIES}) != 1:
        raise ValueError("Horizontes de políticas incompatibles.")
    indices = create_rng(root_seed, "bootstrap").integers(0, n, size=(2000, n)) if n >= 30 else None

    def difference(a: str, b: str) -> dict[str, Any]:
        return _comparison(
            [x - y for x, y in zip(cumulative[a], cumulative[b], strict=True)], indices
        )

    saved_random = difference("none", "random")
    saved_targeted = difference("none", "targeted")
    gain = difference("random", "targeted")
    paired = dict(
        savedVsNone=dict(random=saved_random, targeted=saved_targeted),
        gainVsRandom=gain,
        targetedWinRateVsNone=sum(v > 0 for v in saved_targeted["values"]) / n,
        targetedWinRateVsRandom=sum(v > 0 for v in gain["values"]) / n,
    )
    means = {policy: summary[policy]["cumulativeInfected"]["mean"] for policy in POLICIES}
    lowest = min(means.values())
    winners = [
        policy
        for policy in POLICIES
        if math.isclose(means[policy], lowest, rel_tol=0, abs_tol=1e-9)
    ]
    winner = winners[0] if len(winners) == 1 else "tie"
    confidence = "descriptive" if n < 30 else "inconclusive"
    if winner != "tie" and indices is not None:
        if all(
            difference(other, winner)["bootstrap"]["lower"] > 0
            for other in POLICIES
            if other != winner
        ):
            confidence = "supported"
    recommendation = dict(
        winner=winner,
        confidence=confidence,
        reasons=[
            "Empate en la media de infectados acumulados."
            if winner == "tie"
            else f"{winner} tiene la menor media de infectados acumulados.",
            f"Diferencia media random − targeted: {gain['mean']} personas; los valores negativos indican pérdida de targeted.",
        ],
        limitations=[
            "Escenario educativo condicionado a una red sintética fija.",
            "P05–P95 es rango empírico, no intervalo de confianza.",
            "La recomendación no garantiza una victoria para toda semilla ni predice brotes reales.",
        ],
    )
    representative = select_representative(cumulative["targeted"])
    return dict(
        summaryByPolicy=summary,
        pairedComparisons=paired,
        aggregatedCurves=curves,
        recommendation=recommendation,
        representativeIndex=representative,
    )


def _policy_result(trace: SimulationTrace) -> dict[str, Any]:
    result: dict[str, Any] = dict(
        metrics=metrics(trace), daily=trace.daily, selections=trace.selections
    )
    return {**result, "events": None, "resultHash": json_hash(result)}


def run_experiment(
    configuration: Configuration,
    *,
    include_representative_frames: bool = True,
    replicate_order: tuple[int, ...] | None = None,
    policy_order: tuple[Policy, ...] = ("none", "random", "targeted"),
    graph: dict[str, Any] | None = None,
    checkpoint: Callable[[], None] | None = None,
    on_replicate: Callable[[int], None] | None = None,
    on_replicate_failed: Callable[[int], None] | None = None,
    on_aggregating: Callable[[], None] | None = None,
    replicate_attempts: int = 1,
    completed_replicates: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Dominio síncrono completo o error; sin respuesta parcial ni manifiesto ficticio."""
    n = configuration.repetitions
    order = tuple(range(n)) if replicate_order is None else replicate_order
    if len(order) != n or any(type(i) is not int for i in order) or set(order) != set(range(n)):
        raise ValueError("Orden de réplicas incompleto.")
    if len(policy_order) != 3 or set(policy_order) != set(POLICIES):
        raise ValueError("Se requieren las tres políticas.")
    if type(include_representative_frames) is not bool:
        raise ValueError("La opción de frames debe ser booleana.")
    if type(replicate_attempts) is not int or not 1 <= replicate_attempts <= 2:
        raise ValueError("Número de intentos inválido.")
    graph = generate_graph(configuration) if graph is None else graph
    graph_hash = json_hash(graph)
    edge_index = _EdgeIndex(graph["edges"], configuration.scenario.population_size)
    replicates: list[dict[str, Any]] = copy.deepcopy(completed_replicates or [])
    if completed_replicates is not None and sorted(rep["index"] for rep in replicates) != list(
        range(n)
    ):
        raise ValueError("Lotes incompletos o duplicados.")
    try:
        for index in () if completed_replicates is not None else order:
            for attempt in range(replicate_attempts):
                if checkpoint:
                    checkpoint()
                try:
                    traces = simulate_paired(
                        configuration,
                        graph,
                        replicate_index=index,
                        policy_order=policy_order,
                        _edge_index=edge_index,
                    )
                    break
                except ExperimentCancelled:
                    raise
                except Exception:
                    if attempt + 1 == replicate_attempts:
                        if on_replicate_failed:
                            on_replicate_failed(index)
                        raise
            initial = [
                event["nodeId"] for event in traces["none"].events if event["cause"] == "initial"
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
            del traces
            if on_replicate:
                on_replicate(index)
        if checkpoint:
            checkpoint()
        if on_aggregating:
            on_aggregating()
        replicates.sort(key=lambda rep: rep["index"])
        result = aggregate(replicates, configuration.root_seed)
        selected = result.pop("representativeIndex")
        traces = simulate_paired(
            configuration,
            graph,
            replicate_index=selected,
            policy_order=policy_order,
            _edge_index=edge_index,
        )
        if checkpoint:
            checkpoint()
        for policy in POLICIES:
            if (
                _policy_result(traces[policy])["resultHash"]
                != replicates[selected]["policies"][policy]["resultHash"]
            ):
                raise ValueError("La representativa no es reproducible.")
            replicates[selected]["policies"][policy]["events"] = traces[policy].events
        representative = dict(
            index=selected,
            initialSeed=dict(
                rootSeed=configuration.root_seed, replicateIndex=selected, domain="initial"
            ),
            frames={policy: traces[policy].frames for policy in POLICIES}
            if include_representative_frames
            else None,
        )
    except ExperimentCancelled:
        raise
    except Exception:
        raise ConfigurationError(
            "SIMULATION_FAILED", 500, "No se pudo completar el experimento."
        ) from None
    return dict(
        configuration=configuration.to_dict(),
        graph=graph,
        graphHash=graph_hash,
        **result,
        replicates=replicates,
        representative=representative,
        progress=dict(replicatesTotal=n, replicatesSucceeded=n, replicatesFailed=0),
    )
