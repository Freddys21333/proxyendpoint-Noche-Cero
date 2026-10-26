"""Selección de vacunas y aplicación — T-08 / RF-05/06/12."""

import math
from typing import Any

import numpy as np
from numpy.random import Generator
from numpy.typing import NDArray

from domain.models import Policy


def select_candidates(
    states: list[str],
    edges: list[dict[str, Any]],
    *,
    policy: Policy,
    vaccines: int,
    day: int,
    rng: Generator,
) -> list[dict[str, Any]]:
    """Decide desde un único snapshot sin acceder a potenciales epidemiológicos."""
    if policy not in ("none", "random", "targeted"):
        raise ValueError("Política desconocida.")
    if type(vaccines) is not int or vaccines < 0 or type(day) is not int or day < 0:
        raise ValueError("Inventario o día inválido.")
    if any(state not in ("S", "E", "I", "R") for state in states):
        raise ValueError("Estado SEIR inválido.")
    eligible = [node for node, state in enumerate(states) if state == "S"]
    count = min(vaccines, len(eligible))
    if policy == "none" or count == 0:
        return []
    weights: dict[int, list[float]] = {node: [] for node in eligible}
    contexts: dict[int, set[str]] = {node: set() for node in eligible}
    for edge in sorted(edges, key=lambda item: item["id"]):
        u, v = edge["u"], edge["v"]
        if day in edge["activeDays"] and states[u] == states[v] == "S":
            for node in (u, v):
                weights[node].append(edge["weight"])
                contexts[node].add(edge["context"])
    scores = {node: math.fsum(weights[node]) for node in eligible}
    if policy == "random":
        selected = [int(node) for node in rng.choice(eligible, size=count, replace=False)]
    else:
        selected = sorted(eligible, key=lambda node: (-scores[node], node))[:count]
    rows = [
        {
            "day": day,
            "nodeId": node,
            "score": scores[node] if policy == "targeted" else None,
            "rank": rank,
            "stateAtDecision": "S",
            "contexts": sorted(contexts[node]),
            "tieBreak": "nodeIdAsc" if policy == "targeted" else "seededRandom",
        }
        for rank, node in enumerate(selected, start=1)
    ]
    return sorted(rows, key=lambda row: row["nodeId"])


def vaccinate(
    states: list[str],
    edges: list[dict[str, Any]],
    *,
    policy: Policy,
    vaccines: int,
    day: int,
    efficacy: float,
    potentials: NDArray[np.float64],
    rng: Generator,
) -> tuple[list[str], list[dict[str, Any]], list[dict[str, Any]]]:
    """Cada selección consume una dosis; solo el éxito produce evento S→R."""
    if not math.isfinite(efficacy) or not 0 <= efficacy <= 1:
        raise ValueError("Eficacia inválida.")
    if (
        potentials.shape != (len(states),)
        or not np.all(np.isfinite(potentials))
        or np.any(potentials < 0)
        or np.any(potentials >= 1)
    ):
        raise ValueError("Potenciales de eficacia inválidos.")
    rows = select_candidates(states, edges, policy=policy, vaccines=vaccines, day=day, rng=rng)
    after = states.copy()
    events: list[dict[str, Any]] = []
    for row in rows:
        node = row["nodeId"]
        row["effective"] = bool(potentials[node] < efficacy)
        if row["effective"]:
            after[node] = "R"
            events.append(
                {
                    "day": day,
                    "nodeId": node,
                    "from": "S",
                    "to": "R",
                    "cause": "vaccine",
                    "sourceNodeId": None,
                    "edgeId": None,
                }
            )
    return after, rows, events
