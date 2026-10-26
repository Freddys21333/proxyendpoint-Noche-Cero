"""T-06 / RF-03: red, calendario y origen reproducibles."""

import copy
import json
import os
import subprocess
import sys
from collections import Counter
from dataclasses import replace
from itertools import combinations
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from domain.configuration import normalize_configuration
from domain.errors import ConfigurationError
from domain.models import Origin
from domain.reproducibility import json_hash
from simulation.network import build_preview, generate_graph, select_initial


@pytest.fixture
def config():
    return normalize_configuration({"scenario": {"populationSize": 100, "days": 7}})


def test_graph_contract_groups_and_edges(config):
    graph = generate_graph(config)
    definitions = json.loads(
        (Path(__file__).resolve().parents[2] / "schemas/common.schema.json").read_text()
    )["$defs"]
    Draft202012Validator({"$defs": definitions, "$ref": "#/$defs/Graph"}).validate(graph)
    nodes = graph["nodes"]
    assert [n["id"] for n in nodes] == list(range(100))
    assert Counter(n["role"] for n in nodes) == {"student": 25, "worker": 55, "community": 20}
    assert sum(n["schoolId"] is not None for n in nodes) == 25
    assert sum(n["busId"] is not None for n in nodes) == 40
    assert set(Counter(n["neighborhoodId"] for n in nodes).values()) == {20}
    edges = graph["edges"]
    keys = [(e["u"], e["v"], e["context"]) for e in edges]
    assert keys == sorted(set(keys))
    assert [e["id"] for e in edges] == list(range(len(edges)))
    for edge in edges:
        u, v = edge["u"], edge["v"]
        assert 0 <= u < v < 100
        assert edge["activeDays"] == sorted(set(edge["activeDays"]))
        context = edge["context"]
        assert edge["weight"] == getattr(config.network.weights, context)
        if context != "market":
            assert nodes[u][context + "Id"] == nodes[v][context + "Id"]
        if context in {"household", "neighborhood"}:
            assert edge["activeDays"] == list(range(8))
        else:
            assert 6 not in edge["activeDays"]
            if context == "school":
                assert edge["activeDays"] == [0, 1, 2, 3, 4, 7]
        if context == "market":
            assert nodes[u]["marketId"] == nodes[v]["marketId"] == "market-0"
    households = {n["householdId"] for n in nodes}
    for group in households:
        members = [n["id"] for n in nodes if n["householdId"] == group]
        assert 1 <= len(members) <= 6
        assert all((u, v, "household") in keys for u, v in combinations(members, 2))


def test_preview_reproducible_hashes_and_layout(config):
    preview = build_preview(config)
    assert build_preview(config) == preview
    assert preview["graphHash"] == json_hash(preview["graph"])
    assert preview["positions"][0] == {"nodeId": 0, "x": 1.0, "y": 0.0}
    changed = replace(config, intervention=replace(config.intervention, vaccine_efficacy=0.5))
    assert build_preview(changed)["graphHash"] == preview["graphHash"]
    for changed in [
        replace(config, root_seed=1),
        replace(config, scenario=replace(config.scenario, days=8)),
        replace(
            config,
            network=replace(config.network, weights=replace(config.network.weights, bus=0.2)),
        ),
    ]:
        assert build_preview(changed)["graphHash"] != preview["graphHash"]
    preview["positions"][0]["x"] = 0
    assert json_hash(preview["graph"]) == preview["graphHash"]


@pytest.mark.parametrize(
    "kind", ["random", "household", "school", "bus", "market", "neighborhood", "node"]
)
def test_origin_and_multiple_initials(config, kind):
    config = replace(
        config,
        scenario=replace(
            config.scenario,
            initial_infectious=5,
            origin=Origin(kind, 9 if kind == "node" else None),
        ),
    )
    graph = generate_graph(config)
    snapshot = copy.deepcopy(graph)
    selected = select_initial(config, graph, 2)
    assert selected == select_initial(config, graph, 2)
    assert selected == sorted(set(selected)) and len(selected) == 5
    if kind == "node":
        assert 9 in selected
    elif kind != "random":
        assert any(graph["nodes"][i][kind + "Id"] is not None for i in selected)
    assert graph == snapshot
    single = replace(config, scenario=replace(config.scenario, initial_infectious=1))
    first = select_initial(single, graph, 2)[0]
    assert first in selected
    if kind == "node":
        assert first == 9
    elif kind != "random":
        assert graph["nodes"][first][kind + "Id"] is not None


