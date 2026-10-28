"""P-02: conservación, reproducción y registros observables reales."""

import copy
from dataclasses import replace

import pytest

from domain.configuration import normalize_configuration
from domain.errors import ConfigurationError
from domain.reproducibility import canonical_json, json_hash
from simulation.engine import simulate_paired
from simulation.experiments import run_experiment
from simulation.exports import experiment_hash, export_experiment, load_export, reproduce
from simulation.network import generate_graph


def configuration(budget=10000):
    return normalize_configuration(
        {
            "rootSeed": 314159265,
            "repetitions": 2,
            "scenario": {"populationSize": 50, "days": 3, "beta": 0, "gamma": 0},
            "intervention": {
                "vaccines": 2,
                "vaccineEfficacy": 0,
                "combined": {
                    "modelVersion": "combined-educational-v1",
                    "budgetCents": budget,
                    "vaccineCostCents": 100,
                    "closureCostCents": 500,
                    "closureContext": "household",
                    "closureStart": 0,
                    "closureDays": 0,
                    "brigadeCostCents": 50,
                    "brigadeDailyCapacity": 2,
                    "brigadeReduction": 0.3,
                    "brigadeStart": 0,
                    "brigadeDays": 3,
                    "resourceSchedule": {
                        "modelVersion": "daily-inventory-v1",
                        "vaccineDailyCapacity": 2,
                        "initialBrigadeSupplies": 2,
                        "deliveries": [{"day": 2, "vaccines": 2, "brigadeSupplies": 4}],
                    },
                    "adaptiveStrategy": {
                        "modelVersion": "adaptive-policy-v1",
                        "enabled": True,
                        "closureInfectionThreshold": 0.01,
                        "reopenInfectionThreshold": 0.005,
                        "ringVaccinationPriority": True,
                    },
                },
            },
        }
    )


@pytest.mark.parametrize("budget", [0, 500, 10000])
def test_adaptive_inventory_export_and_reproduction(budget):
    cfg = configuration(budget)
    document = export_experiment(run_experiment(cfg))
    assert reproduce(document) == document["manifest"]["experimentHash"]
    for rep in document["replicates"]:
        for policy, result in rep["policies"].items():
            used = 0
            for row in result["daily"]:
                used += row["vaccinesUsedToday"]
                assert row["vaccinesAvailable"] == row["vaccinesReceivedTotal"] - used
                assert row["spentCents"] + row["budgetRemainingCents"] == budget
                assert row["brigadeSuppliesAvailable"] >= 0
                if policy == "none" or budget == 0:
                    assert row["spentCents"] == 0
            assert len({s["nodeId"] for s in result["selections"]}) == len(result["selections"])
    if budget == 500:
        row = document["replicates"][0]["policies"]["targeted"]["daily"][0]
        assert "closure_triggered_by_threshold" in row["adaptiveDecisions"]["triggers"]
        assert row["adaptiveDecisions"]["closureActive"] is False
        assert row["closedContext"] is None  # Las vacunas tienen prioridad de gasto.
        assert "closure_budget_exhausted" in row["adaptiveDecisions"]["triggers"]
    if budget == 0:
        reasons = document["replicates"][0]["policies"]["targeted"]["daily"][0][
            "adaptiveDecisions"
        ]["triggers"]
        assert "vaccine_budget_exhausted" in reasons
        assert "brigade_budget_exhausted" in reasons


def test_adaptive_policy_and_replicate_order_are_independent():
    cfg = configuration()
    graph = generate_graph(cfg)
    assert simulate_paired(cfg, graph) == simulate_paired(
        cfg, graph, policy_order=("targeted", "random", "none")
    )
    normal = export_experiment(run_experiment(cfg))
    reverse = export_experiment(run_experiment(cfg, replicate_order=[1, 0]))
    assert normal["manifest"]["experimentHash"] == reverse["manifest"]["experimentHash"]


