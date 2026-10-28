"""P-07: comprobar presentación temporal sin RNG ni nueva simulación."""

from collections import Counter
from typing import Any

from simulation.experiments import POLICIES, select_representative


def _require(condition: bool) -> None:
    if not condition:
        raise ValueError("La reproducción temporal no coincide con el experimento.")


def validate_playback(document: dict[str, Any]) -> None:
    """Se invoca después de validar esquema y hashes; no modifica el documento."""
    cfg = document["configuration"]
    n, last = cfg["scenario"]["populationSize"], cfg["scenario"]["days"]
    reps = document["replicates"]
    _require([rep["index"] for rep in reps] == list(range(cfg["repetitions"])))
    _require([node["id"] for node in document["graph"]["nodes"]] == list(range(n)))
    _require(
        document["progress"]
        == dict(replicatesTotal=len(reps), replicatesSucceeded=len(reps), replicatesFailed=0)
    )
    selected = select_representative(
        [rep["policies"]["targeted"]["metrics"]["cumulativeInfected"] for rep in reps]
    )
    representative = document["representative"]
    _require(representative["index"] == selected)
    _require(
        representative["initialSeed"]
        == dict(rootSeed=cfg["rootSeed"], replicateIndex=selected, domain="initial")
    )
    frames = representative["frames"]
    for rep in reps:
        initial = rep["initialInfectiousNodeIds"]
        _require(len(initial) == len(set(initial)) == cfg["scenario"]["initialInfectious"])
        _require(all(0 <= node < n for node in initial))
        for policy in POLICIES:
            result = rep["policies"][policy]
            daily = result["daily"]
            _require([row["day"] for row in daily] == list(range(last + 1)))
            _require(all(sum(row[k] for k in ("s", "e", "i", "r")) == n for row in daily))
            series = frames[policy] if frames is not None and rep["index"] == selected else None
            if series is not None:
                _require(len(series) == last + 1)
                _require(all(len(frame) == n for frame in series))
            if result["events"] is not None or series is not None:
                _validate_policy(document, result, initial, series)


def _validate_policy(
    document: dict[str, Any],
    result: dict[str, Any],
    initial: list[int],
    frames: list[list[str]] | None,
) -> None:
    n = document["configuration"]["scenario"]["populationSize"]
    daily = result["daily"]
    states = ["S"] * n
    for node in initial:
        states[node] = "I"
    cumulative = len(initial)
    events = result["events"]
    by_day: dict[int, list[dict[str, Any]]] = {}
    if events is not None:
        _require(events == sorted(events, key=lambda e: (e["day"], e["nodeId"], e["cause"])))
        seen: set[tuple[int, int]] = set()
        for event in events:
            day, node = event["day"], event["nodeId"]
            _require(0 <= day < len(daily) and 0 <= node < n and (day, node) not in seen)
            seen.add((day, node))
            by_day.setdefault(day, []).append(event)
        _require(sorted(e["nodeId"] for e in events if e["cause"] == "initial") == sorted(initial))
    selections: dict[int, dict[int, dict[str, Any]]] = {}
    for selection in result["selections"]:
        day, node = selection["day"], selection["nodeId"]
        _require(0 <= day < len(daily) and 0 <= node < n)
        selected = selections.setdefault(day, {})
        _require(node not in selected)
        selected[node] = selection
    edges = {edge["id"]: edge for edge in document["graph"]["edges"]}
    for day, row in enumerate(daily):
        before = states.copy()
        today = by_day.get(day, [])
        effective = {node for node, s in selections.get(day, {}).items() if s["effective"]}
        if events is not None:
            vaccinated: set[int] = set()
            before_vaccination = before.copy()
            for event in today:
                node = event["nodeId"]
                cause = event["cause"]
                _require(before[node] == event["from"])
                if cause == "contact":
                    source = event["sourceNodeId"]
                    edge = edges.get(event["edgeId"])
                    _require(day > 0 and 0 <= source < n and before[source] == "I")
                    _require(edge is not None)
                    assert edge is not None
                    _require({edge["u"], edge["v"]} == {node, source})
                    _require(day - 1 in edge["activeDays"] and edge["weight"] > 0)
                    _require(edge["context"] != daily[day - 1].get("closedContext"))
                    cumulative += 1
                elif cause == "progression":
                    _require(day > 0)
                elif cause == "initial":
                    _require(day == 0 and node in initial)
                elif cause == "vaccine":
                    vaccinated.add(node)
                states[node] = event["to"]
                if cause != "vaccine":
                    before_vaccination[node] = event["to"]
            _require(vaccinated == effective)
            for node in selections.get(day, {}):
                _require(before_vaccination[node] == "S")
            if frames is not None:
                _require(states == frames[day])
        else:
            # Sin eventos no se afirma causalidad: solo transiciones y conteos observables.
            assert frames is not None
            states = frames[day]
            vaccinated = set()
            for node, (old, new) in enumerate(zip(before, states, strict=True)):
                if old == new:
                    continue
                _require((old, new) in {("S", "E"), ("E", "I"), ("I", "R"), ("S", "R")})
                if day == 0:
                    _require((old, new) == ("S", "R"))
                if (old, new) == ("S", "R"):
                    vaccinated.add(node)
                elif (old, new) == ("S", "E"):
                    cumulative += 1
            _require(vaccinated == effective)
            for node, selection in selections.get(day, {}).items():
                _require(before[node] == "S")
                _require(states[node] == ("R" if selection["effective"] else "S"))
        counts = Counter(states)
        _require(all(row[state.lower()] == counts[state] for state in ("S", "E", "I", "R")))
        _require(row["cumulativeInfected"] == cumulative)
