"""Ejecuta, reproduce y resume la matriz científica T-22 v1."""

import argparse
import hashlib
import json
import os
import platform
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend/src"))
sys.path.insert(0, str(ROOT / "scripts"))

from check_validation_protocol import check_protocol  # noqa: E402

from domain.reproducibility import canonical_json  # noqa: E402
from simulation.experiments import POLICIES, statistics  # noqa: E402

PROTOCOL_ROOT = ROOT / "specs/validation/t22-v1"
ATTEMPT_DEFAULT = ROOT / ".tools/t22-v1-attempt-01"
REPORT_DEFAULT = ROOT / "docs/evidencia/t22-v1-ejecucion.md"
SUMMARY_DEFAULT = ROOT / "docs/evidencia/t22-v1-ejecucion.json"
KINDS = ("primary", "descriptive-contrast", "technical-control")


def now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def relative(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return str(path.resolve())


def git_value(*args: str) -> str:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return "unknown"
    return result.stdout.strip()


def python_executable() -> Path:
    candidates = (
        ROOT / "backend/.venv/bin/python",
        ROOT / "backend/.venv/Scripts/python.exe",
    )
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return Path(sys.executable)


def environment(source_commit: str) -> dict[str, Any]:
    from importlib.metadata import PackageNotFoundError, version

    dependencies = {}
    for name in ("numpy", "networkx", "jsonschema"):
        try:
            dependencies[name] = version(name)
        except PackageNotFoundError:
            dependencies[name] = None
    return {
        "generatedAt": now(),
        "sourceCommit": source_commit,
        "buildCommit": source_commit,
        "dirtyWorktree": bool(git_value("status", "--porcelain")),
        "worktreeStatus": git_value("status", "--porcelain").splitlines(),
        "python": sys.version,
        "pythonExecutable": str(python_executable()),
        "platform": platform.platform(),
        "machine": platform.machine(),
        "processor": platform.processor(),
        "cpuCount": os.cpu_count(),
        "dependencies": dependencies,
        "uvLockSHA256": sha256_file(ROOT / "backend/uv.lock"),
        "runnerSHA256": sha256_file(Path(__file__).resolve()),
        "protocol": check_protocol(PROTOCOL_ROOT),
        "protocolSHA256": sha256_file(PROTOCOL_ROOT / "protocol.json"),
        "command": " ".join([sys.executable, "scripts/run_t22.py", *sys.argv[1:]]),
    }


def run_command(command: list[str], log_path: Path) -> dict[str, Any]:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    start = time.perf_counter()
    with log_path.open("w", encoding="utf-8") as log:
        log.write("$ " + " ".join(command) + "\n")
        log.flush()
        try:
            completed = subprocess.run(
                command,
                cwd=ROOT,
                stdout=log,
                stderr=subprocess.STDOUT,
                text=True,
                check=False,
            )
            code = completed.returncode
        except OSError as error:
            log.write(f"\n{type(error).__name__}: {error}\n")
            code = 127
    elapsed = time.perf_counter() - start
    lines = [
        line.strip()
        for line in log_path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("$ ")
    ]
    return {
        "command": command,
        "exitCode": code,
        "elapsedSeconds": round(elapsed, 3),
        "log": relative(log_path),
        "output": lines[-1] if lines else "",
    }


def run_paths(attempt: Path, run_id: str) -> tuple[Path, Path, Path]:
    return (
        attempt / f"{run_id}.json",
        attempt / f"{run_id}.zip",
        attempt / "runs" / f"{run_id}.json",
    )


class ExecutionError(RuntimeError):
    pass


def execute_export(
    row: dict[str, Any],
    attempt: Path,
    python: Path,
    source_commit: str,
    resume: bool,
) -> dict[str, Any]:
    json_path, zip_path, metadata_path = run_paths(attempt, row["id"])
    metadata = read_json(metadata_path) if metadata_path.exists() else {}
    if metadata.get("status") == "failed":
        raise ExecutionError(
            f"{row['id']} tiene un fallo previo registrado; usar un intento nuevo."
        )
    export = metadata.get("export")
    if resume and json_path.exists() and zip_path.exists():
        document = read_json(json_path)
        return {
            "status": "reused",
            "json": relative(json_path),
            "zip": relative(zip_path),
            "sha256": sha256_file(json_path),
            "zipSHA256": sha256_file(zip_path),
            "sizeBytes": json_path.stat().st_size,
            "zipSizeBytes": zip_path.stat().st_size,
            "experimentHash": document["manifest"]["experimentHash"],
            "generatedAt": document.get("generatedAt"),
            "elapsedSeconds": None,
            "command": None,
            "log": export.get("log") if isinstance(export, dict) else None,
        }
    if json_path.exists() or zip_path.exists():
        raise ExecutionError(
            f"{row['id']} tiene una salida incompleta; usar un intento nuevo."
        )
    result = run_command(
        [
            str(python),
            "scripts/export_experiment.py",
            str(PROTOCOL_ROOT / row["configuration"]),
            str(json_path),
            "--no-frames",
            "--build-commit",
            source_commit,
        ],
        attempt / "logs" / f"{row['id']}.export.log",
    )
    if result["exitCode"] != 0 or not json_path.exists() or not zip_path.exists():
        raise ExecutionError(f"No se pudo exportar {row['id']}.")
    document = read_json(json_path)
    return {
        "status": "ok",
        "json": relative(json_path),
        "zip": relative(zip_path),
        "sha256": sha256_file(json_path),
        "zipSHA256": sha256_file(zip_path),
        "sizeBytes": json_path.stat().st_size,
        "zipSizeBytes": zip_path.stat().st_size,
        "experimentHash": document["manifest"]["experimentHash"],
        "generatedAt": document.get("generatedAt"),
        "elapsedSeconds": result["elapsedSeconds"],
        "command": result["command"],
        "log": result["log"],
    }


def execute_reproductions(
    row: dict[str, Any],
    attempt: Path,
    python: Path,
    export: dict[str, Any],
    metadata: dict[str, Any],
) -> list[dict[str, Any]]:
    expected_count = 3 if row["id"] == "base-root-0" else 1
    json_path, _, _ = run_paths(attempt, row["id"])
    existing = [
        item for item in metadata.get("reproductions", []) if item.get("status") == "ok"
    ]
    reproductions = existing[:expected_count]
    while len(reproductions) < expected_count:
        number = len(reproductions) + 1
        result = run_command(
            [str(python), "scripts/reproduce.py", str(json_path)],
            attempt / "logs" / f"{row['id']}.reproduce-{number}.log",
        )
        item = {
            "attempt": number,
            "status": "ok"
            if result["exitCode"] == 0 and result["output"] == export["experimentHash"]
            else "failed",
            "expectedHash": export["experimentHash"],
            "obtainedHash": result["output"] or None,
            "exitCode": result["exitCode"],
            "elapsedSeconds": result["elapsedSeconds"],
            "log": result["log"],
            "command": result["command"],
        }
        reproductions.append(item)
        if item["status"] != "ok":
            raise ExecutionError(f"Falló la reproducción {number} de {row['id']}.")
    return reproductions


def execute_run(
    row: dict[str, Any],
    attempt: Path,
    python: Path,
    source_commit: str,
    resume: bool,
) -> dict[str, Any]:
    _, _, metadata_path = run_paths(attempt, row["id"])
    metadata = read_json(metadata_path) if metadata_path.exists() else {}
    if metadata.get("status") == "failed":
        raise ExecutionError(
            f"{row['id']} tiene un fallo previo registrado; usar un intento nuevo."
        )
    started = time.time()
    export = execute_export(row, attempt, python, source_commit, resume)
    metadata = {
        "id": row["id"],
        "kind": row["kind"],
        "configuration": row["configuration"],
        "rootSeed": row["rootSeed"],
        "repetitions": row["repetitions"],
        "status": "running",
        "startedAt": metadata.get("startedAt", now()),
        "updatedAt": now(),
        "export": export,
        "reproductions": metadata.get("reproductions", []),
    }
    write_json(metadata_path, metadata)
    try:
        metadata["reproductions"] = execute_reproductions(
            row, attempt, python, export, metadata
        )
    except ExecutionError:
        metadata["status"] = "failed"
        metadata["updatedAt"] = now()
        metadata["wallSeconds"] = round(time.time() - started, 3)
        write_json(metadata_path, metadata)
        raise
    metadata["status"] = "ok"
    metadata["updatedAt"] = now()
    metadata["wallSeconds"] = round(time.time() - started, 3)
    write_json(metadata_path, metadata)
    return metadata


def execute_rows(
    rows: list[dict[str, Any]],
    attempt: Path,
    python: Path,
    source_commit: str,
    resume: bool,
) -> None:
    for index, row in enumerate(rows, start=1):
        print(f"[{index}/{len(rows)}] {row['id']}", flush=True)
        execute_run(row, attempt, python, source_commit, resume)


def daily_equal(left: list[dict[str, Any]], right: list[dict[str, Any]]) -> bool:
    return canonical_json(left) == canonical_json(right)


def common_invariants(document: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    configuration = document["configuration"]
    population = configuration["scenario"]["populationSize"]
    days = configuration["scenario"]["days"]
    initial = configuration["scenario"]["initialInfectious"]
    vaccines = configuration["intervention"]["vaccines"]
    replicates = document["replicates"]
    if len(replicates) != configuration["repetitions"]:
        failures.append("cantidad de réplicas distinta de la configuración")
    indices = [rep["index"] for rep in replicates]
    if indices != list(range(len(replicates))):
        failures.append("índices de réplica incompletos o desordenados")
    for rep in replicates:
        label = f"rep {rep['index']}"
        if set(rep["policies"]) != set(POLICIES):
            failures.append(f"{label}: faltan políticas")
            continue
        initial_exposed = {
            (
                rep["policies"][policy]["daily"][0]["e"],
                rep["policies"][policy]["daily"][0]["i"],
            )
            for policy in POLICIES
        }
        initial_non_susceptible = {
            rep["policies"][policy]["daily"][0]["s"]
            + rep["policies"][policy]["daily"][0]["r"]
            for policy in POLICIES
        }
        if len(initial_exposed) != 1 or len(initial_non_susceptible) != 1:
            failures.append(f"{label}: estado inicial distinto entre políticas")
        for policy in POLICIES:
            result = rep["policies"][policy]
            daily = result["daily"]
            metrics = result["metrics"]
            selections = result["selections"]
            prefix = f"{label}/{policy}"
            if len(daily) != days + 1:
                failures.append(f"{prefix}: serie diaria con longitud incorrecta")
                continue
            if [row["day"] for row in daily] != list(range(days + 1)):
                failures.append(f"{prefix}: días incompletos")
            for row in daily:
                if any(
                    type(row[key]) is not int or row[key] < 0
                    for key in ("s", "e", "i", "r")
                ):
                    failures.append(f"{prefix}: estados no enteros o negativos")
                    break
                if row["s"] + row["e"] + row["i"] + row["r"] != population:
                    failures.append(f"{prefix}: conservación S+E+I+R rota")
                    break
            if daily[0]["cumulativeInfected"] != initial:
                failures.append(f"{prefix}: acumulado inicial distinto de I0")
            cumulative = [row["cumulativeInfected"] for row in daily]
            if cumulative != sorted(cumulative):
                failures.append(f"{prefix}: acumulado no monótono")
            if metrics["cumulativeInfected"] != cumulative[-1]:
                failures.append(f"{prefix}: métrica acumulada no coincide con la serie")
            nodes = [selection["nodeId"] for selection in selections]
            if len(nodes) != len(set(nodes)):
                failures.append(f"{prefix}: dosis repetidas")
            if any(selection["day"] not in range(days + 1) for selection in selections):
                failures.append(f"{prefix}: selección fuera del horizonte")
            if any(selection["stateAtDecision"] != "S" for selection in selections):
                failures.append(f"{prefix}: selección fuera de estado S")
            if len(selections) != metrics["vaccinesAssigned"]:
                failures.append(
                    f"{prefix}: dosis asignadas no coinciden con selecciones"
                )
            if (
                sum(bool(selection["effective"]) for selection in selections)
                != metrics["vaccinesEffective"]
            ):
                failures.append(
                    f"{prefix}: dosis efectivas no coinciden con selecciones"
                )
            if len(selections) > vaccines:
                failures.append(f"{prefix}: exceso de dosis")
            if policy == "none":
                if (
                    selections
                    or metrics["vaccinesAssigned"]
                    or metrics["vaccinesEffective"]
                ):
                    failures.append(f"{prefix}: política none aplicó vacunas")
            elif metrics["vaccinesAssigned"] + metrics["vaccinesUnused"] != vaccines:
                failures.append(f"{prefix}: asignadas + sin usar no suma el inventario")
    return failures


def control_invariants(row: dict[str, Any], document: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    initial = document["configuration"]["scenario"]["initialInfectious"]
    vaccines = document["configuration"]["intervention"]["vaccines"]
    for rep in document["replicates"]:
        label = f"rep {rep['index']}"
        policies = rep["policies"]
        if row["id"] == "control-zero-vaccines":
            if not (
                daily_equal(policies["none"]["daily"], policies["random"]["daily"])
                and daily_equal(
                    policies["none"]["daily"], policies["targeted"]["daily"]
                )
            ):
                failures.append(f"{label}: series diarias no idénticas con K=0")
        elif row["id"] == "control-zero-transmission":
            if any(
                daily["cumulativeInfected"] != initial
                for daily in policies["none"]["daily"]
            ):
                failures.append(f"{label}: acumulado distinto de I0 con beta=0")
        elif row["id"] == "control-zero-efficacy":
            if not (
                daily_equal(policies["none"]["daily"], policies["random"]["daily"])
                and daily_equal(
                    policies["none"]["daily"], policies["targeted"]["daily"]
                )
            ):
                failures.append(f"{label}: series diarias no idénticas con eficacia=0")
            if any(
                policies[policy]["metrics"]["vaccinesEffective"] != 0
                for policy in ("random", "targeted")
            ):
                failures.append(f"{label}: dosis efectivas con eficacia=0")
        elif row["id"] == "control-full-coverage":
            for policy in ("random", "targeted"):
                metrics = policies[policy]["metrics"]
                if (
                    metrics["vaccinesAssigned"] != 49
                    or metrics["vaccinesEffective"] != 49
                    or metrics["vaccinesUnused"] != 1
                ):
                    failures.append(f"{label}/{policy}: cobertura completa incorrecta")
            if any(
                policies[policy]["metrics"]["cumulativeInfected"] != initial
                for policy in ("random", "targeted")
            ):
                failures.append(
                    f"{label}: acumulado distinto de I0 con cobertura completa"
                )
        elif row["id"] == "control-terminal-intervention":
            series = [
                [daily["cumulativeInfected"] for daily in policies[policy]["daily"]]
                for policy in POLICIES
            ]
            if series[0] != series[1] or series[0] != series[2]:
                failures.append(f"{label}: acumulado distinto entre políticas en día T")
        if vaccines < 0:
            failures.append(f"{label}: inventario negativo")
    return failures


def run_summary(document: dict[str, Any]) -> dict[str, Any]:
    replicates = sorted(document["replicates"], key=lambda item: item["index"])
    cumulative = {
        policy: [
            rep["policies"][policy]["metrics"]["cumulativeInfected"]
            for rep in replicates
        ]
        for policy in POLICIES
    }
    d_none = [
        none - targeted
        for none, targeted in zip(
            cumulative["none"], cumulative["targeted"], strict=True
        )
    ]
    d_random = [
        random - targeted
        for random, targeted in zip(
            cumulative["random"], cumulative["targeted"], strict=True
        )
    ]
    policy_stats = {policy: statistics(cumulative[policy]) for policy in POLICIES}
    return {
        "n": len(replicates),
        "policyStats": policy_stats,
        "dNone": {
            **statistics(d_none),
            "values": d_none,
            "wins": sum(value > 0 for value in d_none),
            "ties": sum(value == 0 for value in d_none),
        },
        "dRandom": {
            **statistics(d_random),
            "values": d_random,
            "wins": sum(value > 0 for value in d_random),
            "ties": sum(value == 0 for value in d_random),
        },
        "backendRecommendation": document["recommendation"],
        "backendPaired": document["pairedComparisons"],
    }


def collect_runs(
    plan: dict[str, Any], attempt: Path
) -> tuple[dict[str, dict[str, Any]], list[str]]:
    runs: dict[str, dict[str, Any]] = {}
    failures: list[str] = []
    for row in plan["runs"]:
        json_path, zip_path, metadata_path = run_paths(attempt, row["id"])
        if not json_path.exists() or not zip_path.exists():
            failures.append(f"{row['id']}: faltan JSON/ZIP")
            continue
        metadata = read_json(metadata_path) if metadata_path.exists() else {}
        if metadata.get("status") != "ok":
            failures.append(f"{row['id']}: metadatos de ejecución no completos")
            continue
        document = read_json(json_path)
        common = common_invariants(document)
        if common:
            failures.extend(f"{row['id']}: {item}" for item in common[:5])
        control = (
            control_invariants(row, document)
            if row["kind"] == "technical-control"
            else []
        )
        if control:
            failures.extend(f"{row['id']}: {item}" for item in control[:5])
        reproductions = metadata.get("reproductions", [])
        expected = 3 if row["id"] == "base-root-0" else 1
        if len(reproductions) < expected or any(
            item.get("status") != "ok" for item in reproductions
        ):
            failures.append(f"{row['id']}: reproducciones incompletas o fallidas")
        runs[row["id"]] = {
            "row": row,
            "document": document,
            "summary": run_summary(document),
            "commonFailures": common,
            "controlFailures": control,
            "metadata": metadata,
        }
    return runs, failures


def combined_primary(
    runs: dict[str, dict[str, Any]], plan: dict[str, Any]
) -> dict[str, Any]:
    primary = [
        runs[row["id"]]
        for row in plan["runs"]
        if row["kind"] == "primary" and row["id"] in runs
    ]
    per_root = []
    all_d_none: list[int] = []
    all_d_random: list[int] = []
    all_cumulative = {policy: [] for policy in POLICIES}
    for item in primary:
        row = item["row"]
        summary = item["summary"]
        for policy in POLICIES:
            all_cumulative[policy].extend(
                [
                    rep["policies"][policy]["metrics"]["cumulativeInfected"]
                    for rep in item["document"]["replicates"]
                ]
            )
        all_d_none.extend(summary["dNone"]["values"])
        all_d_random.extend(summary["dRandom"]["values"])
        per_root.append(
            {
                "id": row["id"],
                "rootSeed": row["rootSeed"],
                "n": summary["n"],
                "means": {
                    policy: summary["policyStats"][policy]["mean"]
                    for policy in POLICIES
                },
                "dNone": summary["dNone"],
                "dRandom": summary["dRandom"],
                "backendRecommendation": summary["backendRecommendation"],
            }
        )
    return {
        "completeRoots": len(primary),
        "n": len(all_d_none),
        "policyStats": {
            policy: statistics(all_cumulative[policy]) for policy in POLICIES
        },
        "dNone": {
            **statistics(all_d_none),
            "sum": sum(all_d_none),
            "wins": sum(value > 0 for value in all_d_none),
            "ties": sum(value == 0 for value in all_d_none),
            "values": all_d_none,
        },
        "dRandom": {
            **statistics(all_d_random),
            "sum": sum(all_d_random),
            "wins": sum(value > 0 for value in all_d_random),
            "ties": sum(value == 0 for value in all_d_random),
            "values": all_d_random,
        },
        "perRoot": per_root,
    }


def decide(
    runs: dict[str, dict[str, Any]],
    failures: list[str],
    plan: dict[str, Any],
    primary: dict[str, Any],
) -> tuple[str, list[str]]:
    reasons = list(failures)
    controls = [
        runs[row["id"]]
        for row in plan["runs"]
        if row["kind"] == "technical-control" and row["id"] in runs
    ]
    control_failures = [
        item["controlFailures"] for item in controls if item["controlFailures"]
    ]
    if len(controls) != 5:
        reasons.append("controles técnicos incompletos")
    if control_failures:
        reasons.append("controles técnicos con fallos")
    if primary["completeRoots"] != 5 or primary["n"] != 150:
        reasons.append("matriz primaria incompleta")
    if reasons:
        return "INCOMPLETO/INVÁLIDO", reasons
    if primary["dNone"]["sum"] > 0 and primary["dRandom"]["sum"] > 0:
        return "APROBADO", reasons
    return "NO APROBADO", reasons


def percent(value: float | None, digits: int = 1) -> str:
    return "—" if value is None else f"{value:.{digits}f}"


def build_report(
    plan: dict[str, Any],
    runs: dict[str, dict[str, Any]],
    failures: list[str],
    primary: dict[str, Any],
    decision: str,
    reasons: list[str],
    env: dict[str, Any],
    attempt: Path,
) -> str:
    lines = [
        "# Ejecución T-22 v1",
        "",
        f"Fecha de ejecución: {now()}.",
        f"Protocolo: `t22-v1`, SHA-256 `{env['protocolSHA256']}`.",
        f"Commit de origen: `{env['sourceCommit']}`.",
        f"Intento: `{relative(attempt)}` (ignorado en Git).",
        (
            f"Entorno: Python {platform.python_version()}, "
            f"NumPy {env['dependencies'].get('numpy')}, "
            f"NetworkX {env['dependencies'].get('networkx')}, {platform.platform()}."
        ),
        "",
        f"## Decisión: **{decision}**",
        "",
    ]
    if reasons:
        lines.append("Motivos de invalidez o pendientes:")
        lines.append("")
        lines.extend(f"- {reason}" for reason in reasons)
    else:
        lines.append(
            "Las cinco raíces primarias y los controles técnicos están completos y "
            "válidos; ambas diferencias sumadas son positivas."
        )
    lines.extend(
        ["", "## Resumen primario combinado", "", "| Métrica | Valor |", "|---|---:|"]
    )
    lines.append(f"| Réplicas primarias | {primary['n']} |")
    for policy in POLICIES:
        lines.append(
            f"| Media {policy} | {percent(primary['policyStats'][policy]['mean'])} |"
        )
    lines.append(f"| Suma D_none | {primary['dNone']['sum']} |")
    lines.append(f"| Media D_none | {percent(primary['dNone']['mean'])} |")
    lines.append(f"| Victorias D_none | {primary['dNone']['wins']}/{primary['n']} |")
    lines.append(f"| Suma D_random | {primary['dRandom']['sum']} |")
    lines.append(f"| Media D_random | {percent(primary['dRandom']['mean'])} |")
    lines.append(
        f"| Victorias D_random | {primary['dRandom']['wins']}/{primary['n']} |"
    )
    lines.extend(
        [
            "",
            (
                "La estimación combinada usa las 150 réplicas con igual peso. No se calculó "
                "un bootstrap global: los intervalos por raíz que siguen son los del backend."
            ),
            "",
            "## Primario por raíz",
            "",
            "| Raíz | n | none | random | targeted | D_none | D_random | victorias random | IC D_random |",
            "|---|---:|---:|---:|---:|---:|---:|---:|---|",
        ]
    )
    for item in primary["perRoot"]:
        interval = item["backendRecommendation"]
        lines.append(
            f"| {item['id']} | {item['n']} | {percent(item['means']['none'])} | "
            f"{percent(item['means']['random'])} | {percent(item['means']['targeted'])} | "
            f"{percent(item['dNone']['mean'])} | {percent(item['dRandom']['mean'])} | "
            f"{item['dRandom']['wins']}/{item['n']} | backend: {interval['confidence']}, "
            f"ganador {interval['winner']} |"
        )
    primary_rows = [row for row in plan["runs"] if row["kind"] == "primary"]
    intervals = []
    for row in primary_rows:
        if row["id"] not in runs:
            continue
        interval = runs[row["id"]]["document"]["pairedComparisons"]["gainVsRandom"][
            "bootstrap"
        ]
        if interval:
            intervals.append(
                f"{row['id']}: [{percent(interval['lower'])}, {percent(interval['upper'])}]"
            )
    lines.extend(
        [
            "",
            "Bootstrap pareado por raíz de `random − targeted` (2000 remuestras, 95 %):",
            "",
        ]
    )
    if intervals:
        lines.extend(f"- {item}" for item in intervals)
    else:
        lines.append("- Sin datos.")
    lines.extend(
        [
            "",
            "## Controles técnicos",
            "",
            "| Control | Estado | Fallos |",
            "|---|---|---|",
        ]
    )
    for row in plan["runs"]:
        if row["kind"] != "technical-control":
            continue
        item = runs.get(row["id"])
        if not item:
            lines.append(f"| {row['id']} | FALTANTE | — |")
            continue
        state = (
            "PASA"
            if not item["controlFailures"] and not item["commonFailures"]
            else "FALLA"
        )
        count = len(item["controlFailures"]) + len(item["commonFailures"])
        lines.append(f"| {row['id']} | {state} | {count} |")
    lines.extend(
        [
            "",
            "## Contrastes descriptivos",
            "",
            "| Experimento | n | none | random | targeted | D_none | D_random |",
            "|---|---:|---:|---:|---:|---:|---:|",
        ]
    )
    for row in plan["runs"]:
        if row["kind"] != "descriptive-contrast":
            continue
        item = runs.get(row["id"])
        if not item:
            lines.append(f"| {row['id']} | 0 | — | — | — | — | — |")
            continue
        summary = item["summary"]
        means = {policy: summary["policyStats"][policy]["mean"] for policy in POLICIES}
        lines.append(
            f"| {row['id']} | {summary['n']} | {percent(means['none'])} | "
            f"{percent(means['random'])} | {percent(means['targeted'])} | "
            f"{percent(summary['dNone']['mean'])} | {percent(summary['dRandom']['mean'])} |"
        )
    lines.extend(
        [
            "",
            (
                "Los contrastes no forman parte del gate primario y no se usan para sustituir "
                "el escenario base."
            ),
            "",
            "## Inventario y reproducciones",
            "",
            "| Run | Tipo | JSON | Hash | Reproducciones | Tiempo export (s) |",
            "|---|---|---|---|---|---:|",
        ]
    )
    for row in plan["runs"]:
        item = runs.get(row["id"])
        if not item:
            lines.append(f"| {row['id']} | {row['kind']} | FALTANTE | — | — | — |")
            continue
        metadata = item["metadata"]
        export = metadata["export"]
        reproductions = metadata["reproductions"]
        ok_reproductions = sum(rep["status"] == "ok" for rep in reproductions)
        lines.append(
            f"| {row['id']} | {row['kind']} | `{export['json']}` | "
            f"`{export['experimentHash'][:12]}…` | {ok_reproductions}/{len(reproductions)} | "
            f"{percent(export['elapsedSeconds'])} |"
        )
    lines.extend(
        [
            "",
            (
                "Hash completo, tamaños, rutas ZIP, logs, comandos y tiempos por paso están en "
                f"`{relative(attempt / 'runs')}/` y en el resumen JSON."
            ),
            "",
            "## Limitaciones y datos ausentes",
            "",
            "- Cinco raíces sintéticas fijas; no son datos observados de Manta ni predicen brotes reales.",
            "- Las 30 réplicas de una raíz comparten red; no son 30 redes independientes.",
            "- Los contrastes son descriptivos y no tienen gate de superioridad.",
            "- No se calcularon costos por infectado evitado ni se usó AWS.",
            (
                "- Siguen pendientes la semilla del jurado externo, los tiempos humanos, "
                "la aceptación manual/accesibilidad y el benchmark AWS."
            ),
            (
                "- Este informe no declara la aplicación lista para pitch; solo documenta el "
                "componente científico T-22."
            ),
            "",
        ]
    )
    return "\n".join(lines)


def analyze_and_write(
    plan: dict[str, Any],
    attempt: Path,
    env: dict[str, Any],
    report_path: Path,
    summary_path: Path,
) -> tuple[str, list[str], dict[str, Any]]:
    runs, failures = collect_runs(plan, attempt)
    primary = combined_primary(runs, plan)
    decision, reasons = decide(runs, failures, plan, primary)
    summary = {
        "protocolId": plan["protocolId"],
        "protocolSHA256": env["protocolSHA256"],
        "generatedAt": now(),
        "decision": decision,
        "reasons": reasons,
        "environment": env,
        "attempt": relative(attempt),
        "primary": primary,
        "runs": {
            run_id: {
                "kind": item["row"]["kind"],
                "configuration": item["row"]["configuration"],
                "rootSeed": item["row"]["rootSeed"],
                "n": item["summary"]["n"],
                "policyStats": item["summary"]["policyStats"],
                "dNone": item["summary"]["dNone"],
                "dRandom": item["summary"]["dRandom"],
                "backendRecommendation": item["summary"]["backendRecommendation"],
                "commonFailures": item["commonFailures"],
                "controlFailures": item["controlFailures"],
                "export": item["metadata"]["export"],
                "reproductions": item["metadata"]["reproductions"],
            }
            for run_id, item in runs.items()
        },
        "missing": failures,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        build_report(plan, runs, failures, primary, decision, reasons, env, attempt),
        encoding="utf-8",
    )
    write_json(summary_path, summary)
    return decision, reasons, summary


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--attempt", type=Path, default=ATTEMPT_DEFAULT)
    parser.add_argument("--report", type=Path, default=REPORT_DEFAULT)
    parser.add_argument("--summary", type=Path, default=SUMMARY_DEFAULT)
    parser.add_argument(
        "--group",
        choices=("all", "control", "primary", "contrast"),
        default="all",
    )
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--no-report", action="store_true")
    args = parser.parse_args()
    attempt = args.attempt.resolve()
    if attempt.exists() and not args.resume:
        print(
            "El intento ya existe; usar --resume o un directorio nuevo.",
            file=sys.stderr,
        )
        return 2
    attempt.mkdir(parents=True, exist_ok=True)
    plan = read_json(PROTOCOL_ROOT / "protocol.json")
    source_commit = git_value("rev-parse", "HEAD")
    env = environment(source_commit)
    write_json(attempt / "environment.json", env)
    python = python_executable()
    controls = [row for row in plan["runs"] if row["kind"] == "technical-control"]
    rest = [row for row in plan["runs"] if row["kind"] != "technical-control"]
    primary = [row for row in rest if row["kind"] == "primary"]
    contrasts = [row for row in rest if row["kind"] == "descriptive-contrast"]
    selected = {
        "control": controls,
        "primary": primary,
        "contrast": contrasts,
        "all": [],
    }[args.group]
    try:
        if args.group in ("all", "control"):
            execute_rows(controls, attempt, python, source_commit, args.resume)
            if not args.no_report:
                decision, reasons, _ = analyze_and_write(
                    plan, attempt, env, args.report, args.summary
                )
                print(f"Controles: {decision}", flush=True)
                for reason in reasons:
                    print(f"- {reason}", flush=True)
                if decision == "INCOMPLETO/INVÁLIDO" and any(
                    item.get("controlFailures")
                    for item in collect_runs(plan, attempt)[0].values()
                ):
                    return 1
        if args.group == "all":
            selected = rest
        if args.group in ("all", "primary", "contrast") and selected:
            execute_rows(selected, attempt, python, source_commit, args.resume)
        if not args.no_report:
            decision, reasons, _ = analyze_and_write(
                plan, attempt, env, args.report, args.summary
            )
            print(f"Decisión: {decision}", flush=True)
            for reason in reasons:
                print(f"- {reason}", flush=True)
            return 0 if decision != "INCOMPLETO/INVÁLIDO" else 1
    except ExecutionError as error:
        print(str(error), file=sys.stderr, flush=True)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