def test_disabled_adaptive_preserves_fixed_policy_actions():
    cfg = configuration()
    plan = cfg.intervention.combined
    assert plan is not None and plan.adaptive_strategy is not None
    disabled = replace(
        cfg,
        intervention=replace(
            cfg.intervention,
            combined=replace(
                plan, adaptive_strategy=replace(plan.adaptive_strategy, enabled=False)
            ),
        ),
    )
    base = replace(
        cfg, intervention=replace(cfg.intervention, combined=replace(plan, adaptive_strategy=None))
    )
    graph = generate_graph(cfg)
    a, b = simulate_paired(disabled, graph), simulate_paired(base, graph)
    for policy in a:
        for row in a[policy].daily:
            row.pop("adaptiveDecisions")
        assert a[policy] == b[policy]


def test_reopening_and_terminal_day_record_actual_closure():
    cfg = configuration()
    cfg = replace(cfg, scenario=replace(cfg.scenario, gamma=1))
    trace = simulate_paired(cfg, generate_graph(cfg))["targeted"]
    assert trace.daily[0]["adaptiveDecisions"]["closureActive"] is True
    assert trace.daily[1]["i"] == 0
    assert "reopen_triggered_by_threshold" in trace.daily[1]["adaptiveDecisions"]["triggers"]
    assert trace.daily[1]["brigadesActive"] == 0
    assert trace.daily[-1]["adaptiveDecisions"]["closureActive"] is False


def test_rising_then_falling_outbreak_closes_and_reopens_without_looking_ahead():
    cfg = configuration(100000)
    plan = cfg.intervention.combined
    assert plan is not None and plan.adaptive_strategy is not None
    strategy = replace(
        plan.adaptive_strategy, closure_infection_threshold=0.08, reopen_infection_threshold=0.04
    )
    cfg = replace(
        cfg,
        scenario=replace(cfg.scenario, days=20, beta=1, sigma=1, gamma=0.3),
        intervention=replace(cfg.intervention, combined=replace(plan, adaptive_strategy=strategy)),
    )
    trace = simulate_paired(cfg, generate_graph(cfg))["targeted"]
    closed = [
        row
        for row in trace.daily
        if "closure_triggered_by_threshold" in row["adaptiveDecisions"]["triggers"]
    ]
    reopened = [
        row
        for row in trace.daily
        if "reopen_triggered_by_threshold" in row["adaptiveDecisions"]["triggers"]
    ]
    assert len(closed) == len(reopened) == 1
    assert closed[0]["i"] / cfg.scenario.population_size >= 0.08
    assert reopened[0]["i"] / cfg.scenario.population_size < 0.04
    assert closed[0]["day"] < reopened[0]["day"]
    assert closed[0]["adaptiveDecisions"]["closureActive"] is True
    assert reopened[0]["adaptiveDecisions"]["closureActive"] is False


def test_inverted_thresholds_are_rejected():
    wire = configuration().to_dict()
    wire["intervention"]["combined"]["adaptiveStrategy"]["reopenInfectionThreshold"] = 0.9
    with pytest.raises(ConfigurationError):
        normalize_configuration(wire)


def test_no_infectious_does_not_mean_no_exposed():
    cfg = configuration()
    cfg = replace(cfg, scenario=replace(cfg.scenario, beta=1, sigma=0, gamma=1))
    trace = simulate_paired(cfg, generate_graph(cfg))["targeted"]
    row = trace.daily[1]
    assert row["i"] == 0 and row["e"] > 0
    assert row["brigadesActive"] == 0
    assert "no_infectious_hold_brigades" in row["adaptiveDecisions"]["triggers"]


def test_rehashed_forged_decision_is_rejected():
    document = copy.deepcopy(export_experiment(run_experiment(configuration())))
    result = document["replicates"][0]["policies"]["targeted"]
    result["daily"][0]["adaptiveDecisions"]["infectiousFraction"] = 0.9
    result["resultHash"] = json_hash(
        {key: result[key] for key in ("metrics", "daily", "selections")}
    )
    document["manifest"]["experimentHash"] = experiment_hash(document)
    with pytest.raises(ValueError, match="registro adaptativo"):
        load_export(canonical_json(document))
