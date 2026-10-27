"""PRO-1/2 educativo: presupuesto real del motor, calendario y reproducción."""

import io
import zipfile
from dataclasses import replace

import pytest

from domain.configuration import normalize_configuration
from domain.errors import ConfigurationError
from domain.models import CombinedIntervention
from domain.reproducibility import create_rng
from simulation.engine import simulate_paired
from simulation.experiments import run_experiment
from simulation.exports import export_experiment, export_zip, reproduce
from simulation.network import generate_graph
from strategies.combined import interval_actions

PLAN = dict(
    modelVersion="combined-educational-v1",
    budgetCents=10000,
    vaccineCostCents=1000,
    closureCostCents=1000,
    closureContext="school",
    closureStart=0,
    closureDays=2,
    brigadeCostCents=100,
    brigadeDailyCapacity=10,
    brigadeReduction=0.5,
    brigadeStart=0,
    brigadeDays=2,
)


def config(**overrides):
    return normalize_configuration(
        {
            "scenario": {"populationSize": 50, "days": 3},
            "repetitions": 2,
            "intervention": {"vaccines": 3, "combined": {**PLAN, **overrides}},
        }
    )


def test_combined_budget_is_nonnegative_exact_and_none_spends_nothing():
    c = config()
    traces = simulate_paired(c, generate_graph(c))
    for policy, trace in traces.items():
        previous = 0
        for row in trace.daily:
            vaccine_cost = (
                sum(s["day"] == row["day"] for s in trace.selections) * PLAN["vaccineCostCents"]
            )
            cost = (
                vaccine_cost
                + row["brigadesActive"] * PLAN["brigadeCostCents"]
                + (PLAN["closureCostCents"] if row["closedContext"] else 0)
            )
            assert row["spentTodayCents"] == cost
            assert row["spentCents"] == previous + cost
            assert row["budgetRemainingCents"] == PLAN["budgetCents"] - row["spentCents"] >= 0
            assert row["brigadesActive"] == len(set(row["brigadeNodeIds"]))
            if policy == "none":
                assert row["spentCents"] == 0
            previous = row["spentCents"]
        assert trace.daily[-1]["closedContext"] is None
        assert trace.daily[-1]["brigadesActive"] == 0


def test_no_budget_reproduces_baseline_disease_and_shared_randomness():
    c = config(budgetCents=0)
    graph = generate_graph(c)
    combined = simulate_paired(c, graph)
    baseline = simulate_paired(
        replace(c, intervention=replace(c.intervention, combined=None)), graph
    )
    for policy in combined:
        assert combined[policy].frames == baseline["none"].frames
        assert combined[policy].randomness_hash == baseline[policy].randomness_hash
        assert combined[policy].vaccines_assigned == 0


def test_budget_caps_doses_and_failed_doses_still_cost():
    c = config(budgetCents=2500, closureDays=0, brigadeDays=0)
    c = replace(c, intervention=replace(c.intervention, vaccine_efficacy=0))
    for policy, trace in simulate_paired(c, generate_graph(c)).items():
        assert trace.vaccines_assigned == (0 if policy == "none" else 2)
        assert trace.vaccines_effective == 0
        assert trace.daily[0]["budgetRemainingCents"] == (2500 if policy == "none" else 500)


def test_interval_closure_and_brigades_preserve_ids_and_bound_effects():
    c = config()
    plan = c.intervention.combined
    assert isinstance(plan, CombinedIntervention)
    edges = [
        dict(id=0, u=0, v=1, weight=1, context="school", activeDays=[0]),
        dict(id=1, u=0, v=2, weight=1, context="household", activeDays=[0]),
    ]
    modified, spent, closed, ids = interval_actions(
        replace(plan, brigade_reduction=1),
        ["I", "S", "S"],
        edges,
        policy="targeted",
        day=0,
        last_day=3,
        remaining=10000,
        rng=create_rng(0, "combined-brigades-v1"),
    )
    assert closed == "school" and spent == 1200 and ids == [1, 2]
    assert [e["id"] for e in modified] == [0, 1]
    assert [e["weight"] for e in modified] == [0, 0]
    assert edges[0]["weight"] == edges[1]["weight"] == 1


def test_combined_export_reproduces_financial_and_epidemiological_results():
    document = export_experiment(run_experiment(config()))
    assert reproduce(document) == document["manifest"]["experimentHash"]
    with zipfile.ZipFile(io.BytesIO(export_zip(document))) as archive:
        assert b"budgetRemainingCents" in archive.read("budget.csv")


@pytest.mark.parametrize(
    "overrides",
    [
        dict(vaccineCostCents=0),
        dict(budgetCents=-1),
        dict(brigadeReduction=1.1),
        dict(closureStart=3, closureDays=1),
    ],
)
def test_invalid_costs_and_calendars_rejected(overrides):
    with pytest.raises(ConfigurationError):
        config(**overrides)
