"""T-07 / CA-01/04: snapshot, SEIR, conservación y eventos."""

import copy
import hashlib
import json
import os
import struct
import subprocess
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np
import pytest
from jsonschema import Draft202012Validator

from domain.configuration import normalize_configuration
from domain.reproducibility import canonical_json, create_rng
from simulation.engine import Potentials, generate_potentials, simulate_none, step_day
from simulation.network import generate_graph


def edge(index, u, v, weight=1, active=(0,)):
    return dict(id=index, u=u, v=v, weight=weight, activeDays=list(active), context="household")


def advance(states, edges, *, beta=1, sigma=1, gamma=1, draws=None, day=0):
    if draws is None:
        draws = np.zeros(len(edges))
    return step_day(
        states,
        edges,
        day=day,
        beta=beta,
        sigma=sigma,
        gamma=gamma,
        transmission=draws,
        progression=np.zeros((len(states), 2)),
    )


def test_snapshot_prevents_secondary_transmission_and_double_progression():
    before = ["I", "S", "S", "E", "R"]
    edges = [edge(0, 0, 1), edge(1, 1, 2)]
    states, events = advance(before, edges)
    assert before == ["I", "S", "S", "E", "R"]
    assert states == ["R", "E", "S", "I", "R"]
    assert [(e["nodeId"], e["from"], e["to"]) for e in events] == [
        (0, "I", "R"),
        (1, "S", "E"),
        (3, "E", "I"),
    ]
    assert all(e["day"] == 1 for e in events)


@pytest.mark.parametrize(
    "beta,edges",
    [
        (0, [edge(0, 0, 1)]),
        (1, []),
        (1, [edge(0, 0, 1, weight=0)]),
        (1, [edge(0, 0, 1, active=(1,))]),
    ],
)
def test_no_contact_exposure(beta, edges):
    states, events = advance(["I", "S"], edges, beta=beta, gamma=0)
    assert states == ["I", "S"] and events == []


def test_parallel_edges_use_individual_thresholds_and_minimum_success_id():
    edges = [edge(1, 0, 2, weight=0.5), edge(0, 1, 2, weight=0.2)]
    states, events = advance(["I", "I", "S"], edges, gamma=0, draws=np.array([0.1, 0.4]))
    assert states == ["I", "I", "E"]
    assert events[0]["edgeId"] == 0 and events[0]["sourceNodeId"] == 1
    _, events = advance(["I", "I", "S"], edges, gamma=0, draws=np.array([0.2, 0.4]))
    assert events[0]["edgeId"] == 1  # U == p is failure, no aggregate third draw.


def test_transmission_works_in_both_directions_and_clamps_risk():
    states, events = advance(["S", "I"], [edge(0, 0, 1, weight=2)], gamma=0, draws=np.array([0.99]))
    assert states == ["E", "I"] and events[0]["sourceNodeId"] == 1


@pytest.mark.parametrize(
    "sigma,gamma,expected",
    [
        (0, 0, ["E", "I", "R"]),
        (1, 0, ["I", "I", "R"]),
        (0, 1, ["E", "R", "R"]),
        (1, 1, ["I", "R", "R"]),
    ],
)
def test_progression_extremes(sigma, gamma, expected):
    states, _ = advance(["E", "I", "R"], [], sigma=sigma, gamma=gamma)
    assert states == expected


def test_progression_channels_and_strict_threshold():
    states, events = step_day(
        ["E", "I"],
        [],
        day=2,
        beta=0,
        sigma=0.3,
        gamma=0.7,
        transmission=np.array([]),
        progression=np.array([[0.3, 0.0], [0.0, 0.69]]),
    )
    assert states == ["E", "R"]
    assert len(events) == 1
    assert events[0]["sourceNodeId"] is None and events[0]["edgeId"] is None


@pytest.fixture
def config():
    return normalize_configuration(
        {"scenario": {"populationSize": 50, "days": 4}, "intervention": {"vaccines": 0}}
    )


def test_potentials_match_domain_rng_shapes_and_are_read_only(config):
    p = generate_potentials(config, 3, replicate_index=2)
    assert p.transmission.shape == (4, 3)
    assert p.progression.shape == (4, 50, 2)
    assert p.vaccine.shape == (5, 50)
    for domain in ("transmission", "progression", "vaccine"):
        matrix = getattr(p, domain)
        assert matrix.flags.c_contiguous and not matrix.flags.writeable
        assert np.array_equal(matrix, create_rng(config.root_seed, domain, 2).random(matrix.shape))
    assert p.randomness_hash == generate_potentials(config, 3, replicate_index=2).randomness_hash
    assert p.randomness_hash != generate_potentials(config, 3, replicate_index=1).randomness_hash


