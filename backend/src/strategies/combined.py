"""Modelo educativo v1: costos en centavos y acciones sobre el intervalo del día."""

from typing import Any

from numpy.random import Generator

from domain.models import CombinedIntervention, Policy
from strategies.vaccination import select_candidates


def interval_actions(
    plan: CombinedIntervention,
    states: list[str],
    edges: list[dict[str, Any]],
    *,
    policy: Policy,
    day: int,
    last_day: int,
    remaining: int,
    rng: Generator,
    supplies: int | None = None,
    adaptive_closed: bool | None = None,
    brigades_active: bool = True,
    ring_priority: bool = False,
) -> tuple[list[dict[str, Any]], int, str | None, list[int]]:
    """Cierre completo si cabe; después brigadas por persona susceptible y día."""
    if policy == "none" or day >= last_day:
        return edges, 0, None, []
    spent = 0
    closed = None

    # Determinación de cierre: si se especifica adaptive_closed (decisión adaptativa P-02)
    # se usa ese trigger; de lo contrario se usa la ventana predeterminada de días.
    should_close = (
        adaptive_closed
        if adaptive_closed is not None
        else (plan.closure_start <= day < plan.closure_start + plan.closure_days)
    )

    if (
        should_close
        and remaining >= plan.closure_cost_cents
        and any(e["context"] == plan.closure_context and day in e["activeDays"] for e in edges)
    ):
        closed = plan.closure_context
        spent += plan.closure_cost_cents
    available = [e for e in edges if e["context"] != closed] if closed else edges
    selected = []

    # Brigadas: activas si está dentro de la ventana de brigadas y brigades_active es True
    if brigades_active and (plan.brigade_start <= day < plan.brigade_start + plan.brigade_days):
        count = min(plan.brigade_daily_capacity, (remaining - spent) // plan.brigade_cost_cents)
        if supplies is not None:
            count = min(count, supplies)
        selected = select_candidates(
            states,
            available,
            policy=policy,
            vaccines=count,
            day=day,
            rng=rng,
            ring_priority=ring_priority,
        )
        spent += len(selected) * plan.brigade_cost_cents
    ids = sorted(row["nodeId"] for row in selected)
    covered = set(ids)
    # Preserve every edge ID and the potential matrix shape. A closure sets weight
    # to zero; the local educational reduction applies once if either end is covered.
    modified = (
        [
            {
                **edge,
                "weight": 0.0
                if edge["context"] == closed
                else edge["weight"]
                * (
                    1 - plan.brigade_reduction
                    if edge["u"] in covered or edge["v"] in covered
                    else 1
                ),
            }
            for edge in edges
        ]
        if closed or covered
        else edges
    )
    return modified, spent, closed, ids
