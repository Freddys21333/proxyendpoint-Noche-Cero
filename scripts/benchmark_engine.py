"""Mide el escenario por defecto sin frames y emite un JSON reproducible."""

import argparse
import json
import platform
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend/src"))

import numpy as np

from domain.configuration import normalize_configuration
from simulation.experiments import run_experiment


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repetitions", type=int, default=30)
    parser.add_argument("--population-size", type=int, default=1000)
    parser.add_argument("--days", type=int, default=90)
    parser.add_argument("--root-seed", type=int, default=20261026)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        configuration = normalize_configuration(
            {
                "scenario": {
                    "populationSize": args.population_size,
                    "days": args.days,
                },
                "repetitions": args.repetitions,
                "rootSeed": args.root_seed,
            }
        )
        started = time.perf_counter()
        result = run_experiment(configuration, include_representative_frames=False)
        seconds = time.perf_counter() - started
    except (ValueError, OSError) as error:
        print(f"No se pudo medir: {error}", file=sys.stderr)
        return 1

    summary = {
        policy: result["summaryByPolicy"][policy]["cumulativeInfected"]
        for policy in ("none", "random", "targeted")
    }
    report = {
        "benchmarkVersion": "engine-benchmark-v1",
        "python": platform.python_version(),
        "numpy": np.__version__,
        "platform": platform.platform(),
        "configuration": configuration.to_dict(),
        "graphHash": result["graphHash"],
        "randomnessHash": result["replicates"][0]["randomnessHash"],
        "seconds": round(seconds, 3),
        "summaryByPolicy": summary,
        "pairedComparisons": result["pairedComparisons"],
        "recommendation": result["recommendation"],
    }
    body = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output is not None:
        args.output.write_text(body, encoding="utf-8")
    print(body, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
