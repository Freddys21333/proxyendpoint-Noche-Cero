"""T-09: métricas, percentiles, bootstrap y experimentos reales."""

import json
import os
import subprocess
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np
import pytest
from jsonschema import Draft202012Validator

from domain.configuration import normalize_configuration
from domain.errors import ConfigurationError
from domain.reproducibility import create_rng, json_hash
from simulation.engine import SimulationTrace, simulate_paired
from simulation.experiments import aggregate, metrics, run_experiment, statistics
from simulation.network import generate_graph


def test_linear_statistics_and_censored_values():
    assert statistics([0, 10]) == dict(n=2, mean=5, median=5, p05=0.5, p95=9.5)
    assert statistics([None, 10]) == dict(n=1, mean=10, median=10, p05=10, p95=10)
    assert statistics([None, None]) == dict(n=0, mean=None, median=None, p05=None, p95=None)


def test_metrics_first_peak_and_extinction_requires_E_plus_I():
    daily = [
        dict(day=d, s=0, e=e, i=i, r=3 - e - i, cumulativeInfected=3)
        for d, (e, i) in enumerate([(1, 1), (1, 0), (0, 0)])
    ]
    trace = SimulationTrace(
        daily,
        [],
        [],
        [],
        "sha256:test",
        vaccines_assigned=2,
        vaccines_effective=1,
        vaccines_unused=3,
    )
    result = metrics(trace)
    assert result == dict(
        cumulativeInfected=3,
        peakInfectious=1,
        peakDay=0,
        finalInfectious=0,
        outbreakDuration=2,
        vaccinesAssigned=2,
        vaccinesEffective=1,
        vaccinesUnused=3,
    )
    daily[-1]["e"] = 1
    assert metrics(trace)["outbreakDuration"] is None
    daily[1]["i"] = 1
    assert metrics(trace)["peakDay"] == 0


def replicas(values):
    return [
        dict(
            index=i,
            policies={
                p: dict(
                    metrics=dict(
                        cumulativeInfected=v,
                        peakInfectious=v,
                        peakDay=0,
                        finalInfectious=0,
                        outbreakDuration=None,
                        vaccinesAssigned=0,
                        vaccinesEffective=0,
                        vaccinesUnused=10,
                    ),
                    daily=[dict(day=0, s=100 - v, e=0, i=v, r=0, cumulativeInfected=v)],
                )
                for p, v in zip(("none", "random", "targeted"), row, strict=True)
            },
        )
        for i, row in enumerate(values)
    ]


@pytest.mark.parametrize(
    "row,winner",
    [((10, 8, 2), "targeted"), ((2, 8, 10), "none"), ((10, 2, 8), "random"), ((2, 2, 8), "tie")],
)
def test_recommendation_gains_losses_ties_and_representative(row, winner):
    result = aggregate(replicas([row, row]), 20261026)
    assert result["recommendation"]["winner"] == winner
    assert result["recommendation"]["confidence"] == "descriptive"
    comparisons = result["pairedComparisons"]
    assert comparisons["gainVsRandom"]["values"] == [row[1] - row[2]] * 2
    assert comparisons["gainVsRandom"]["bootstrap"] is None
    assert result["representativeIndex"] == 0
    assert result["summaryByPolicy"]["targeted"]["outbreakDuration"]["n"] == 0


def test_bootstrap_shared_indices_and_supported_winner():
    rows = [(100 + i, 50 + i, 10 + i % 3) for i in range(30)]
    result = aggregate(replicas(rows), 12)
    assert result["recommendation"] == dict(
        winner="targeted",
        confidence="supported",
        reasons=result["recommendation"]["reasons"],
        limitations=result["recommendation"]["limitations"],
    )
    diffs = np.array([b - c for a, b, c in rows], dtype=float)
    indices = create_rng(12, "bootstrap").integers(0, 30, size=(2000, 30))
    bounds = np.percentile(diffs[indices].mean(axis=1), [2.5, 97.5], method="linear")
    assert result["pairedComparisons"]["gainVsRandom"]["bootstrap"] == dict(
        level=0.95, resamples=2000, lower=bounds[0], upper=bounds[1]
    )
    assert aggregate(list(reversed(replicas(rows))), 12) == result


def test_uncertain_winner_and_representative_tie():
    rows = [(50, 50, 0)] * 16 + [(50, 50, 100)] * 14
    result = aggregate(replicas(rows), 12)
    assert result["recommendation"]["winner"] == "targeted"
    assert result["recommendation"]["confidence"] == "inconclusive"
    assert result["pairedComparisons"]["targetedWinRateVsRandom"] == 16 / 30
    assert aggregate(replicas([(10, 10, 0), (10, 10, 10)]), 12)["representativeIndex"] == 0


