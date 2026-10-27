"""P-01: recepción antes de uso, saldo físico y presupuesto independiente."""

import io
import zipfile

import pytest

from domain.configuration import normalize_configuration
from domain.errors import ConfigurationError
from domain.reproducibility import json_hash
from simulation.engine import simulate_paired
from simulation.experiments import run_experiment
from simulation.exports import experiment_hash, export_experiment, export_zip, reproduce
from simulation.network import generate_graph


def payload():
    return {
        "scenario": {"populationSize": 50, "days": 3, "beta": 0},
        "repetitions": 2,
        "intervention": {
            "vaccines": 1,
            "interventionDay": 0,
            "vaccineEfficacy": 0,
            "combined": {
                "modelVersion": "combined-educational-v1",
                "budgetCents": 10000,
                "vaccineCostCents": 1000,
                "closureCostCents": 500,
                "closureContext": "school",
                "closureStart": 0,
                "closureDays": 0,
                "brigadeCostCents": 100,
                "brigadeDailyCapacity": 2,
                "brigadeReduction": 0.3,
                "brigadeStart": 0,
                "brigadeDays": 3,
                "resourceSchedule": {
                    "modelVersion": "daily-inventory-v1",
                    "vaccineDailyCapacity": 2,
                    "initialBrigadeSupplies": 0,
                    "deliveries": [
                        {"day": 2, "vaccines": 2, "brigadeSupplies": 3},
                        {"day": 2, "vaccines": 1, "brigadeSupplies": 1},
                    ],
                },
            },
        },
    }


def test_schedule_is_normalized_by_day_and_combines_same_day_deliveries():
    document = normalize_configuration(payload()).to_dict()
    schedule = document["intervention"]["combined"]["resourceSchedule"]
    assert schedule["deliveries"] == [{"day": 2, "vaccines": 3, "brigadeSupplies": 4}]


def traces(value=None):
    c = normalize_configuration(payload() if value is None else value)
    return simulate_paired(c, generate_graph(c))


def test_resources_arrive_before_actions_and_never_get_used_early():
    for policy, trace in traces().items():
        assert [r["vaccinesDeliveredToday"] for r in trace.daily] == [0, 0, 3, 0]
        assert [r["brigadeSuppliesDeliveredToday"] for r in trace.daily] == [0, 0, 4, 0]
        if policy == "none":
            assert [r["vaccinesAvailable"] for r in trace.daily] == [1, 1, 4, 4]
            assert trace.daily[-1]["brigadeSuppliesAvailable"] == 4
            assert trace.daily[-1]["spentCents"] == 0
        else:
            assert [r["vaccinesUsedToday"] for r in trace.daily] == [1, 0, 2, 1]
            assert [r["brigadeSuppliesUsedToday"] for r in trace.daily] == [0, 0, 2, 0]
            assert trace.vaccines_assigned == 4
            assert trace.vaccines_effective == 0
            assert len({s["nodeId"] for s in trace.selections}) == 4
            assert sorted(s["rank"] for s in trace.selections) == [1, 2, 3, 4]
            assert trace.daily[-1]["spentCents"] == 4200
            assert trace.daily[-1]["brigadeSuppliesAvailable"] == 2
        for i, row in enumerate(trace.daily):
            assert row["vaccinesAvailable"] == row["vaccinesReceivedTotal"] - sum(
                r["vaccinesUsedToday"] for r in trace.daily[: i + 1]
            )
            assert row["brigadeSuppliesAvailable"] == row["brigadeSuppliesReceivedTotal"] - sum(
                r["brigadeSuppliesUsedToday"] for r in trace.daily[: i + 1]
            )


def test_zero_budget_does_not_consume_arrivals_or_create_money():
    value = payload()
    value["intervention"]["combined"]["budgetCents"] = 0
    for trace in traces(value).values():
        assert trace.daily[-1]["vaccinesAvailable"] == 4
        assert trace.daily[-1]["brigadeSuppliesAvailable"] == 4
        assert all(r["budgetRemainingCents"] == 0 and r["spentCents"] == 0 for r in trace.daily)


def test_day_zero_and_last_day_receipts_and_capacity_zero():
    value = payload()
    schedule = value["intervention"]["combined"]["resourceSchedule"]
    schedule["vaccineDailyCapacity"] = 0
    schedule["deliveries"] = [
        {"day": 0, "vaccines": 2, "brigadeSupplies": 1},
        {"day": 3, "vaccines": 1, "brigadeSupplies": 5},
    ]
    for trace in traces(value).values():
        assert trace.daily[0]["vaccinesAvailable"] == 3
        assert trace.daily[-1]["vaccinesAvailable"] == 4
        assert trace.daily[-1]["brigadeSuppliesUsedToday"] == 0
        assert trace.vaccines_unused == 4


def test_schedule_order_and_export_reproduction_are_stable():
    first = payload()
    second = payload()
    second["intervention"]["combined"]["resourceSchedule"]["deliveries"].reverse()
    a, b = normalize_configuration(first), normalize_configuration(second)
    assert a == b
    document = export_experiment(run_experiment(a))
    assert reproduce(document) == document["manifest"]["experimentHash"]
    with zipfile.ZipFile(io.BytesIO(export_zip(document))) as z:
        assert b"vaccinesAvailable" in z.read("inventory.csv")


@pytest.mark.parametrize(
    "change",
    [
        lambda p: p["intervention"]["combined"]["resourceSchedule"]["deliveries"][0].update(day=4),
        lambda p: p["intervention"]["combined"]["resourceSchedule"]["deliveries"][0].update(
            vaccines=-1
        ),
        lambda p: p["intervention"]["combined"]["resourceSchedule"]["deliveries"][0].update(
            vaccines=50
        ),
        lambda p: p["intervention"]["combined"]["resourceSchedule"].update(
            initialBrigadeSupplies=360000
        ),
        lambda p: p["intervention"]["combined"]["resourceSchedule"].update(vaccineDailyCapacity=51),
    ],
)
def test_invalid_schedule_is_rejected(change):
    value = payload()
    change(value)
    with pytest.raises(ConfigurationError):
        normalize_configuration(value)


def test_manipulated_inventory_is_rejected_before_export():
    document = export_experiment(run_experiment(normalize_configuration(payload())))
    result = document["replicates"][0]["policies"]["random"]
    result["daily"][2]["vaccinesAvailable"] += 1
    result["resultHash"] = json_hash(
        {key: result[key] for key in ("metrics", "daily", "selections")}
    )
    document["manifest"]["experimentHash"] = experiment_hash(document)
    with pytest.raises(ValueError, match="inventario"):
        export_zip(document)
