"""P-08: evidencia local reproducible con presupuesto e inventario reales del motor."""

import argparse
import hashlib
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend/src"))

from domain.configuration import normalize_configuration
from domain.reproducibility import canonical_json
from simulation.experiments import run_experiment
from simulation.exports import export_experiment
from simulation.report import build_report, render_pdf


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=Path(".tools/p08-evidence"))
    parser.add_argument("--api-base", help="Opcional: URL local terminada en /v1")
    args = parser.parse_args()
    cfg = normalize_configuration(
        {
            "rootSeed": 20261026,
            "scenario": {"populationSize": 60, "days": 7},
            "repetitions": 30,
            "intervention": {
                "vaccines": 3,
                "combined": {
                    "modelVersion": "combined-educational-v1",
                    "budgetCents": 200000,
                    "vaccineCostCents": 1000,
                    "closureCostCents": 10000,
                    "closureContext": "school",
                    "closureStart": 0,
                    "closureDays": 3,
                    "brigadeCostCents": 200,
                    "brigadeDailyCapacity": 10,
                    "brigadeReduction": 0.3,
                    "brigadeStart": 0,
                    "brigadeDays": 7,
                    "resourceSchedule": {
                        "modelVersion": "daily-inventory-v1",
                        "vaccineDailyCapacity": 2,
                        "initialBrigadeSupplies": 6,
                        "deliveries": [
                            {"day": 2, "vaccines": 2, "brigadeSupplies": 10}
                        ],
                    },
                },
            },
        }
    )
    source = export_experiment(run_experiment(cfg, include_representative_frames=False))
    projection = build_report(source)
    pdf = render_pdf(projection)
    assert pdf == render_pdf(build_report(source))
    if args.api_base:
        request = urllib.request.Request(
            args.api_base.rstrip("/") + "/reports/mayor",
            data=canonical_json(source),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            assert response.headers["Content-Type"] == "application/pdf"
            assert response.read() == pdf
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "experiment.json").write_bytes(canonical_json(source))
    (args.output_dir / "report.json").write_bytes(canonical_json(projection))
    (args.output_dir / "report.pdf").write_bytes(pdf)
    print(source["manifest"]["experimentHash"])
    print(f"PDF sha256:{hashlib.sha256(pdf).hexdigest()} ({len(pdf)} bytes)")
    print(f"Conclusión: {projection['conclusion']}")


if __name__ == "__main__":
    main()
