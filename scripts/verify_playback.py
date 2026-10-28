"""P-07: medir y comprobar integridad temporal sobre una ejecución real local."""

import argparse
import copy
import json
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend/src"))

from domain.configuration import normalize_configuration
from domain.reproducibility import canonical_json
from simulation.experiments import run_experiment
from simulation.exports import export_experiment, load_export
from simulation.playback import validate_playback


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--population", type=int, default=1000)
    parser.add_argument("--days", type=int, default=90)
    parser.add_argument("--output-dir", type=Path, default=Path(".tools/p07-backend"))
    args = parser.parse_args()
    cfg = normalize_configuration(
        {
            "rootSeed": 20261026,
            "repetitions": 2,
            "scenario": {"populationSize": args.population, "days": args.days},
            "intervention": {"vaccines": min(100, args.population)},
        }
    )
    start = time.perf_counter()
    source = export_experiment(run_experiment(cfg))
    generation = time.perf_counter() - start
    samples = []
    for _ in range(5):
        start = time.perf_counter()
        validate_playback(source)
        samples.append(time.perf_counter() - start)
    raw = canonical_json(source)
    start = time.perf_counter()
    assert load_export(raw) == source
    loading = time.perf_counter() - start
    changed = copy.deepcopy(source)
    frame = changed["representative"]["frames"]["none"][0]
    a, b = frame.index("I"), frame.index("S")
    frame[a], frame[b] = frame[b], frame[a]
    try:
        load_export(canonical_json(changed))
    except ValueError:
        pass
    else:
        raise AssertionError("Se aceptó una identidad temporal falsa.")
    report = {
        "kind": "p07-backend-integrity",
        "scientificGate": False,
        "configuration": cfg.to_dict(),
        "experimentHash": source["manifest"]["experimentHash"],
        "representativeIndex": source["representative"]["index"],
        "frameStates": 3 * args.population * (args.days + 1),
        "jsonBytes": len(raw),
        "generationIncludingExportSeconds": generation,
        "validationSamplesSeconds": samples,
        "validationMedianSeconds": statistics.median(samples),
        "fullLoadSeconds": loading,
        "identitySwapRejected": True,
    }
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "experiment.json").write_bytes(raw)
    (args.output_dir / "report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    print(json.dumps(report))


if __name__ == "__main__":
    main()
