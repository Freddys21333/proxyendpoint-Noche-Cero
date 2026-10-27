"""Verifica la matriz T-22 congelada sin generar grafos ni ejecutar simulaciones."""

import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend/src"))

from domain.configuration import normalize_configuration


def check_protocol(root: Path) -> dict[str, object]:
    root = root.resolve()
    hashes = {}
    for line in (root / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
        digest, name = line.split("  ", 1)
        target = (root / name).resolve()
        if not target.is_relative_to(root) or name in hashes:
            raise ValueError("Ruta de protocolo inválida o duplicada.")
        if hashlib.sha256(target.read_bytes()).hexdigest() != digest:
            raise ValueError(f"Archivo modificado: {name}")
        hashes[name] = digest
    plan = json.loads((root / "protocol.json").read_text(encoding="utf-8"))
    if plan["protocolId"] != "t22-v1" or len(plan["runs"]) != 15:
        raise ValueError("Versión o cantidad de experimentos inesperada.")
    expected_seeds = [
        int.from_bytes(
            hashlib.sha256(f"zombie-management:T22:v1:validation-root:{i}".encode()).digest()[:4],
            "little",
        )
        for i in range(5)
    ]
    if plan["seedDerivation"]["rootSeeds"] != expected_seeds:
        raise ValueError("La derivación de semillas no coincide.")
    inputs = {f"inputs/{path.name}" for path in (root / "inputs").glob("*.json")}
    run_inputs = {row["configuration"] for row in plan["runs"]}
    if set(hashes) != {"protocol.json", *run_inputs} or inputs != run_inputs:
        raise ValueError("Faltan archivos o hay configuraciones fuera de la matriz.")
    ids = set()
    total = 0
    primary = []
    for row in plan["runs"]:
        if row["id"] in ids or row["includeRepresentativeFrames"] is not False:
            raise ValueError("Experimento duplicado o frames no previstos.")
        ids.add(row["id"])
        configuration = json.loads((root / row["configuration"]).read_text(encoding="utf-8"))
        if normalize_configuration(configuration).to_dict() != configuration:
            raise ValueError("La configuración no está normalizada.")
        if (
            configuration["rootSeed"] != row["rootSeed"]
            or configuration["repetitions"] != 30
            or row["repetitions"] != 30
        ):
            raise ValueError("Semilla o repeticiones inconsistentes.")
        total += 30
        if row["kind"] == "primary":
            primary.append(row["rootSeed"])
    if primary != expected_seeds or total != 450 or plan["primaryPairedReplicates"] != 150:
        raise ValueError("La composición primaria o el total no coincide.")
    return {
        "protocolId": plan["protocolId"],
        "experiments": len(ids),
        "pairedReplicates": total,
        "primaryReplicates": 150,
        "protocolSHA256": hashes["protocol.json"],
        "simulationsExecuted": 0,
    }


def main() -> int:
    try:
        result = check_protocol(Path(__file__).resolve().parents[1] / "specs/validation/t22-v1")
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"Protocolo inválido: {error}", file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
