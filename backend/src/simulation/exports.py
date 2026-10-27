"""Exportación y reproducción — T-10 / RF-13/19."""

import copy
import csv
import io
import platform
import uuid
import zipfile
from datetime import UTC, datetime
from importlib.metadata import version
from typing import Any, cast

from domain.configuration import decode_json_document, normalize_configuration, validate_contract
from domain.errors import ConfigurationError
from domain.reproducibility import (
    BIT_GENERATOR,
    CANONICAL_VERSION,
    RNG_VERSION,
    canonical_json,
    json_hash,
)
from simulation.experiments import POLICIES, run_experiment

ENGINE_VERSION = "0.1.0"
SCHEMA_VERSION = "1.0"
MAX_DOCUMENT_BYTES = 33554432
METRICS = (
    "cumulativeInfected",
    "peakInfectious",
    "peakDay",
    "finalInfectious",
    "outbreakDuration",
    "vaccinesAssigned",
    "vaccinesEffective",
    "vaccinesUnused",
)
SELECTIONS = (
    "day",
    "nodeId",
    "score",
    "rank",
    "stateAtDecision",
    "contexts",
    "tieBreak",
    "effective",
)
EVENTS = ("day", "nodeId", "from", "to", "cause", "sourceNodeId", "edgeId")


def runtime_versions() -> dict[str, Any]:
    return dict(
        engineVersion=ENGINE_VERSION,
        schemaVersion=SCHEMA_VERSION,
        pythonVersion=platform.python_version(),
        dependencies={name: version(name) for name in ("numpy", "networkx", "jsonschema")},
        generatorVersion="synthetic-manta-v1",
        rngVersion=RNG_VERSION,
        bitGenerator=BIT_GENERATOR,
        canonicalVersion=CANONICAL_VERSION,
    )


def experiment_hash(document: dict[str, Any]) -> str:
    """Proyección sin autorreferencia, eventos/frames ni datos volátiles."""
    versions = {name: document["manifest"][name] for name in runtime_versions()}
    replicates = []
    for rep in sorted(document["replicates"], key=lambda item: item["index"]):
        replicates.append(
            dict(
                index=rep["index"],
                initialInfectiousNodeIds=rep["initialInfectiousNodeIds"],
                randomnessHash=rep["randomnessHash"],
                policies={
                    policy: {
                        key: rep["policies"][policy][key]
                        for key in ("metrics", "daily", "selections")
                    }
                    for policy in POLICIES
                },
            )
        )
    return json_hash(
        dict(
            configuration=document["configuration"],
            graph=document["graph"],
            versions=versions,
            replicates=replicates,
        )
    )


def _validate(document: dict[str, Any]) -> None:
    validate_contract(document, "CompareResponse")
    for name in ("rootSeed", "networkMode"):
        if document["manifest"][name] != document["configuration"][name]:
            raise ValueError("Manifiesto y configuración inconsistentes.")
    if (
        document["engineVersion"] != document["manifest"]["engineVersion"]
        or document["schemaVersion"] != document["manifest"]["schemaVersion"]
    ):
        raise ValueError("Versiones inconsistentes.")
    graph_hash = json_hash(document["graph"])
    if graph_hash != document["graphHash"] or graph_hash != document["manifest"]["graphHash"]:
        raise ValueError("El hash del grafo no coincide.")
    if document["manifest"]["experimentHash"] != experiment_hash(document):
        raise ValueError("El hash del experimento no coincide.")
    for rep in document["replicates"]:
        if rep["initialStateHash"] != json_hash(
            dict(graphHash=graph_hash, initialInfectiousNodeIds=rep["initialInfectiousNodeIds"])
        ):
            raise ValueError("El hash inicial no coincide.")
        for policy in POLICIES:
            result = rep["policies"][policy]
            plan = document["configuration"]["intervention"].get("combined")
            if plan:
                previous = 0
                schedule = plan.get("resourceSchedule")
                vaccines_used = 0
                brigades_used = 0
                seen_nodes: set[int] = set()
                for row in result["daily"]:
                    count = sum(
                        selection["day"] == row["day"] for selection in result["selections"]
                    )
                    brigade_ids = row.get("brigadeNodeIds", [])
                    cost = (
                        count * plan["vaccineCostCents"]
                        + len(brigade_ids) * plan["brigadeCostCents"]
                        + (plan["closureCostCents"] if row.get("closedContext") else 0)
                    )
                    spent = row.get("spentCents")
                    if (
                        type(spent) is not int
                        or row.get("spentTodayCents") != cost
                        or spent != previous + cost
                        or row.get("budgetRemainingCents") != plan["budgetCents"] - spent
                        or spent > plan["budgetCents"]
                        or row.get("brigadesActive") != len(brigade_ids)
                        or (policy == "none" and spent != 0)
                    ):
                        raise ValueError("El registro de presupuesto no cuadra con las acciones.")
                    previous = spent
                    if schedule:
                        delivered = [r for r in schedule["deliveries"] if r["day"] == row["day"]]
                        received = [r for r in schedule["deliveries"] if r["day"] <= row["day"]]
                        vaccines_used += count
                        brigades_used += len(brigade_ids)
                        expected = dict(
                            vaccinesDeliveredToday=sum(r["vaccines"] for r in delivered),
                            vaccinesReceivedTotal=document["configuration"]["intervention"][
                                "vaccines"
                            ]
                            + sum(r["vaccines"] for r in received),
                            vaccinesUsedToday=count,
                            brigadeSuppliesDeliveredToday=sum(
                                r["brigadeSupplies"] for r in delivered
                            ),
                            brigadeSuppliesReceivedTotal=schedule["initialBrigadeSupplies"]
                            + sum(r["brigadeSupplies"] for r in received),
                            brigadeSuppliesUsedToday=len(brigade_ids),
                        )
                        expected.update(
                            vaccinesAvailable=expected["vaccinesReceivedTotal"] - vaccines_used,
                            brigadeSuppliesAvailable=expected["brigadeSuppliesReceivedTotal"]
                            - brigades_used,
                        )
                        today_nodes = {
                            s["nodeId"] for s in result["selections"] if s["day"] == row["day"]
                        }
                        if (
                            any(row.get(k) != v or v < 0 for k, v in expected.items())
                            or count > schedule["vaccineDailyCapacity"]
                            or len(today_nodes) != count
                            or seen_nodes & today_nodes
                            or (
                                count
                                and row["day"]
                                < document["configuration"]["intervention"]["interventionDay"]
                            )
                        ):
                            raise ValueError(
                                "El registro de inventario no cuadra con las entregas y consumos."
                            )
                        seen_nodes.update(today_nodes)
                if schedule:
                    total = document["configuration"]["intervention"]["vaccines"] + sum(
                        r["vaccines"] for r in schedule["deliveries"]
                    )
                    if (
                        result["metrics"]["vaccinesAssigned"] != vaccines_used
                        or result["metrics"]["vaccinesUnused"] != total - vaccines_used
                    ):
                        raise ValueError("Las métricas de dosis no cuadran con el inventario.")
            if result["resultHash"] != json_hash(
                {key: result[key] for key in ("metrics", "daily", "selections")}
            ):
                raise ValueError("El hash de política no coincide.")


