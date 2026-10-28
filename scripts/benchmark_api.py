"""Benchmark HTTP local completo, sin despliegue ni instrumentación pública."""

import argparse
import contextlib
import gzip
import importlib.util
import json
import platform
import sys
import threading
import time
import urllib.request
from pathlib import Path
from typing import Any
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend/src"))

from api import common
from domain.reproducibility import canonical_json
from simulation import exports


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", type=int, default=3)
    parser.add_argument("--population", type=int, default=1000)
    parser.add_argument("--days", type=int, default=90)
    parser.add_argument("--repetitions", type=int, default=30)
    parser.add_argument(
        "--mode", choices=("both", "frames", "no-frames"), default="both"
    )
    parser.add_argument(
        "--output-dir", type=Path, default=Path(".tools/api-performance")
    )
    args = parser.parse_args()
    if not 1 <= args.samples <= 20:
        parser.error("samples debe estar entre 1 y 20")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    spec = importlib.util.spec_from_file_location(
        "benchmark_serve_api", ROOT / "scripts/serve_api.py"
    )
    assert spec and spec.loader
    server_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(server_module)
    phases: dict[str, float] = {}
    completed = threading.Event()

    def measured(name: str, function: Any) -> Any:
        def wrapper(*a: Any, **kw: Any) -> Any:
            start = time.perf_counter()
            try:
                return function(*a, **kw)
            finally:
                phases[name] = phases.get(name, 0.0) + time.perf_counter() - start

        return wrapper

    original_handle = server_module.LocalHandler._handle

    def handle(self: Any) -> None:
        start = time.perf_counter()
        try:
            original_handle(self)
        finally:
            phases["httpServerTotal"] = time.perf_counter() - start
            completed.set()

    def request(
        base: str, path: str, payload: Any = None
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        phases.clear()
        completed.clear()
        raw = canonical_json(payload) if payload is not None else None
        req = urllib.request.Request(
            base + path,
            data=raw,
            headers={"Content-Type": "application/json", "Accept-Encoding": "gzip"},
        )
        start = time.perf_counter()
        with urllib.request.urlopen(req, timeout=600) as response:
            headers_at = time.perf_counter()
            compressed = response.read()
            received_at = time.perf_counter()
            decoded = (
                gzip.decompress(compressed)
                if response.headers.get("Content-Encoding") == "gzip"
                else compressed
            )
            decoded_at = time.perf_counter()
            data = json.loads(decoded)
            parsed_at = time.perf_counter()
            status = response.status
        if not completed.wait(5):
            raise RuntimeError("No terminó el handler local")
        phases.setdefault("responseSerialization", 0.0)
        timing = {
            "status": status,
            "untilHeadersSeconds": headers_at - start,
            "receiveBodySeconds": received_at - headers_at,
            "inflateSeconds": decoded_at - received_at,
            "parseSeconds": parsed_at - decoded_at,
            "clientTotalSeconds": parsed_at - start,
            "requestBytes": len(raw or b""),
            "wireBytes": len(compressed),
            "decodedBytes": len(decoded),
            "phasesSeconds": phases.copy(),
        }
        return data, timing

    measurements = []
    previews = []
    with contextlib.ExitStack() as stack:
        for module, attr, name in (
            (common, "generate_graph", "graph"),
            (common, "run_experiment", "simulation"),
            (common, "prepare_experiment", "exportIncludingValidation"),
            (exports, "_validate", "validationNestedInExport"),
            (common, "_response", "responseTotal"),
            (common, "canonical_json", "responseSerialization"),
            (common.gzip, "compress", "gzip"),
        ):
            stack.enter_context(
                patch.object(module, attr, measured(name, getattr(module, attr)))
            )
        stack.enter_context(patch.object(server_module.LocalHandler, "_handle", handle))
        server = server_module.create_server(port=0)
        stack.callback(server.server_close)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        stack.callback(lambda: (server.shutdown(), thread.join(timeout=5)))
        base = f"http://127.0.0.1:{server.server_port}/v1"
        config, _ = request(base, "/config")
        cfg = config["defaults"]
        cfg["scenario"].update(populationSize=args.population, days=args.days)
        cfg["repetitions"] = args.repetitions
        # Para muestras pequeñas de prueba, mantener las dosis dentro del contrato.
        cfg["intervention"]["vaccines"] = min(
            cfg["intervention"]["vaccines"], args.population
        )
        preview, preview_timing = request(
            base, "/scenarios/preview", {"schemaVersion": "1.0", "configuration": cfg}
        )
        previews.append(preview_timing)
        expected = None
        modes = [False, True] if args.mode == "both" else [args.mode == "frames"]
        for frames in modes:
            for index in range(args.samples):
                print(
                    f"Comparación frames={frames}, muestra {index + 1}/{args.samples}",
                    flush=True,
                )
                data, timing = request(
                    base,
                    "/simulations/compare",
                    {
                        "schemaVersion": "1.0",
                        "configuration": cfg,
                        "expectedGraphHash": preview["graphHash"],
                        "includeRepresentativeFrames": frames,
                    },
                )
                assert data["progress"] == {
                    "replicatesTotal": args.repetitions,
                    "replicatesSucceeded": args.repetitions,
                    "replicatesFailed": 0,
                }
                actual = data["manifest"]["experimentHash"]
                expected = actual if expected is None else expected
                assert actual == expected
                assert data["graphHash"] == preview["graphHash"]
                assert (data["representative"]["frames"] is not None) == frames
                if index == 0:
                    raw_source = canonical_json(data)
                    assert (
                        exports.load_export(raw_source) == data
                    )  # Fuera del tiempo HTTP.
                    (
                        args.output_dir
                        / f"experiment-{'frames' if frames else 'no-frames'}.json"
                    ).write_bytes(raw_source)
                timing.update(frames=frames, index=index, experimentHash=actual)
                measurements.append(timing)
                print(json.dumps(timing), flush=True)
    import numpy as np

    summaries = []
    for frames in modes:
        values = [
            m["clientTotalSeconds"] for m in measurements if m["frames"] == frames
        ]
        summaries.append(
            {
                "frames": frames,
                "n": len(values),
                "medianSeconds": float(np.median(values)),
                "p95DescriptiveSeconds": float(np.percentile(values, 95)),
                "maxSeconds": max(values),
            }
        )
    report = {
        "benchmarkVersion": "api-http-local-v1",
        "platform": platform.platform(),
        "python": platform.python_version(),
        "configuration": cfg,
        "samples": measurements,
        "preview": previews,
        "summary": summaries,
        "experimentHash": expected,
        "scientificGate": False,
        "stagingAcceptance": False,
        "phaseNote": "validationNestedInExport está incluida en exportIncludingValidation; no sumar fases anidadas",
    }
    (args.output_dir / "report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    print(json.dumps(summaries), flush=True)


if __name__ == "__main__":
    main()
