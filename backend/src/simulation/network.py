"""synthetic-manta-v1: red fija, calendario y origen (T-06 / RF-03)."""

import math
from itertools import combinations
from typing import Any

import networkx as nx

from domain.errors import ConfigurationError, FieldIssue
from domain.models import Configuration
from domain.reproducibility import create_rng, json_hash

MAX_EDGES = 100000


def generate_graph(configuration: Configuration, *, max_edges: int = MAX_EDGES) -> dict[str, Any]:
    """Construye grupos primero y luego unión de contactos; sin truncamiento."""
    if type(max_edges) is not int or not 0 <= max_edges <= MAX_EDGES:
        raise ValueError("Límite de aristas inválido.")
    n = configuration.scenario.population_size
    rng = create_rng(configuration.root_seed, "graph")
    nodes: list[dict[str, Any]] = [
        {
            "id": i,
            "role": "community",
            "householdId": "",
            "neighborhoodId": "",
            "schoolId": None,
            "busId": None,
            "marketId": None,
        }
        for i in range(n)
    ]

    def assign(members: list[int], context: str, size: int) -> list[list[int]]:
        groups = [sorted(members[start : start + size]) for start in range(0, len(members), size)]
        for index, group in enumerate(groups):
            for node in group:
                nodes[node][context + "Id"] = f"{context}-{index}"
        return groups

    shuffled = [int(i) for i in rng.permutation(n)]
    households: list[list[int]] = []
    offset = 0
    while offset < n:
        size = int(rng.choice([1, 2, 3, 4, 5, 6], p=[0.10, 0.20, 0.25, 0.25, 0.15, 0.05]))
        group = sorted(shuffled[offset : offset + size])
        for node in group:
            nodes[node]["householdId"] = f"household-{len(households)}"
        households.append(group)
        offset += size

    roles = [int(i) for i in rng.permutation(n)]
    students = sorted(roles[: n * 25 // 100])
    workers = sorted(roles[n * 25 // 100 : n * 25 // 100 + n * 55 // 100])
    for node in students:
        nodes[node]["role"] = "student"
    for node in workers:
        nodes[node]["role"] = "worker"
    schools = assign([int(i) for i in rng.permutation(students)], "school", 25)
    buses = assign([int(i) for i in rng.choice(n, size=n * 40 // 100, replace=False)], "bus", 40)
    vendors = sorted(
        int(i) for i in rng.choice(workers, size=max(1, len(workers) // 10), replace=False)
    )
    vendor_set = set(vendors)
    non_vendors = [i for i in range(n) if i not in vendor_set]
    for node in vendors:
        nodes[node]["marketId"] = "market-0"
    neighborhood_order = [int(i) for i in rng.permutation(n)]
    neighborhoods = [sorted(neighborhood_order[index::5]) for index in range(5)]
    for index, group in enumerate(neighborhoods):
        for node in group:
            nodes[node]["neighborhoodId"] = f"neighborhood-{index}"

    union: dict[tuple[int, int, str], list[int]] = {}

    def record(context: str, pairs: list[tuple[int, int]], day: int) -> None:
        for u, v in pairs:
            key = (min(u, v), max(u, v), context)
            if key not in union:
                if len(union) >= max_edges:
                    raise ConfigurationError(
                        "GRAPH_TOO_LARGE", 413, "La red supera el límite de aristas."
                    )
                union[key] = []
            union[key].append(day)

    household_pairs = sorted(pair for group in households for pair in combinations(group, 2))
    school_pairs: list[tuple[int, int]] = []
    neighborhood_pairs: list[tuple[int, int]] = []
    for day in range(configuration.scenario.days + 1):
        record("household", household_pairs, day)
        if day == 0:
            for group in schools:
                m = len(group)
                if m < 3:
                    school_pairs.extend(combinations(group, 2))
                else:
                    k = min(6, 2 * ((m - 1) // 2))
                    seed = int(rng.integers(0, 2**32))
                    small_world = nx.watts_strogatz_graph(m, k, 0.1, seed=seed)
                    school_pairs.extend(
                        (min(group[u], group[v]), max(group[u], group[v]))
                        for u, v in small_world.edges()
                    )
            school_pairs.sort()
        if day % 7 < 5:
            record("school", school_pairs, day)
        if day % 7 < 6:
            bus_pairs = sorted(pair for group in buses for pair in combinations(group, 2))
            sizes = {node: len(group) for group in buses for node in group}
            record(
                "bus",
                [(u, v) for u, v in bus_pairs if rng.random() < min(1, 6 / (sizes[u] - 1))],
                day,
            )
            visitors = sorted(int(i) for i in rng.choice(non_vendors, size=n // 5, replace=False))
            for node in visitors:
                nodes[node]["marketId"] = "market-0"
            market_pairs = sorted((min(u, v), max(u, v)) for u in visitors for v in vendors)
            record(
                "market",
                [(u, v) for u, v in market_pairs if rng.random() < min(1, 8 / len(vendors))],
                day,
            )
        if day == 0:
            candidates = sorted(pair for group in neighborhoods for pair in combinations(group, 2))
            neighborhood_pairs = [pair for pair in candidates if rng.random() < 0.02]
        record("neighborhood", neighborhood_pairs, day)

    edges = [
        {
            "id": index,
            "u": u,
            "v": v,
            "context": context,
            "weight": getattr(configuration.network.weights, context),
            "activeDays": union[(u, v, context)],
        }
        for index, (u, v, context) in enumerate(sorted(union))
    ]
    return {
        "generatorVersion": configuration.network.generator_version,
        "nodes": nodes,
        "edges": edges,
    }


def select_initial(
    configuration: Configuration, graph: dict[str, Any], replicate_index: int = 0
) -> list[int]:
    """Primero según origen; restantes desde toda población sin reemplazo."""
    rng = create_rng(configuration.root_seed, "initial", replicate_index)
    nodes = sorted(graph["nodes"], key=lambda node: node["id"])
    ids = [int(node["id"]) for node in nodes]
    origin = configuration.scenario.origin
    if origin.kind == "node":
        if type(origin.value) is not int or origin.value not in ids:
            raise ConfigurationError(
                "VALIDATION_ERROR",
                422,
                "Nodo inicial inválido.",
                (
                    FieldIssue(
                        "configuration.scenario.origin.value",
                        "El nodo debe pertenecer a la población.",
                    ),
                ),
            )
        first = origin.value
    else:
        candidates = (
            ids
            if origin.kind == "random"
            else [int(node["id"]) for node in nodes if node[origin.kind + "Id"] is not None]
        )
        if not candidates:
            raise ConfigurationError(
                "ORIGIN_EMPTY",
                422,
                "El contexto de origen no tiene candidatos.",
                (
                    FieldIssue(
                        "configuration.scenario.origin.kind", "No hay candidatos en el contexto."
                    ),
                ),
            )
        first = int(rng.choice(candidates))
    remaining = [node for node in ids if node != first]
    count = configuration.scenario.initial_infectious
    if count > len(ids) or count < 1:
        raise ConfigurationError("VALIDATION_ERROR", 422, "Cantidad inicial inválida.")
    extra = rng.choice(remaining, size=count - 1, replace=False)
    return sorted([first, *(int(i) for i in extra)])


def build_preview(configuration: Configuration) -> dict[str, Any]:
    """Payload de dominio para T-11, sin envoltorio HTTP ni valores ficticios."""
    graph = generate_graph(configuration)
    graph_hash = json_hash(graph)
    initial = select_initial(configuration, graph)
    n = configuration.scenario.population_size
    positions = [
        {
            "nodeId": i,
            "x": round(math.cos(2 * math.pi * i / n), 6),
            "y": round(math.sin(2 * math.pi * i / n), 6),
        }
        for i in range(n)
    ]
    return {
        "configuration": configuration.to_dict(),
        "graph": graph,
        "graphHash": graph_hash,
        "positions": positions,
        "initialInfectiousNodeIds": initial,
        "initialStateHash": json_hash(
            {"graphHash": graph_hash, "initialInfectiousNodeIds": initial}
        ),
    }
