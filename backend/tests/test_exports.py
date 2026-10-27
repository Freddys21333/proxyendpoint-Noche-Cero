"""T-10: exportación real, hash no volátil y reproducción entre procesos."""

import copy
import csv
import io
import json
import subprocess
import sys
import zipfile
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from domain.configuration import normalize_configuration
from domain.errors import ConfigurationError
from domain.reproducibility import canonical_json
from simulation.experiments import run_experiment
from simulation.exports import (
    experiment_hash,
    export_experiment,
    export_zip,
    load_export,
    reproduce,
)


@pytest.fixture
def exported():
    config = normalize_configuration(
        {
            "scenario": {"populationSize": 50, "days": 3},
            "intervention": {"vaccines": 10},
            "repetitions": 2,
        }
    )
    return export_experiment(
        run_experiment(config, include_representative_frames=False), build_commit="test-build"
    )


def test_full_schema_and_real_manifest(exported):
    definitions = json.loads(
        (Path(__file__).resolve().parents[2] / "schemas/common.schema.json").read_text()
    )["$defs"]
    Draft202012Validator(
        {"$defs": definitions, "$ref": "#/$defs/CompareResponse"},
        format_checker=Draft202012Validator.FORMAT_CHECKER,
    ).validate(exported)
    manifest = exported["manifest"]
    assert manifest["pythonVersion"] == (
        f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    )
    assert manifest["dependencies"]["numpy"] == "2.5.4"
    assert manifest["dependencies"]["networkx"] == "3.7"
    assert manifest["experimentHash"] == experiment_hash(exported)
    assert reproduce(exported) == manifest["experimentHash"]


def test_export_validates_final_request_id_without_changing_scientific_hash(exported):
    updated = export_experiment(exported, request_id="http-request-42")
    assert updated["requestId"] == "http-request-42"
    assert updated["manifest"]["experimentHash"] == exported["manifest"]["experimentHash"]
    with pytest.raises(ConfigurationError):
        export_experiment(exported, request_id="")


def test_hash_ignores_volatile_and_optional_fields_without_mutation(exported):
    before = copy.deepcopy(exported)
    changed = copy.deepcopy(exported)
    changed["requestId"] = "different"
    changed["generatedAt"] = "2026-10-26T00:00:00Z"
    changed["manifest"]["buildCommit"] = "another-build"
    changed["representative"]["frames"] = {"none": [], "random": [], "targeted": []}
    for rep in changed["replicates"]:
        for result in rep["policies"].values():
            result["events"] = None
    assert experiment_hash(changed) == experiment_hash(exported)
    assert exported == before


@pytest.mark.parametrize(
    "field", ["configuration", "graph", "metrics", "versions", "summary", "events"]
)
def test_tampering_rejected(exported, field):
    changed = copy.deepcopy(exported)
    if field == "configuration":
        changed["configuration"]["rootSeed"] += 1
    if field == "graph":
        changed["graph"]["edges"][0]["weight"] = 0.123
    if field == "metrics":
        changed["replicates"][0]["policies"]["none"]["metrics"]["peakDay"] += 1
    if field == "versions":
        changed["manifest"]["dependencies"]["numpy"] = "0.0.0"
    if field == "summary":
        changed["summaryByPolicy"]["none"]["peakDay"]["mean"] += 1
    if field == "events":
        idx = changed["representative"]["index"]
        changed["replicates"][idx]["policies"]["none"]["events"][0]["nodeId"] = (
            changed["replicates"][idx]["policies"]["none"]["events"][0]["nodeId"] + 1
        ) % 50
    with pytest.raises(ValueError):
        reproduce(changed)


