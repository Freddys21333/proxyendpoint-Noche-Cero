"""SEIR por snapshot; referencia sin intervención (T-07 / RF-04)."""

import hashlib
import math
import struct
from dataclasses import dataclass, field
from typing import Any

import numpy as np
from numpy.typing import NDArray

from domain.models import Configuration, Policy
from domain.reproducibility import canonical_json, create_rng
from simulation.network import select_initial
from strategies.combined import interval_actions
from strategies.vaccination import vaccinate

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
    daily: list[dict[str, Any]]
    events: list[dict[str, Any]]
    frames: list[list[str]]
    entry_days: list[dict[str, int]]
    randomness_hash: str
    selections: list[dict[str, Any]] = field(default_factory=list)
    vaccines_assigned: int = 0
    vaccines_effective: int = 0
    vaccines_unused: int = 0


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


def simulate_policy(
    configuration: Configuration,
    graph: dict[str, Any],
    *,
    policy: Policy,
    replicate_index: int = 0,
    potentials: Potentials | None = None,
) -> SimulationTrace:
    """Una política con intervención única y potenciales compartibles (T-08)."""
    if policy not in ("none", "random", "targeted"):
        raise ValueError("Política desconocida.")
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
    daily: list[dict[str, Any]] = []
    cumulative = len(initial)
    selections: list[dict[str, Any]] = []
    policy_rng = create_rng(configuration.root_seed, "policy-random", replicate_index)
    combined = configuration.intervention.combined
    remaining = combined.budget_cents if combined else 0
    brigade_rng = create_rng(configuration.root_seed, "combined-brigades-v1", replicate_index)
    interval_edges = edges
    for day in range(t + 1):
        before = remaining
        if day:
            states, changes = step_day(
                states,
                interval_edges,
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
        if day == configuration.intervention.intervention_day:
            states, selections, vaccine_events = vaccinate(
                states,
                edges,
                policy=policy,
                vaccines=min(
                    configuration.intervention.vaccines, remaining // combined.vaccine_cost_cents
                )
                if combined
                else configuration.intervention.vaccines,
                day=day,
                efficacy=configuration.intervention.vaccine_efficacy,
                potentials=p.vaccine[day],
                rng=policy_rng,
            )
            for event in vaccine_events:
                entries[event["nodeId"]]["R"] = day
            events.extend(vaccine_events)
            if combined:
                remaining -= len(selections) * combined.vaccine_cost_cents
        closed_context = None
        brigade_ids: list[int] = []
        if combined:
            interval_edges, spent, closed_context, brigade_ids = interval_actions(
                combined,
                states,
                edges,
                policy=policy,
                day=day,
                last_day=t,
                remaining=remaining,
                rng=brigade_rng,
            )
            remaining -= spent
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
        if combined:
            daily[-1].update(
                budgetRemainingCents=remaining,
                spentCents=combined.budget_cents - remaining,
                spentTodayCents=before - remaining,
                closedContext=closed_context,
                brigadesActive=len(brigade_ids),
                brigadeNodeIds=brigade_ids,
            )
    events.sort(key=lambda event: (event["day"], event["nodeId"], event["cause"]))
    return SimulationTrace(
        daily,
        events,
        frames,
        entries,
        p.randomness_hash,
        selections,
        len(selections),
        sum(row["effective"] for row in selections),
        configuration.intervention.vaccines - len(selections),
    )


def simulate_none(
    configuration: Configuration,
    graph: dict[str, Any],
    *,
    replicate_index: int = 0,
    potentials: Potentials | None = None,
) -> SimulationTrace:
    """Referencia sin intervención sobre el mismo motor de políticas."""
    return simulate_policy(
        configuration, graph, policy="none", replicate_index=replicate_index, potentials=potentials
    )


def simulate_paired(
    configuration: Configuration,
    graph: dict[str, Any],
    *,
    replicate_index: int = 0,
    policy_order: tuple[Policy, ...] = ("none", "random", "targeted"),
) -> dict[Policy, SimulationTrace]:
    """Una réplica, una red y unos potenciales; orden de ejecución independiente."""
    if len(policy_order) != 3 or set(policy_order) != {"none", "random", "targeted"}:
        raise ValueError("Se requieren exactamente las tres políticas.")
    potentials = generate_potentials(
        configuration, len(graph["edges"]), replicate_index=replicate_index
    )
    results = {
        policy: simulate_policy(
            configuration,
            graph,
            policy=policy,
            replicate_index=replicate_index,
            potentials=potentials,
        )
        for policy in policy_order
    }
    return {policy: results[policy] for policy in configuration.policies}