@pytest.fixture
def config():
    return normalize_configuration(
        {
            "scenario": {"populationSize": 50, "days": 4},
            "intervention": {"vaccines": 10},
            "repetitions": 2,
        }
    )


def test_real_experiment_order_hashes_and_optional_frames(config):
    result = run_experiment(config)
    reversed_result = run_experiment(
        config, replicate_order=(1, 0), policy_order=("targeted", "random", "none")
    )
    assert result == reversed_result
    assert result["progress"] == dict(replicatesTotal=2, replicatesSucceeded=2, replicatesFailed=0)
    no_frames = run_experiment(config, include_representative_frames=False)
    assert no_frames["representative"]["frames"] is None
    assert no_frames["replicates"] == result["replicates"]
    graph = generate_graph(config)
    for rep in result["replicates"]:
        expected = simulate_paired(config, graph, replicate_index=rep["index"])
        for policy, value in rep["policies"].items():
            assert value["metrics"] == metrics(expected[policy])
            assert value["resultHash"] == json_hash(
                {key: value[key] for key in ("metrics", "daily", "selections")}
            )
            assert (value["events"] is not None) == (
                rep["index"] == result["representative"]["index"]
            )
            assert value["metrics"]["cumulativeInfected"] == len(
                {
                    e["nodeId"]
                    for e in expected[policy].events
                    if e["cause"] in ("initial", "contact")
                }
            )


def test_failure_aborts_without_partial_result(config, monkeypatch):
    from simulation import experiments

    actual = experiments.simulate_paired

    def fail(*args, **kwargs):
        if kwargs.get("replicate_index") == 1:
            raise RuntimeError("private data")
        return actual(*args, **kwargs)

    monkeypatch.setattr(experiments, "simulate_paired", fail)
    with pytest.raises(ConfigurationError) as caught:
        run_experiment(config)
    assert caught.value.code == "SIMULATION_FAILED" and caught.value.status_code == 500
    assert "private data" not in str(caught.value)


@pytest.mark.parametrize(
    "row,winner,confidence",
    [
        ((10, 8, 2), "targeted", "supported"),
        ((2, 8, 10), "none", "supported"),
        ((10, 2, 8), "random", "supported"),
        ((2, 2, 8), "tie", "inconclusive"),
    ],
)
def test_thirty_replicate_recommendations(row, winner, confidence):
    result = aggregate(replicas([row] * 30), 12)
    assert result["recommendation"]["winner"] == winner
    assert result["recommendation"]["confidence"] == confidence


def test_twenty_nine_replicates_do_not_bootstrap():
    result = aggregate(replicas([(10, 8, 2)] * 29), 12)
    assert result["pairedComparisons"]["gainVsRandom"]["bootstrap"] is None
    assert result["recommendation"]["confidence"] == "descriptive"


@pytest.mark.parametrize("repetitions", [2, 30])
def test_generated_domain_fields_match_contract(config, repetitions):
    config = replace(config, repetitions=repetitions)
    result = run_experiment(config, include_representative_frames=False)
    definitions = json.loads(
        (Path(__file__).resolve().parents[2] / "schemas/common.schema.json").read_text()
    )["$defs"]
    properties = definitions["CompareResponse"]["properties"]
    for name, value in result.items():
        Draft202012Validator({"$defs": definitions, **properties[name]}).validate(value)
    assert result["progress"]["replicatesSucceeded"] == repetitions


@pytest.mark.parametrize("order", [(0,), (0, 0), (0, 2), (False, 1)])
def test_invalid_replica_order_rejected(config, order):
    with pytest.raises(ValueError, match="Orden"):
        run_experiment(config, replicate_order=order)


def test_experiment_reproducible_in_three_processes(tmp_path):
    source = Path(__file__).resolve().parents[1] / "src"
    script = "from domain.configuration import normalize_configuration; from domain.reproducibility import json_hash; from simulation.experiments import run_experiment; c=normalize_configuration({'scenario':{'populationSize':50,'days':4},'intervention':{'vaccines':10},'repetitions':2}); print(json_hash(run_experiment(c)))"
    outputs = [
        subprocess.check_output(
            [sys.executable, "-c", script],
            cwd=tmp_path,
            env=dict(os.environ, PYTHONPATH=str(source), PYTHONHASHSEED=seed),
            text=True,
        )
        for seed in ("1", "42", "random")
    ]
    assert len(set(outputs)) == 1