def test_cli_new_process_and_nonzero_on_mismatch(exported, tmp_path):
    root = Path(__file__).resolve().parents[2]
    path = tmp_path / "experiment.json"
    path.write_bytes(canonical_json(exported))
    result = subprocess.run(
        [sys.executable, str(root / "scripts/reproduce.py"), str(path)],
        cwd=tmp_path,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    assert exported["manifest"]["experimentHash"] in result.stdout
    exported["manifest"]["experimentHash"] = "sha256:" + "0" * 64
    path.write_bytes(canonical_json(exported))
    result = subprocess.run(
        [sys.executable, str(root / "scripts/reproduce.py"), str(path)],
        cwd=tmp_path,
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0 and "Traceback" not in result.stderr


@pytest.mark.parametrize("body", [b'{"a":1,"a":2}', b'{"a":NaN}', b'{"a":1e999}', b"\xff"])
def test_export_reader_rejects_non_strict_json(body):
    with pytest.raises(ValueError):
        load_export(body)


def test_zip_files_headers_and_values(exported):
    zipped = export_zip(exported)
    assert zipped == export_zip(exported)
    with zipfile.ZipFile(io.BytesIO(zipped)) as archive:
        assert set(archive.namelist()) == {
            "configuration.json",
            "manifest.json",
            "comparison-summary.json",
            "nodes.csv",
            "edges.csv",
            "daily.csv",
            "metrics.csv",
            "selections.csv",
            "events.csv",
            "summary.csv",
            "comparisons.csv",
        }
        manifest = json.loads(archive.read("manifest.json"))
        assert manifest["exportMetadata"]["exportedEventsScope"] == "representative"
        assert "exportMetadata" not in exported["manifest"]
        edges = list(csv.DictReader(io.StringIO(archive.read("edges.csv").decode())))
        assert json.loads(edges[0]["activeDays"]) == exported["graph"]["edges"][0]["activeDays"]
        daily = list(csv.DictReader(io.StringIO(archive.read("daily.csv").decode())))
        assert len(daily) == 2 * 3 * 4
        assert list(daily[0]) == [
            "replicateIndex",
            "policy",
            "day",
            "s",
            "e",
            "i",
            "r",
            "cumulativeInfected",
        ]
        events = list(csv.DictReader(io.StringIO(archive.read("events.csv").decode())))
        assert {int(row["replicateIndex"]) for row in events} == {
            exported["representative"]["index"]
        }
        assert all(row["sourceNodeId"] == "" for row in events if row["cause"] != "contact")
        assert json.loads(archive.read("comparison-summary.json")) == exported["pairedComparisons"]


def test_reproduction_with_frames_and_volatile_metadata(exported):
    config = normalize_configuration(exported["configuration"])
    framed = export_experiment(run_experiment(config), build_commit="other-commit")
    assert framed["manifest"]["experimentHash"] == exported["manifest"]["experimentHash"]
    assert reproduce(framed) == exported["manifest"]["experimentHash"]
    framed["requestId"] = "another-request"
    framed["generatedAt"] = "2026-10-26T00:00:00Z"
    assert reproduce(framed) == exported["manifest"]["experimentHash"]
    framed["representative"]["frames"]["none"][0][0] = "R"
    with pytest.raises(ValueError):
        reproduce(framed)


def test_duplicate_manifest_metadata_and_document_size_rejected(exported, monkeypatch):
    from simulation import exports

    changed = copy.deepcopy(exported)
    changed["manifest"]["rootSeed"] += 1
    with pytest.raises(ValueError):
        reproduce(changed)
    monkeypatch.setattr(exports, "MAX_DOCUMENT_BYTES", 10)
    with pytest.raises(ValueError, match="límite"):
        load_export(b" " * 11)


def test_export_cli_roundtrip_and_no_overwrite(tmp_path):
    root = Path(__file__).resolve().parents[2]
    config = tmp_path / "config.json"
    config.write_text(
        '{"scenario":{"populationSize":50,"days":2},"intervention":{"vaccines":10},"repetitions":2}'
    )
    output = tmp_path / "result.json"
    command = [
        sys.executable,
        str(root / "scripts/export_experiment.py"),
        str(config),
        str(output),
        "--no-frames",
        "--build-commit",
        "cli-test",
    ]
    result = subprocess.run(command, cwd=tmp_path, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert output.with_suffix(".zip").exists()
    document = load_export(output.read_bytes())
    assert document["manifest"]["buildCommit"] == "cli-test"
    assert reproduce(document) == document["manifest"]["experimentHash"]
    original = output.read_bytes()
    assert subprocess.run(command, cwd=tmp_path, capture_output=True).returncode != 0
    assert output.read_bytes() == original
