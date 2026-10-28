"""Mide carga/exportación del mismo JSON y verifica identidad exacta de datos."""

import argparse
import json
import platform
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend/src"))

from domain.reproducibility import canonical_json
from simulation.exports import MAX_DOCUMENT_BYTES, export_experiment, load_export


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("experiment", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    with args.experiment.open("rb") as stream:
        raw = stream.read(MAX_DOCUMENT_BYTES + 1)
    start = time.perf_counter()
    source = load_export(raw)
    load_seconds = time.perf_counter() - start
    start = time.perf_counter()
    exported = export_experiment(
        source,
        build_commit=source["manifest"]["buildCommit"],
        request_id=source["requestId"],
    )
    export_seconds = time.perf_counter() - start
    exported["generatedAt"] = source["generatedAt"]
    assert exported == source
    assert canonical_json(exported) == canonical_json(source)
    report = {
        "kind": "export-performance-v1",
        "python": platform.python_version(),
        "source": str(args.experiment),
        "bytes": len(raw),
        "configuration": source["configuration"],
        "experimentHash": source["manifest"]["experimentHash"],
        "loadSeconds": load_seconds,
        "exportSeconds": export_seconds,
        "exactContentPreserved": True,
        "scientificGate": False,
    }
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