def export_experiment(
    result: dict[str, Any], *, build_commit: str = "unknown", request_id: str | None = None
) -> dict[str, Any]:
    document = copy.deepcopy(result)
    manifest = dict(
        **runtime_versions(),
        buildCommit=build_commit,
        networkMode=document["configuration"]["networkMode"],
        rootSeed=document["configuration"]["rootSeed"],
        graphHash=document["graphHash"],
    )
    document.update(
        schemaVersion=SCHEMA_VERSION,
        engineVersion=ENGINE_VERSION,
        requestId=str(uuid.uuid4()) if request_id is None else request_id,
        generatedAt=datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        manifest=manifest,
    )
    manifest["experimentHash"] = experiment_hash(document)
    _validate(document)
    if len(canonical_json(document)) > MAX_DOCUMENT_BYTES:
        raise ConfigurationError("RESULT_TOO_LARGE", 413, "El resultado supera 32 MiB.")
    return document


def load_export(body: bytes) -> dict[str, Any]:
    document = decode_json_document(body, max_bytes=MAX_DOCUMENT_BYTES)
    validate_contract(document, "CompareResponse")
    result = cast(dict[str, Any], document)
    _validate(result)
    return result


def reproduce(document: dict[str, Any]) -> str:
    """Regenera y compara contenido, incluyendo derivados fuera del hash."""
    _validate(document)
    for key, value in runtime_versions().items():
        if document["manifest"][key] != value:
            raise ValueError("El entorno o la versión no coincide con el experimento.")
    configuration = normalize_configuration(document["configuration"])
    fresh = export_experiment(
        run_experiment(
            configuration,
            include_representative_frames=document["representative"]["frames"] is not None,
        )
    )
    if fresh["manifest"]["experimentHash"] != document["manifest"]["experimentHash"]:
        raise ValueError("La reproducción produjo un hash diferente.")
    # Todos los derivados y los eventos/frames presentes también deben coincidir.
    for key in (
        "configuration",
        "graph",
        "graphHash",
        "replicates",
        "summaryByPolicy",
        "pairedComparisons",
        "aggregatedCurves",
        "representative",
        "recommendation",
        "progress",
    ):
        if canonical_json(fresh[key]) != canonical_json(document[key]):
            raise ValueError("Los datos reproducidos no coinciden con el documento.")
    return cast(str, fresh["manifest"]["experimentHash"])


