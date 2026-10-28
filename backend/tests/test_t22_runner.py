"""Controles del ejecutor; los fixtures no son evidencia científica T-22."""

import copy
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
import run_t22 as runner


@pytest.mark.parametrize(
    ("none", "random", "expected"),
    [
        (1, 1, "APROBADO"),
        (1, 0, "NO APROBADO"),
        (1, -1, "NO APROBADO"),
        (0, 1, "NO APROBADO"),
        (-1, 1, "NO APROBADO"),
    ],
)
def test_gate_requires_both_strictly_positive_differences(none, random, expected):
    plan = {"runs": [{"id": str(i), "kind": "technical-control"} for i in range(5)]}
    runs = {str(i): {"controlFailures": []} for i in range(5)}
    primary = {"completeRoots": 5, "n": 150, "dNone": {"sum": none}, "dRandom": {"sum": random}}
    assert runner.decide(runs, [], plan, primary)[0] == expected
    assert runner.decide(runs, ["archivo inválido"], plan, primary)[0] == "INCOMPLETO/INVÁLIDO"
    primary["n"] = 149
    assert runner.decide(runs, [], plan, primary)[0] == "INCOMPLETO/INVÁLIDO"


def test_report_does_not_claim_positive_differences_when_gate_fails(tmp_path):
    stats = runner.statistics([1, 1])
    difference = {**stats, "sum": 0, "wins": 0, "ties": 2}
    primary = {
        "n": 2,
        "policyStats": {p: stats for p in runner.POLICIES},
        "dNone": difference,
        "dRandom": difference,
        "perRoot": [],
    }
    env = {"protocolSHA256": "fixture", "sourceCommit": "fixture", "dependencies": {}}
    report = runner.build_report({"runs": []}, {}, [], primary, "NO APROBADO", [], env, tmp_path)
    assert "ambas diferencias sumadas son positivas" not in report
    assert "no satisface la mejora estricta" in report


def test_run_summary_preserves_secondary_stats_and_censored_duration():
    policies = {p: {"metrics": {"cumulativeInfected": 1}} for p in runner.POLICIES}
    secondary = {p: {"outbreakDuration": {"n": 0, "mean": None}} for p in runner.POLICIES}
    document = {
        "replicates": [{"index": 0, "policies": policies}],
        "summaryByPolicy": secondary,
        "recommendation": {},
        "pairedComparisons": {},
    }
    result = runner.run_summary(document)
    assert result["secondaryByPolicy"] == secondary
    assert result["dRandom"]["losses"] == 0
    assert result["dRandom"]["ties"] == 1
    assert result["dRandom"]["winRate"] == 0


def test_artifact_check_rejects_a_different_frozen_configuration(tmp_path):
    row = runner.read_json(runner.PROTOCOL_ROOT / "protocol.json")["runs"][0]
    configuration = runner.read_json(runner.PROTOCOL_ROOT / row["configuration"])
    document = {
        "configuration": copy.deepcopy(configuration),
        "manifest": {"experimentHash": "test"},
        "progress": {"replicatesTotal": 30, "replicatesSucceeded": 30, "replicatesFailed": 0},
    }
    document["configuration"]["rootSeed"] += 1
    assert "configuración distinta del input congelado" in runner.artifact_failures(row, document)
    document["configuration"] = configuration
    assert runner.artifact_failures(row, document) == []
    document["progress"]["replicatesFailed"] = 1
    assert "progreso incompleto o con réplicas fallidas" in runner.artifact_failures(row, document)