def test_complete_run_conserves_population_and_records_entry_days(config):
    graph = generate_graph(config)
    snapshot = copy.deepcopy(graph)
    p = generate_potentials(config, len(graph["edges"]))
    result = simulate_none(config, graph, potentials=p)
    assert result == simulate_none(config, graph, potentials=p)
    assert graph == snapshot
    assert len(result.frames) == len(result.daily) == 5
    assert result.daily[0] == dict(day=0, s=49, e=0, i=1, r=0, cumulativeInfected=1)
    for day, row in enumerate(result.daily):
        assert sum(row[k] for k in ("s", "e", "i", "r")) == 50
        assert all(row[k] >= 0 for k in ("s", "e", "i", "r"))
        assert row["day"] == day
        assert sum(state == "I" for state in result.frames[day]) == row["i"]
    for event in result.events:
        assert result.entry_days[event["nodeId"]][event["to"]] == event["day"]
        if event["from"] == "R":
            pytest.fail("R is absorbing")
    assert result.events == sorted(result.events, key=lambda e: (e["day"], e["nodeId"], e["cause"]))
    defs = json.loads(
        (Path(__file__).resolve().parents[2] / "schemas/common.schema.json").read_text()
    )["$defs"]
    for name, rows in [("Daily", result.daily), ("Event", result.events)]:
        validator = Draft202012Validator({"$defs": defs, "$ref": "#/$defs/" + name})
        for row in rows:
            validator.validate(row)


def test_no_transmission_after_T_and_gamma_one_final_boundary(config):
    config = replace(config, scenario=replace(config.scenario, days=1, beta=1, gamma=0))
    graph = generate_graph(config)
    graph["edges"] = [edge(0, u, v, active=(1,)) for u in range(50) for v in range(u + 1, 50)]
    for i, e in enumerate(graph["edges"]):
        e["id"] = i
    result = simulate_none(config, graph)
    assert [row["cumulativeInfected"] for row in result.daily] == [1, 1]
    assert all(e["day"] <= 1 for e in result.events)


def test_beta_zero_no_contact_events_and_no_new_infections(config):
    config = replace(config, scenario=replace(config.scenario, beta=0, gamma=1))
    result = simulate_none(config, generate_graph(config))
    assert [row["cumulativeInfected"] for row in result.daily] == [1] * 5
    assert [row["i"] for row in result.daily] == [1, 0, 0, 0, 0]
    assert all(e["cause"] != "contact" for e in result.events)


def test_simulation_three_processes(tmp_path):
    source = Path(__file__).resolve().parents[1] / "src"
    script = "from domain.configuration import normalize_configuration; from domain.reproducibility import json_hash; from simulation.network import generate_graph; from simulation.engine import simulate_none; from dataclasses import asdict; c=normalize_configuration({'scenario':{'populationSize':50,'days':4},'intervention':{'vaccines':0}}); print(json_hash(asdict(simulate_none(c,generate_graph(c)))))"
    outputs = [
        subprocess.check_output(
            [sys.executable, "-c", script],
            cwd=tmp_path,
            env=dict(os.environ, PYTHONPATH=str(source), PYTHONHASHSEED=seed),
            text=True,
        )
        for seed in ("1", "42", "random")
    ]
    assert len(set(outputs)) == 1


def test_independent_edges_have_exact_combined_probability():
    edges = [edge(0, 0, 2, weight=0.2), edge(1, 1, 2, weight=0.5)]
    successes = 0
    for u in range(10):
        for v in range(10):
            states, _ = advance(["I", "I", "S"], edges, gamma=0, draws=np.array([u / 10, v / 10]))
            successes += states[2] == "E"
    assert successes == 60  # 1 - (1 - .2) * (1 - .5)


def test_hash_binary_framing_and_byte_order(config):
    p = generate_potentials(config, 2)
    digest = hashlib.sha256()
    for name in ("transmission", "progression", "vaccine"):
        matrix = getattr(p, name)
        header = canonical_json({"name": name, "shape": list(matrix.shape)})
        digest.update(struct.pack("<Q", len(header)))
        digest.update(header)
        digest.update(matrix.astype("<f8").tobytes())
    assert p.randomness_hash == "sha256:" + digest.hexdigest()
    swapped = Potentials(
        *(getattr(p, name).astype(">f8") for name in ("transmission", "progression", "vaccine"))
    )
    assert swapped.randomness_hash == p.randomness_hash
    changed = p.vaccine.copy()
    changed[0, 0] = 0
    assert Potentials(p.transmission, p.progression, changed).randomness_hash != p.randomness_hash


@pytest.mark.parametrize("value", [float("nan"), float("inf"), -0.1, 1.0])
def test_invalid_potentials_rejected(config, value):
    graph = generate_graph(config)
    p = generate_potentials(config, len(graph["edges"]))
    changed = p.transmission.copy()
    changed[0, 0] = value
    with pytest.raises(ValueError, match="Potenciales"):
        simulate_none(config, graph, potentials=Potentials(changed, p.progression, p.vaccine))


def test_wrong_shapes_and_unknown_states_are_rejected(config):
    graph = generate_graph(config)
    with pytest.raises(ValueError, match="Potenciales"):
        simulate_none(config, graph, potentials=generate_potentials(config, 0))
    with pytest.raises(ValueError, match="Estado"):
        advance(["unknown"], [])


def test_day_zero_and_final_exposure_are_recorded(config):
    config = replace(config, scenario=replace(config.scenario, days=1, beta=1, gamma=0))
    graph = generate_graph(config)
    graph["edges"] = [
        edge(index, u, v)
        for index, (u, v) in enumerate((u, v) for u in range(50) for v in range(u + 1, 50))
    ]
    result = simulate_none(config, graph)
    assert result.daily[0]["cumulativeInfected"] == 1
    assert result.daily[1] == dict(day=1, s=0, e=49, i=1, r=0, cumulativeInfected=50)
    assert len(result.frames) == 2
    assert sum(e["cause"] == "initial" for e in result.events) == 1
    assert sum(e["cause"] == "contact" for e in result.events) == 49
