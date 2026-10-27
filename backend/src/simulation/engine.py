"""SEIR por snapshot; referencia sin intervención (T-07 / RF-04)."""

import hashlib
import math
import struct
from dataclasses import dataclass, field
from functools import cached_property
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
_STATE_CODE = {"S": 0, "E": 1, "I": 2, "R": 3}
_EMPTY_POSITIONS = np.empty(0, dtype=np.int32)


@dataclass(frozen=True)
class Potentials:
    transmission: FloatArray
    progression: FloatArray
    vaccine: FloatArray

    @cached_property
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


class _EdgeIndex:
    """Vista NumPy de aristas; se construye una vez por simulación."""

    __slots__ = ("u", "v", "edge_ids", "weights", "active_by_day", "edge_count")

    def __init__(self, edges: list[dict[str, Any]], node_count: int) -> None:
        count = len(edges)
        self.edge_count = count
        self.u = np.empty(count, dtype=np.int64)
        self.v = np.empty(count, dtype=np.int64)
        self.edge_ids = np.empty(count, dtype=np.int64)
        self.weights = np.empty(count, dtype=np.float64)
        active: dict[int, list[int]] = {}
        for position, edge in enumerate(edges):
            u, v, edge_id = edge["u"], edge["v"], edge["id"]
            if not (0 <= u < node_count and 0 <= v < node_count and 0 <= edge_id < count):
                raise ValueError("Arista ajena a la población o potenciales.")
            self.u[position] = u
            self.v[position] = v
            self.edge_ids[position] = edge_id
            self.weights[position] = edge["weight"]
            for active_day in edge["activeDays"]:
                if isinstance(active_day, (int, np.integer)) and int(active_day) >= 0:
                    active.setdefault(int(active_day), []).append(position)
        self.active_by_day = {
            active_day: np.asarray(positions, dtype=np.int32)
            for active_day, positions in active.items()
        }

    def refresh_weights(self, edges: list[dict[str, Any]]) -> None:
        if len(edges) != self.edge_count:
            raise ValueError("Arista ajena a la población o potenciales.")
        self.weights = np.fromiter(
            (edge["weight"] for edge in edges), dtype=np.float64, count=self.edge_count
        )

    def with_weights_copy(self) -> "_EdgeIndex":
        """Comparte topología y días activos; aísla los pesos de cada política."""
        clone = object.__new__(_EdgeIndex)
        clone.u = self.u
        clone.v = self.v
        clone.edge_ids = self.edge_ids
        clone.weights = self.weights.copy()
        clone.active_by_day = self.active_by_day
        clone.edge_count = self.edge_count
        return clone


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
    _edge_index: _EdgeIndex | None = None,
) -> tuple[list[str], list[dict[str, Any]]]:
    """Lee B[d], aplica simultáneamente y etiqueta eventos con d+1.

    La versión vectorizada conserva la semántica de la referencia: una arista
    transmite de I a S, gana la arista de menor id por destino y E nunca
    progresa el mismo día en que se expone.
    """
    if any(state not in STATES for state in states):
        raise ValueError("Estado SEIR inválido.")
    if type(day) is not int or day < 0:
        raise ValueError("Día inválido.")
    if any(not math.isfinite(rate) or not 0 <= rate <= 1 for rate in (beta, sigma, gamma)):
        raise ValueError("Tasa inválida.")
    if transmission.shape != (len(edges),) or progression.shape != (len(states), 2):
        raise ValueError("Dimensiones de potenciales incompatibles.")
    index = _EdgeIndex(edges, len(states)) if _edge_index is None else _edge_index
    if index.edge_count != len(edges):
        raise ValueError("Arista ajena a la población o potenciales.")

    state_codes = np.fromiter(
        (_STATE_CODE[state] for state in states), dtype=np.int8, count=len(states)
    )
    updated_codes = state_codes.copy()
    contact_events: list[tuple[int, dict[str, Any]]] = []

    positions = index.active_by_day.get(day, _EMPTY_POSITIONS)
    if len(positions):
        u = index.u[positions]
        v = index.v[positions]
        edge_ids = index.edge_ids[positions]
        u_infectious = state_codes[u] == 2
        v_infectious = state_codes[v] == 2
        u_susceptible = state_codes[u] == 0
        v_susceptible = state_codes[v] == 0
        valid = (u_infectious & v_susceptible) | (v_infectious & u_susceptible)
        if valid.any():
            u = u[valid]
            v = v[valid]
            edge_ids = edge_ids[valid]
            weights = index.weights[positions][valid]
            forward = (state_codes[u] == 2) & (state_codes[v] == 0)
            targets = np.where(forward, v, u)
            sources = np.where(forward, u, v)
            probability = np.clip(beta * weights, 0.0, 1.0)
            success = transmission[edge_ids] < probability
            if success.any():
                targets = targets[success]
                sources = sources[success]
                edge_ids = edge_ids[success]
                order = np.lexsort((edge_ids, targets))
                targets = targets[order]
                sources = sources[order]
                edge_ids = edge_ids[order]
                first = np.empty(len(targets), dtype=bool)
                first[0] = True
                first[1:] = targets[1:] != targets[:-1]
                selected_targets = targets[first]
                selected_sources = sources[first]
                selected_ids = edge_ids[first]
                updated_codes[selected_targets] = 1
                contact_events = [
                    (
                        int(node),
                        _event(day + 1, int(node), "S", "E", "contact", int(source), int(edge_id)),
                    )
                    for node, source, edge_id in zip(
                        selected_targets, selected_sources, selected_ids, strict=True
                    )
                ]

    progress_e = (state_codes == 1) & (progression[:, 0] < sigma)
    progress_i = (state_codes == 2) & (progression[:, 1] < gamma)
    updated_codes[progress_e] = 2
    updated_codes[progress_i] = 3

    events = contact_events
    events.extend(
        (int(node), _event(day + 1, int(node), "E", "I", "progression"))
        for node in np.flatnonzero(progress_e)
    )
    events.extend(
        (int(node), _event(day + 1, int(node), "I", "R", "progression"))
        for node in np.flatnonzero(progress_i)
    )
    events.sort(key=lambda item: item[0])
    updated = states.copy()
    for node in np.flatnonzero(updated_codes != state_codes):
        updated[int(node)] = STATES[int(updated_codes[node])]
    return updated, [event for _, event in events]