def export_zip(document: dict[str, Any]) -> bytes:
    """Referencia local para ZIP cliente T-15; no crea endpoints ni recalcula métricas."""
    _validate(document)
    selected = document["representative"]["index"]
    if any(
        rep["policies"][policy]["events"] is not None
        for rep in document["replicates"]
        if rep["index"] != selected
        for policy in POLICIES
    ):
        raise ValueError("El ZIP solo exporta eventos de la representativa.")
    files: dict[str, bytes] = {
        "configuration.json": canonical_json(document["configuration"]),
        "manifest.json": canonical_json(
            {**document["manifest"], "exportMetadata": {"exportedEventsScope": "representative"}}
        ),
        "comparison-summary.json": canonical_json(document["pairedComparisons"]),
    }

    def table(name: str, fields: tuple[str, ...], rows: list[dict[str, Any]]) -> None:
        stream = io.StringIO(newline="")
        writer = csv.writer(stream, lineterminator="\r\n")
        writer.writerow(fields)
        for row in rows:
            writer.writerow(
                [
                    ""
                    if row.get(key) is None
                    else canonical_json(row[key]).decode("utf-8")
                    if isinstance(row[key], (list, dict, bool))
                    else row[key]
                    for key in fields
                ]
            )
        files[name + ".csv"] = stream.getvalue().encode("utf-8")

    table(
        "nodes",
        ("id", "role", "householdId", "neighborhoodId", "schoolId", "busId", "marketId"),
        document["graph"]["nodes"],
    )
    table("edges", ("id", "u", "v", "context", "weight", "activeDays"), document["graph"]["edges"])
    rows_by_name: dict[str, list[dict[str, Any]]] = {
        name: [] for name in ("daily", "metrics", "selections", "events")
    }
    for rep in document["replicates"]:
        for policy in POLICIES:
            result = rep["policies"][policy]
            prefix = dict(replicateIndex=rep["index"], policy=policy)
            for name in rows_by_name:
                rows = [result[name]] if name == "metrics" else result[name] or []
                rows_by_name[name].extend({**prefix, **row} for row in rows)
    for name, fields in (
        ("daily", ("day", "s", "e", "i", "r", "cumulativeInfected")),
        ("metrics", METRICS),
        ("selections", SELECTIONS),
        ("events", EVENTS),
    ):
        table(name, ("replicateIndex", "policy", *fields), rows_by_name[name])
    if document["configuration"]["intervention"].get("combined"):
        if document["configuration"]["intervention"]["combined"].get("resourceSchedule"):
            table(
                "inventory",
                (
                    "replicateIndex",
                    "policy",
                    "day",
                    "vaccinesDeliveredToday",
                    "vaccinesReceivedTotal",
                    "vaccinesUsedToday",
                    "vaccinesAvailable",
                    "brigadeSuppliesDeliveredToday",
                    "brigadeSuppliesReceivedTotal",
                    "brigadeSuppliesUsedToday",
                    "brigadeSuppliesAvailable",
                ),
                rows_by_name["daily"],
            )
        table(
            "budget",
            (
                "replicateIndex",
                "policy",
                "day",
                "spentTodayCents",
                "spentCents",
                "budgetRemainingCents",
                "closedContext",
                "brigadesActive",
                "brigadeNodeIds",
            ),
            rows_by_name["daily"],
        )
        if document["configuration"]["intervention"]["combined"].get("adaptiveStrategy"):
            # Extraer decisiones adaptativas si están presentes
            adaptive_rows = []
            for rep in document["replicates"]:
                for policy in ["none", "random", "targeted"]:
                    for day_data in rep["policies"][policy]["daily"]:
                        if "adaptiveDecisions" in day_data:
                            dec = day_data["adaptiveDecisions"]
                            adaptive_rows.append({
                                "replicateIndex": rep["index"],
                                "policy": policy,
                                "day": day_data["day"],
                                "enabled": dec["enabled"],
                                "infectiousFraction": dec["infectiousFraction"],
                                "closureActive": dec.get("closureActive"),
                                "brigadesAllowed": dec.get("brigadesAllowed"),
                                "ringVaccinationActive": dec.get("ringVaccinationActive"),
                                "triggers": json.dumps(dec.get("triggers", [])),
                            })
            if adaptive_rows:
                table(
                    "adaptive-decisions",
                    (
                        "replicateIndex",
                        "policy",
                        "day",
                        "enabled",
                        "infectiousFraction",
                        "closureActive",
                        "brigadesAllowed",
                        "ringVaccinationActive",
                        "triggers",
                    ),
                    adaptive_rows,
                )
    table(
        "summary",
        ("policy", "metric", "n", "mean", "median", "p05", "p95"),
        [
            dict(policy=policy, metric=metric, **document["summaryByPolicy"][policy][metric])
            for policy in POLICIES
            for metric in METRICS
        ],
    )
    paired = document["pairedComparisons"]
    comparisons = {
        "savedVsNone.random": paired["savedVsNone"]["random"],
        "savedVsNone.targeted": paired["savedVsNone"]["targeted"],
        "gainVsRandom": paired["gainVsRandom"],
    }
    table(
        "comparisons",
        ("comparison", "replicateIndex", "value"),
        [
            dict(comparison=name, replicateIndex=index, value=value)
            for name, comp in comparisons.items()
            for index, value in enumerate(comp["values"])
        ],
    )
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, body in files.items():
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, body)
    return output.getvalue()
