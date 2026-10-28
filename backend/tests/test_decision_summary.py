"""Datos UX derivados en backend; no cambian el experimento científico."""

import copy

import pytest

from domain.configuration import normalize_configuration
from domain.reproducibility import canonical_json
from simulation.decision_summary import decision_summary
from simulation.experiments import run_experiment
from simulation.exports import export_experiment, load_export


def experiment(**overrides):
    cfg = normalize_configuration(
        {
            "scenario": {"populationSize": 50, "days": 3, "beta": 0},
            "intervention": {"vaccines": 3},
            "repetitions": 2,
            **overrides,
        }
    )
    return export_experiment(run_experiment(cfg, include_representative_frames=False))


def test_summary_is_available_with_null_costs_and_honest_ties():
    source = experiment()
    summary = source["decisionSummary"]
    assert summary["bestPolicies"] == ["none", "random", "targeted"]
    assert summary["nearestAlternative"] is None
    assert summary["confidence"] == "descriptive"
    row = summary["policies"]["targeted"]
    assert row["infectedMean"] == 1
    assert row["infectedPopulationPercent"] == 2
    assert row["avoidedVsNoneMean"] == row["reductionVsNonePercent"] == 0
    assert row["spentMeanCents"] is row["costPerAvoidedCents"] is None
    assert row["omissionReasons"] is None


def test_summary_tampering_rejected_but_legacy_json_remains_valid():
    source = experiment()
    changed = copy.deepcopy(source)
    changed["decisionSummary"]["policies"]["random"]["infectedMean"] += 1
    with pytest.raises(ValueError):
        load_export(canonical_json(changed))
    old = copy.deepcopy(source)
    del old["decisionSummary"]
    assert load_export(canonical_json(old)) == old
    assert old["manifest"]["experimentHash"] == source["manifest"]["experimentHash"]


def projection(values, plan=None, spent=None):
    """Entradas unitarias de aritmética; no son evidencia de simulación."""
    rows = {
        policy: {
            "metrics": {"cumulativeInfected": value, "vaccinesAssigned": 0},
            "daily": [{"spentCents": (spent or {}).get(policy, 0 if policy == "none" else 1000)}],
        }
        for policy, value in values.items()
    }
    return decision_summary(
        {
            "configuration": {
                "repetitions": 2,
                "scenario": {"populationSize": 50},
                "intervention": {"vaccines": 3, **({"combined": plan} if plan else {})},
            },
            "replicates": [{"policies": rows}, {"policies": rows}],
            "recommendation": {"confidence": "descriptive"},
        }
    )


def test_zero_reference_has_no_percentage_or_division_by_zero():
    summary = projection(dict(none=0, random=0, targeted=0))
    assert all(row["reductionVsNonePercent"] is None for row in summary["policies"].values())
    assert summary["nearestAlternative"] is None


def test_negative_benefit_and_cost_ratios_and_runner_up_ties():
    summary = projection(dict(none=10, random=12, targeted=8), {"budgetCents": 2000})
    loss = summary["policies"]["random"]
    gain = summary["policies"]["targeted"]
    assert loss["avoidedVsNoneMean"] == -2 and loss["reductionVsNonePercent"] == -20
    assert loss["costPerAvoidedCents"] is loss["avoidedPer100Usd"] is None
    assert gain["spentMeanCents"] == gain["remainingMeanCents"] == 1000
    assert gain["costPerAvoidedCents"] == 500 and gain["avoidedPer100Usd"] == 20
    assert summary["nearestAlternative"] == {"policies": ["none"], "gapMean": 2}
    tied = projection(dict(none=10, random=10, targeted=8))
    assert tied["nearestAlternative"] == {"policies": ["none", "random"], "gapMean": 2}


def test_conclusion_explains_cost_benefit_without_inventing_an_optimizer():
    summary = projection(dict(none=20, random=15, targeted=10), {"budgetCents": 2000})
    assert "USD 10,00" in summary["conclusion"]
    assert "menor costo por contagio evitado" in summary["conclusion"]
    assert "no es concluyente" in summary["conclusion"]
    tied = projection(dict(none=10, random=10, targeted=10), {"budgetCents": 2000})
    assert "empate" in tied["conclusion"]
    assert "Sin intervención registra el menor gasto directo: USD 0,00" in tied["conclusion"]
    assert "más rentable" not in tied["conclusion"]
    expensive = projection(
        dict(none=20, random=16, targeted=10),
        {"budgetCents": 2000},
        spent={"random": 100, "targeted": 2000},
    )
    assert "Otra intervención tiene menor costo por contagio evitado" in expensive["conclusion"]
    assert "gasto medio es mayor" in expensive["conclusion"]


def test_legacy_summary_without_conclusion_still_loads_and_reproduces():
    from simulation.exports import reproduce

    source = experiment()
    del source["decisionSummary"]["conclusion"]
    assert load_export(canonical_json(source)) == source
    assert reproduce(source) == source["manifest"]["experimentHash"]


@pytest.mark.parametrize("budget", [0, 10000])
def test_real_budget_inventory_and_recorded_omissions(budget):
    from test_combined import PLAN

    source = experiment(
        intervention={
            "vaccines": 3,
            "combined": {
                **PLAN,
                "budgetCents": budget,
                "resourceSchedule": {
                    "modelVersion": "daily-inventory-v1",
                    "vaccineDailyCapacity": 2,
                    "initialBrigadeSupplies": 2,
                    "deliveries": [{"day": 2, "vaccines": 2, "brigadeSupplies": 2}],
                },
                "adaptiveStrategy": {
                    "modelVersion": "adaptive-policy-v1",
                    "enabled": True,
                    "closureInfectionThreshold": 0.01,
                    "reopenInfectionThreshold": 0.005,
                    "ringVaccinationPriority": True,
                },
            },
        }
    )
    summary = source["decisionSummary"]
    for policy, row in summary["policies"].items():
        spent = (
            sum(rep["policies"][policy]["daily"][-1]["spentCents"] for rep in source["replicates"])
            / 2
        )
        assert row["spentMeanCents"] == spent
        assert row["remainingMeanCents"] == budget - spent
        assert row["vaccinesReceived"] == 5
    reasons = summary["policies"]["targeted"]["omissionReasons"]
    assert reasons is not None
    for row in reasons:
        assert row["replicateDays"] == sum(
            row["reason"] in day["adaptiveDecisions"]["triggers"]
            for rep in source["replicates"]
            for day in rep["policies"]["targeted"]["daily"]
        )
    assert summary["policies"]["none"]["omissionReasons"] is None


def test_legacy_and_new_summary_reproduce_the_same_hash():
    from simulation.exports import reproduce

    source = experiment()
    expected = source["manifest"]["experimentHash"]
    assert reproduce(source) == expected
    del source["decisionSummary"]
    assert reproduce(source) == expected
