"""Mide PDF HTTP, ZIP local y jobs reales, sin AWS ni credenciales persistidas."""

import argparse
import copy
import gzip
import hashlib
import importlib.util
import json
import secrets
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend/src"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("experiment", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--samples", type=int, default=3)
    parser.add_argument("--reference-configuration", type=Path)
    parser.add_argument("--load-probe", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.samples <= 20:
        parser.error("samples debe estar entre 1 y 20")
    reference_hash = None
    if args.reference_configuration:
        reference_hash = hashlib.sha256(
            args.reference_configuration.read_bytes()
        ).hexdigest()
        spec = importlib.util.spec_from_file_location(
            "domain.configuration", args.reference_configuration
        )
        assert spec and spec.loader
        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module
        spec.loader.exec_module(module)

    from domain.reproducibility import canonical_json
    from simulation.exports import export_zip, load_export
    from simulation.jobs import GLOBAL_JOB_MANAGER, MAX_EDGE_DAY_REPLICATES

    spec = importlib.util.spec_from_file_location(
        "outputs_serve_api", ROOT / "scripts/serve_api.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    raw = args.experiment.read_bytes()
    source = load_export(raw)  # Preflight fuera de los tiempos registrados.
    measurements = []
    server = module.create_server(port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_port}"

    def request(path, body=None, headers=None):
        data = canonical_json(body) if body is not None else None
        req = urllib.request.Request(
            base + path,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Accept-Encoding": "gzip",
                **(headers or {}),
            },
        )
        start = time.perf_counter()
        try:
            response = urllib.request.urlopen(req, timeout=600)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            payload = response.read()
            if response.headers.get("Content-Encoding") == "gzip":
                payload = gzip.decompress(payload)
            content = (
                json.loads(payload)
                if "json" in response.headers.get("Content-Type", "")
                else payload
            )
            return response.status, content, time.perf_counter() - start

    try:
        for index in range(args.samples):
            code, pdf, seconds = request("/v1/reports/mayor", source)
            assert code == 200 and pdf.startswith(b"%PDF")
            start = time.perf_counter()
            zipped = export_zip(source)
            zip_seconds = time.perf_counter() - start
            row = {
                "index": index,
                "pdfHttpSeconds": seconds,
                "pdfBytes": len(pdf),
                "pdfSHA256": hashlib.sha256(pdf).hexdigest(),
                "zipLocalSeconds": zip_seconds,
                "zipBytes": len(zipped),
                "zipSHA256": hashlib.sha256(zipped).hexdigest(),
            }
            measurements.append(row)
            print(json.dumps(row), flush=True)

        token = secrets.token_hex(32)  # Solo memoria; nunca se escribe en reporte/log.
        headers = {"X-Job-Token": token, "Idempotency-Key": secrets.token_hex(16)}
        body = {
            "schemaVersion": source["schemaVersion"],
            "configuration": source["configuration"],
            "expectedGraphHash": source["graphHash"],
            "includeRepresentativeFrames": source["representative"]["frames"]
            is not None,
        }
        capacity = MAX_EDGE_DAY_REPLICATES // (
            len(source["graph"]["edges"]) * source["configuration"]["scenario"]["days"]
        )
        requested_repetitions = source["configuration"]["repetitions"]
        rejection = None
        if requested_repetitions > capacity:
            code, _rejected, seconds = request("/v1/jobs", body, headers)
            assert code == 422
            rejection = {
                "status": code,
                "seconds": seconds,
                "reason": "El default supera MAX_EDGE_DAY_REPLICATES; no se amplía el límite.",
            }
            body = copy.deepcopy(body)
            body["configuration"]["repetitions"] = max(
                2, min(requested_repetitions, capacity)
            )
        start = time.perf_counter()
        code, created, create_seconds = request("/v1/jobs", body, headers)
        assert code == 202, created
        states = []
        while True:
            assert time.perf_counter() - start < 600
            code, status, _ = request(created["statusUrl"], headers=headers)
            assert code == 200
            if not states or status["status"] != states[-1]:
                states.append(status["status"])
            if status["status"] in ("completed", "failed", "cancelled"):
                break
            time.sleep(0.2)
        assert status["status"] == "completed", status
        ready_seconds = time.perf_counter() - start
        code, result, result_seconds = request(
            created["statusUrl"] + "/result", headers=headers
        )
        assert code == 200
        load_export(
            canonical_json(result)
        )  # Comprobación adicional fuera del tiempo HTTP.
        if rejection is None:
            assert (
                result["manifest"]["experimentHash"]
                == source["manifest"]["experimentHash"]
            )
        job = {
            "requestedRepetitions": requested_repetitions,
            "executedRepetitions": body["configuration"]["repetitions"],
            "defaultRejection": rejection,
            "n": 1,
            "createHttpSeconds": create_seconds,
            "untilReadySecondsIncludingCreateAndPolling": ready_seconds,
            "resultHttpSeconds": result_seconds,
            "states": states,
            "experimentHash": result["manifest"]["experimentHash"],
        }
        load_probe = None
        if args.load_probe:
            # Tres trabajos: dos workers y cola acotada existente. Misma configuración.
            started = time.perf_counter()
            pending = []
            for _ in range(3):
                capability = secrets.token_hex(32)
                auth = {
                    "X-Job-Token": capability,
                    "Idempotency-Key": secrets.token_hex(16),
                }
                code, created, _ = request("/v1/jobs", body, auth)
                assert code == 202
                pending.append(
                    {
                        "url": created["statusUrl"],
                        "auth": auth,
                        "states": [],
                        "readySeconds": None,
                    }
                )
            health_seconds = []
            while any(item["readySeconds"] is None for item in pending):
                assert time.perf_counter() - started < 600
                code, health, seconds = request("/v1/health")
                assert code == 200 and health["status"] == "ok"
                health_seconds.append(seconds)
                for item in pending:
                    if item["readySeconds"] is not None:
                        continue
                    code, snapshot, _ = request(item["url"], headers=item["auth"])
                    assert code == 200
                    state = snapshot["status"]
                    if not item["states"] or state != item["states"][-1]:
                        item["states"].append(state)
                    assert state not in ("failed", "cancelled")
                    if state == "completed":
                        item["readySeconds"] = time.perf_counter() - started
                time.sleep(0.2)
            outcomes = []
            for item in pending:
                code, data, seconds = request(
                    item["url"] + "/result", headers=item["auth"]
                )
                assert code == 200
                assert data["manifest"]["experimentHash"] == job["experimentHash"]
                load_export(canonical_json(data))
                outcomes.append(
                    {
                        "states": item["states"],
                        "readySecondsSinceFirstCreate": item["readySeconds"],
                        "resultHttpSeconds": seconds,
                        "experimentHash": data["manifest"]["experimentHash"],
                    }
                )
            load_probe = {
                "n": 1,
                "submittedJobs": 3,
                "configuredWorkers": 2,
                "repetitionsEach": body["configuration"]["repetitions"],
                "healthHttpSeconds": health_seconds,
                "maxHealthHttpSeconds": max(health_seconds),
                "outcomes": outcomes,
                "note": "Una tanda local, no certifica capacidad multiusuario ni AWS. Lecturas de resultados medidas después de completar los tres trabajos.",
            }
        report = {
            "kind": "backend-outputs-local-v1",
            "sourceExperimentHash": source["manifest"]["experimentHash"],
            "configuration": source["configuration"],
            "referenceConfigurationSHA256": reference_hash,
            "samples": measurements,
            "job": job,
            "loadProbe": load_probe,
            "stagingAcceptance": False,
            "note": "PDF por HTTP incluye carga y parseo servidor; ZIP es función local, no endpoint. Jobs sin carga competidora propia; n=1 descriptivo, no prueba de concurrencia.",
        }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(job), flush=True)
    finally:
        server.shutdown()
        server.server_close()
        GLOBAL_JOB_MANAGER.close()


if __name__ == "__main__":
    main()
