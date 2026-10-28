"""El arnés de salidas debe medir respuestas reales y no guardar capacidades."""

import json
import subprocess
import sys
from pathlib import Path

from domain.configuration import normalize_configuration
from domain.reproducibility import canonical_json
from simulation.experiments import run_experiment
from simulation.exports import export_experiment


def test_outputs_benchmark_uses_real_pdf_zip_and_job(tmp_path):
    source = export_experiment(
        run_experiment(
            normalize_configuration(
                {
                    "scenario": {"populationSize": 50, "days": 3},
                    "intervention": {"vaccines": 3},
                    "repetitions": 2,
                }
            )
        )
    )
    experiment = tmp_path / "experiment.json"
    experiment.write_bytes(canonical_json(source))
    output = tmp_path / "outputs.json"
    script = Path(__file__).resolve().parents[2] / "scripts/benchmark_backend_outputs.py"
    result = subprocess.run(
        [
            sys.executable,
            "-X",
            "utf8",
            str(script),
            str(experiment),
            "--samples",
            "1",
            "--load-probe",
            "--output",
            str(output),
        ],
        capture_output=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr.decode()
    report = json.loads(output.read_text())
    assert report["samples"][0]["pdfBytes"] > 1000
    assert report["samples"][0]["zipBytes"] > 1000
    assert report["job"]["experimentHash"] == source["manifest"]["experimentHash"]
    assert report["job"]["states"][-1] == "completed"
    assert "token" not in output.read_text().lower()
    assert not report["stagingAcceptance"]
    assert len(report["loadProbe"]["outcomes"]) == 3
    assert all(
        row["experimentHash"] == report["job"]["experimentHash"]
        for row in report["loadProbe"]["outcomes"]
    )
