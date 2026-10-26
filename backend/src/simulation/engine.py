"""SEIR por snapshot; referencia sin intervención (T-07 / RF-04)."""

import hashlib
import math
import struct
from dataclasses import dataclass
from typing import Any

import numpy as np
from numpy.typing import NDArray

from domain.models import Configuration
from domain.reproducibility import canonical_json, create_rng
from simulation.network import select_initial

FloatArray = NDArray[np.float64]
STATES = ("S", "E", "I", "R")


@dataclass(frozen=True)
class Potentials:
    transmission: FloatArray
    progression: FloatArray
    vaccine: FloatArray

    @property
    def randomness_hash(self) -> str:
        """Enmarca shapes y bytes para evitar concatenaciones ambiguas."""
        digest = hashlib.sha256()
        for name in ("transmission", "progression", "vaccine"):
            matrix = getattr(self, name)
            header = canonical_json({"name": name, "shape": list(matrix.shape)})
            digest.update(struct.pack("<Q", len(header)))
            digest.update(header)
            digest.update(matrix.astype("<f8", copy=False).tobytes(order="C"))
        return "sha256:" + digest.hexdigest()


@dataclass(frozen=True)
class SimulationTrace:
    daily: list[dict[str, int]]
    events: list[dict[str, Any]]
    frames: list[list[str]]
    entry_days: list[dict[str, int]]
    randomness_hash: str


def generate_potentials(
    configuration: Configuration, edge_count: int, *, replicate_index: int = 0
) -> Potentials:
    """Potenciales completos, incluso para aristas inactivas."""
    if type(edge_count) is not int or not 0 <= edge_count <= 100000:
        raise ValueError("Cantidad de aristas inválida.")
    t, n = configuration.scenario.days, configuration.scenario.population_size

    def matrix(domain: str, shape: tuple[int, ...]) -> FloatArray:
        values = create_rng(configuration.root_seed, domain, replicate_index).random(shape)
        values.setflags(write=False)
        return values

    return Potentials(
        matrix("transmission", (t, edge_count)),
        matrix("progression", (t, n, 2)),
        matrix("vaccine", (t + 1, n)),
    )


def _event(
    day: int,
    node: int,
    before: str,
    after: str,
    cause: str,
    source: int | None = None,
    edge_id: int | None = None,
) -> dict[str, Any]:
    return {
        "day": day,
        "nodeId": node,
        "from": before,
        "to": after,
        "cause": cause,
        "sourceNodeId": source,
        "edgeId": edge_id,
    }


def step_day(
    states: list[str],
    edges: list[dict[str, Any]],
    *,
    day: int,
    beta: float,
    sigma: float,
    gamma: float,
    transmission: FloatArray,
    progression: FloatArray,
) -> tuple[list[str], list[dict[str, Any]]]:
    """Lee B[d], aplica simultáneamente y etiqueta eventos con d+1."""
    if any(state not in STATES for state in states):
        raise ValueError("Estado SEIR inválido.")
    if type(day) is not int or day < 0:
        raise ValueError("Día inválido.")
    if any(not math.isfinite(rate) or not 0 <= rate <= 1 for rate in (beta, sigma, gamma)):
        raise ValueError("Tasa inválida.")
    if transmission.shape != (len(edges),) or progression.shape != (len(states), 2):
        raise ValueError("Dimensiones de potenciales incompatibles.")
    updated = states.copy()
    causes: dict[int, tuple[int, int]] = {}
    for edge in edges:
        u, v, edge_id = edge["u"], edge["v"], edge["id"]
        if not (0 <= u < len(states) and 0 <= v < len(states) and 0 <= edge_id < len(edges)):
            raise ValueError("Arista ajena a la población o potenciales.")
        if day not in edge["activeDays"]:
            continue
        source, target = (u, v) if states[u] == "I" and states[v] == "S" else (v, u)
        if states[source] != "I" or states[target] != "S":
            continue
        probability = max(0.0, min(1.0, beta * edge["weight"]))
        if transmission[edge_id] < probability:
            if target not in causes or edge_id < causes[target][0]:
                causes[target] = (edge_id, source)
    events: list[dict[str, Any]] = []
    for node, before in enumerate(states):
        if before == "S" and node in causes:
            edge_id, source = causes[node]
            updated[node] = "E"
            events.append(_event(day + 1, node, "S", "E", "contact", source, edge_id))
        elif before == "E" and progression[node, 0] < sigma:
            updated[node] = "I"
            events.append(_event(day + 1, node, "E", "I", "progression"))
        elif before == "I" and progression[node, 1] < gamma:
            updated[node] = "R"
            events.append(_event(day + 1, node, "I", "R", "progression"))
    return updated, events


def simulate_none(
    configuration: Configuration,
    graph: dict[str, Any],
    *,
    replicate_index: int = 0,
    potentials: Potentials | None = None,
) -> SimulationTrace:
    """Solo none; vacunación y otras políticas corresponden a T-08."""
    n, t = configuration.scenario.population_size, configuration.scenario.days
    if [node["id"] for node in graph["nodes"]] != list(range(n)):
        raise ValueError("La red debe tener IDs consecutivos de la población configurada.")
    edges = graph["edges"]
    if sorted(edge["id"] for edge in edges) != list(range(len(edges))):
        raise ValueError("Los IDs de aristas deben ser consecutivos y únicos.")
    p = (
        potentials
        if potentials is not None
        else generate_potentials(configuration, len(edges), replicate_index=replicate_index)
    )
    expected = ((t, len(edges)), (t, n, 2), (t + 1, n))
    for matrix, shape in zip((p.transmission, p.progression, p.vaccine), expected, strict=True):
        if (
            matrix.shape != shape
            or not np.all(np.isfinite(matrix))
            or np.any(matrix < 0)
            or np.any(matrix >= 1)
        ):
            raise ValueError("Potenciales incompatibles: uniformes finitos en [0,1).")
    initial = select_initial(configuration, graph, replicate_index)
    states = ["S"] * n
    entries: list[dict[str, int]] = [{"S": 0} for _ in range(n)]
    events: list[dict[str, Any]] = []
    for node in initial:
        states[node] = "I"
        entries[node] = {"I": 0}
        events.append(_event(0, node, "I", "I", "initial"))
    frames: list[list[str]] = []
    daily: list[dict[str, int]] = []
    cumulative = len(initial)
    for day in range(t + 1):
        if day:
            states, changes = step_day(
                states,
                edges,
                day=day - 1,
                beta=configuration.scenario.beta,
                sigma=configuration.scenario.sigma,
                gamma=configuration.scenario.gamma,
                transmission=p.transmission[day - 1],
                progression=p.progression[day - 1],
            )
            for event in changes:
                entries[event["nodeId"]][event["to"]] = day
                if event["cause"] == "contact":
                    cumulative += 1
            events.extend(changes)
        frames.append(states.copy())
        daily.append(
            {
                "day": day,
                "s": states.count("S"),
                "e": states.count("E"),
                "i": states.count("I"),
                "r": states.count("R"),
                "cumulativeInfected": cumulative,
            }
        )
    return SimulationTrace(daily, events, frames, entries, p.randomness_hash)
