"""Construye ZIP Linux x86_64 sin copiar dependencias de Windows."""

import argparse
import shutil
import subprocess
import sys
import tempfile
import tomllib
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / ".tools/build/backend.zip")
    args = parser.parse_args()
    dependencies = tomllib.loads((ROOT / "backend/pyproject.toml").read_text())["project"][
        "dependencies"
    ]
    dependencies = [item.replace("jsonschema==", "jsonschema[format]==") for item in dependencies]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="lambda-build-") as directory:
        target = Path(directory)
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "--target", str(target),
             "--platform", "manylinux_2_28_x86_64", "--platform", "manylinux2014_x86_64",
             "--implementation", "cp",
             "--python-version", "3.12", "--only-binary=:all:", "--no-compile",
             *dependencies], check=True,
        )
        for source in (ROOT / "backend/src").iterdir():
            if source.is_dir() and source.name != "__pycache__":
                shutil.copytree(source, target / source.name, ignore=shutil.ignore_patterns("__pycache__"))
        (target / "schemas").mkdir(exist_ok=True)
        shutil.copy2(ROOT / "schemas/common.schema.json", target / "schemas/common.schema.json")
        with zipfile.ZipFile(args.output, "w", zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(target.rglob("*")):
                if path.is_file() and "__pycache__" not in path.parts:
                    archive.write(path, path.relative_to(target).as_posix())
    print(f"ZIP Linux: {args.output} ({args.output.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