def simulate_policy(
    configuration: Configuration,
    graph: dict[str, Any],
    *,
    policy: Policy,
    replicate_index: int = 0,
    potentials: Potentials | None = None,
    _edge_index: _EdgeIndex | None = None,
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
    if _edge_index is None:
        edge_index = _EdgeIndex(edges, n)
    else:
        if _edge_index.edge_count != len(edges):
            raise ValueError("Arista ajena a la población o potenciales.")
        edge_index = _edge_index.with_weights_copy()
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
    schedule = combined.resource_schedule if combined else None
    delivery_days = {row.day: row for row in schedule.deliveries} if schedule else {}
    vaccine_stock = configuration.intervention.vaccines
    received_vaccines = vaccine_stock
    brigade_stock = schedule.initial_brigade_supplies if schedule else 0
    received_brigades = brigade_stock
    total_vaccines = vaccine_stock + (
        sum(row.vaccines for row in schedule.deliveries) if schedule else 0
    )
    remaining = combined.budget_cents if combined else 0
    brigade_rng = create_rng(configuration.root_seed, "combined-brigades-v1", replicate_index)
    interval_edges = edges
    for day in range(t + 1):
        before = remaining
        delivery = delivery_days.get(day)
        delivered_vaccines = delivery.vaccines if delivery else 0
        delivered_brigades = delivery.brigade_supplies if delivery else 0
        vaccine_stock += delivered_vaccines
        brigade_stock += delivered_brigades
        received_vaccines += delivered_vaccines
        received_brigades += delivered_brigades
        used_vaccines = 0
        if day:
            if interval_edges is not edges:
                edge_index.refresh_weights(interval_edges)
            states, changes = step_day(
                states,
                interval_edges,
                day=day - 1,
                beta=configuration.scenario.beta,
                sigma=configuration.scenario.sigma,
                gamma=configuration.scenario.gamma,
                transmission=p.transmission[day - 1],
                progression=p.progression[day - 1],
                _edge_index=edge_index,
            )
            for event in changes:
                entries[event["nodeId"]][event["to"]] = day
                if event["cause"] == "contact":
                    cumulative += 1
            events.extend(changes)
        if day == configuration.intervention.intervention_day or (
            schedule and day > configuration.intervention.intervention_day
        ):
            available = (
                min(vaccine_stock, schedule.vaccine_daily_capacity)
                if schedule
                else configuration.intervention.vaccines
            )
            states, today_selections, vaccine_events = vaccinate(
                states,
                edges,
                policy=policy,
                vaccines=min(available, remaining // combined.vaccine_cost_cents)
                if combined
                else configuration.intervention.vaccines,
                day=day,
                efficacy=configuration.intervention.vaccine_efficacy,
                potentials=p.vaccine[day],
                rng=policy_rng,
                excluded=frozenset(row["nodeId"] for row in selections)
                if schedule
                else frozenset(),
            )
            for row in today_selections:
                row["rank"] += len(selections)
            selections.extend(today_selections)
            used_vaccines = len(today_selections)
            vaccine_stock -= used_vaccines
            for event in vaccine_events:
                entries[event["nodeId"]]["R"] = day
            events.extend(vaccine_events)
            if combined:
                remaining -= used_vaccines * combined.vaccine_cost_cents
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
                supplies=brigade_stock if schedule else None,
            )
            remaining -= spent
            if schedule:
                brigade_stock -= len(brigade_ids)
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
        if schedule:
            daily[-1].update(
                vaccinesDeliveredToday=delivered_vaccines,
                vaccinesReceivedTotal=received_vaccines,
                vaccinesUsedToday=used_vaccines,
                vaccinesAvailable=vaccine_stock,
                brigadeSuppliesDeliveredToday=delivered_brigades,
                brigadeSuppliesReceivedTotal=received_brigades,
                brigadeSuppliesUsedToday=len(brigade_ids),
                brigadeSuppliesAvailable=brigade_stock,
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
        total_vaccines - len(selections),
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
    _edge_index: _EdgeIndex | None = None,
) -> dict[Policy, SimulationTrace]:
    """Una réplica, una red y unos potenciales; orden de ejecución independiente."""
    if len(policy_order) != 3 or set(policy_order) != {"none", "random", "targeted"}:
        raise ValueError("Se requieren exactamente las tres políticas.")
    edge_index = (
        _EdgeIndex(graph["edges"], configuration.scenario.population_size)
        if _edge_index is None
        else _edge_index
    )
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
            _edge_index=edge_index,
        )
        for policy in policy_order
    }
    return {policy: results[policy] for policy in configuration.policies}
