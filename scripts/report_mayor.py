"""Genera un informe PDF reproducible desde un JSON de experimento completo."""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend/src"))

from domain.errors import ConfigurationError
from simulation.exports import MAX_DOCUMENT_BYTES, load_export
from simulation.report import build_report, render_pdf


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("experiment", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        if args.experiment.resolve() == args.output.resolve():
            raise ValueError("El destino no puede reemplazar el experimento.")
        with args.experiment.open("rb") as stream:
            source = load_export(stream.read(MAX_DOCUMENT_BYTES + 1))
        pdf = render_pdf(build_report(source))
        args.output.write_bytes(pdf)
        print(
            f"Informe generado: {args.output}; {source['manifest']['experimentHash']}"
        )
    except (ValueError, OSError, ConfigurationError):
        print(
            "No se pudo generar: documento inválido o destino no disponible.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