def test_empty_context_and_invalid_node(config):
    graph = generate_graph(config)
    for node in graph["nodes"]:
        node["schoolId"] = None
    school = replace(config, scenario=replace(config.scenario, origin=Origin("school", None)))
    with pytest.raises(ConfigurationError) as caught:
        select_initial(school, graph)
    assert caught.value.code == "ORIGIN_EMPTY" and caught.value.status_code == 422
    invalid = replace(config, scenario=replace(config.scenario, origin=Origin("node", 100)))
    with pytest.raises(ConfigurationError):
        select_initial(invalid, graph)


def test_graph_limit_rejects_without_truncation(config):
    with pytest.raises(ConfigurationError) as caught:
        generate_graph(config, max_edges=1)
    assert caught.value.code == "GRAPH_TOO_LARGE" and caught.value.status_code == 413


@pytest.mark.parametrize("population", [50, 51, 103, 104, 108, 200])
def test_non_divisible_populations_and_partial_groups(population):
    config = normalize_configuration(
        {"scenario": {"populationSize": population, "days": 1}, "intervention": {"vaccines": 0}}
    )
    graph = generate_graph(config)
    counts = Counter(n["role"] for n in graph["nodes"])
    assert counts["student"] == population // 4
    assert counts["worker"] == population * 55 // 100
    school_sizes = Counter(n["schoolId"] for n in graph["nodes"] if n["schoolId"] is not None)
    assert all(1 <= size <= 25 for size in school_sizes.values())
    bus_sizes = Counter(n["busId"] for n in graph["nodes"] if n["busId"] is not None)
    assert sum(bus_sizes.values()) == population * 40 // 100
    assert all(1 <= size <= 40 for size in bus_sizes.values())


def test_replica_order_and_layout_do_not_change_graph(config):
    graph = generate_graph(config)
    before = json_hash(graph)
    expected = {i: select_initial(config, graph, i) for i in range(4)}
    assert {i: select_initial(config, graph, i) for i in reversed(range(4))} == expected
    assert json_hash(graph) == before
    changed = replace(
        config, repetitions=2, scenario=replace(config.scenario, beta=0, origin=Origin("node", 0))
    )
    assert generate_graph(changed) == graph


def test_preview_matches_response_schema(config):
    definitions = json.loads(
        (Path(__file__).resolve().parents[2] / "schemas/common.schema.json").read_text()
    )["$defs"]
    response = dict(
        build_preview(config), schemaVersion="1.0", engineVersion="test", requestId="test"
    )
    Draft202012Validator({"$defs": definitions, "$ref": "#/$defs/PreviewResponse"}).validate(
        response
    )


def test_synthetic_manta_v1_fixture(config):
    preview = build_preview(config)
    assert len(preview["graph"]["edges"]) == 1169
    assert (
        preview["graphHash"]
        == "sha256:4a99b4e7aec1256b5b3d599f17aee19036b50d1fae6bd774ac907184672d293a"
    )
    assert (
        preview["initialStateHash"]
        == "sha256:7358bdda5c15a9964138ff594dfbf27f226d9ca798bd5eec1a9496752ac5ce9c"
    )


def test_graph_three_processes(tmp_path):
    source = Path(__file__).resolve().parents[1] / "src"
    script = "from domain.configuration import normalize_configuration; from simulation.network import build_preview; p=build_preview(normalize_configuration({'scenario':{'populationSize':50,'days':7},'intervention':{'vaccines':10}})); print(p['graphHash'], p['initialStateHash'])"
    outputs = [
        subprocess.check_output(
            [sys.executable, "-c", script],
            cwd=tmp_path,
            env=dict(os.environ, PYTHONPATH=str(source), PYTHONHASHSEED=seed),
            text=True,
        )
        for seed in ["1", "42", "random"]
    ]
    assert len(set(outputs)) == 1
