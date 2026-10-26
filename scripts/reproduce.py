"""Reproduce un JSON exportado usando el mismo motor, desde cualquier directorio."""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend/src"))

from simulation.exports import MAX_DOCUMENT_BYTES, load_export, reproduce


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("experiment", type=Path)
    args = parser.parse_args()
    try:
        with args.experiment.open("rb") as stream:
            data = stream.read(MAX_DOCUMENT_BYTES + 1)
        print(reproduce(load_export(data)))
    except (ValueError, OSError):
        print(
            "No se pudo reproducir: documento inválido, entorno incompatible o resultados diferentes.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
