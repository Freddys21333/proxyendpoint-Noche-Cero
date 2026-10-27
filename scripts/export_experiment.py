"""Ejecuta una configuración y escribe JSON más ZIP de análisis local."""

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend/src"))

from domain.configuration import decode_json_document, normalize_configuration
from domain.reproducibility import canonical_json
from simulation.experiments import run_experiment
from simulation.exports import export_experiment, export_zip


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("configuration", type=Path)
    parser.add_argument(
        "output", type=Path, help="Ruta JSON nueva; ZIP con mismo nombre"
    )
    parser.add_argument("--no-frames", action="store_true")
    parser.add_argument(
        "--build-commit", default=os.environ.get("BUILD_COMMIT", "unknown")
    )
    args = parser.parse_args()
    try:
        if args.output.suffix.lower() != ".json":
            raise ValueError("La salida debe tener extensión .json.")
        if args.output.exists() or args.output.with_suffix(".zip").exists():
            raise ValueError("La salida ya existe.")
        with args.configuration.open("rb") as stream:
            configuration = normalize_configuration(
                decode_json_document(stream.read(65537), max_bytes=65536)
            )
        document = export_experiment(
            run_experiment(
                configuration, include_representative_frames=not args.no_frames
            ),
            build_commit=args.build_commit,
        )
        body, zipped = canonical_json(document), export_zip(document)
        with args.output.open("xb") as stream:
            stream.write(body)
        with args.output.with_suffix(".zip").open("xb") as stream:
            stream.write(zipped)
        print(document["manifest"]["experimentHash"])
    except (ValueError, OSError):
        print(
            "No se pudo exportar; revisa configuración, límites y rutas de salida.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
