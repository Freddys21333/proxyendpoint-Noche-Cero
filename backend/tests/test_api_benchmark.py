"""El benchmark mide HTTP real y declara tamaño de muestra y fases anidadas."""

import json
import subprocess
import sys
from pathlib import Path


def test_benchmark_http_small_scenario_has_coherent_phases_and_identical_modes(tmp_path):
    script = Path(__file__).resolve().parents[2] / "scripts/benchmark_api.py"
    run = subprocess.run(
        [
            sys.executable,
            "-X",
            "utf8",
            str(script),
            "--samples",
            "1",
            "--population",
            "50",
            "--days",
            "3",
            "--repetitions",
            "2",
            "--output-dir",
            str(tmp_path),
        ],
        capture_output=True,
        timeout=60,
    )
    assert run.returncode == 0, run.stderr.decode()
    report = json.loads((tmp_path / "report.json").read_text(encoding="utf-8"))
    assert not report["scientificGate"] and not report["stagingAcceptance"]
    assert len(report["samples"]) == 2
    assert {s["experimentHash"] for s in report["samples"]} == {report["experimentHash"]}
    for sample in report["samples"]:
        assert sample["status"] == 200
        assert sample["clientTotalSeconds"] >= sample["untilHeadersSeconds"] > 0
        assert sample["wireBytes"] < sample["decodedBytes"]
        phases = sample["phasesSeconds"]
        assert 0 < phases["validationNestedInExport"] <= phases["exportIncludingValidation"]
        assert 0 < phases["gzip"] <= phases["responseTotal"]
    for summary in report["summary"]:
        assert summary["n"] == 1
        assert summary["p95DescriptiveSeconds"] == summary["medianSeconds"]
