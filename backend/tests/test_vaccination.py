"""T-08: elegibilidad, recursos, eficacia y políticas pareadas."""

import json
import os
import subprocess
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np
import pytest
from jsonschema import Draft202012Validator

from domain.configuration import normalize_configuration
from domain.reproducibility import create_rng
from strategies.vaccination import select_candidates, vaccinate


def edge(index, u, v, weight=1, context="household", days=(0,)):
    return dict(id=index, u=u, v=v, weight=weight, context=context, activeDays=list(days))


def select(states, edges, policy="targeted", k=2, day=0):
    return select_candidates(
        states, edges, policy=policy, vaccines=k, day=day, rng=create_rng(12, "policy-random")
    )


@pytest.mark.parametrize("policy", ["none", "random", "targeted"])
def test_only_susceptible_nodes_can_be_selected(policy):
    rows = select(["E", "I", "R", "S"], [], policy, k=10)
    assert [r["nodeId"] for r in rows] == ([] if policy == "none" else [3])


def test_targeted_uses_one_snapshot_active_edges_and_stable_ties():
    states = ["S", "S", "S", "I", "E", "R"]
    edges = [
        edge(0, 0, 1),
        edge(1, 1, 2),
        edge(2, 0, 3, weight=10),
        edge(3, 0, 2, weight=10, days=(1,)),
        edge(4, 2, 4, weight=10),
    ]
    rows = select(states, edges, k=3)
    assert [(r["nodeId"], r["score"], r["rank"]) for r in rows] == [(0, 1, 2), (1, 2, 1), (2, 1, 3)]
    assert all(r["tieBreak"] == "nodeIdAsc" and r["contexts"] == ["household"] for r in rows)
    assert rows == select(states, list(reversed(edges)), k=3)
    assert states == ["S", "S", "S", "I", "E", "R"]


def test_random_rank_matches_choice_before_serialization():
    expected = create_rng(12, "policy-random").choice([0, 2, 3, 4], size=3, replace=False).tolist()
    rows = select(["S", "I", "S", "S", "S"], [], "random", k=3)
    assert [r["nodeId"] for r in rows] == sorted(expected)
    assert [r["nodeId"] for r in sorted(rows, key=lambda r: r["rank"])] == expected
    assert all(r["score"] is None and r["tieBreak"] == "seededRandom" for r in rows)


@pytest.mark.parametrize("efficacy", [0.0, 1.0, 0.5])
def test_efficacy_by_node_and_failed_doses_are_consumed(efficacy):
    states = ["S", "S", "E", "I", "R"]
    after, rows, events = vaccinate(
        states,
        [],
        policy="targeted",
        vaccines=5,
        day=0,
        efficacy=efficacy,
        potentials=np.array([0.2, 0.8, 0.0, 0.0, 0.0]),
        rng=create_rng(12, "policy-random"),
    )
    assert len(rows) == 2 and len({r["nodeId"] for r in rows}) == 2
    assert [r["effective"] for r in rows] == [0.2 < efficacy, 0.8 < efficacy]
    assert after == ["R" if 0.2 < efficacy else "S", "R" if 0.8 < efficacy else "S", "E", "I", "R"]
    assert len(events) == sum(r["effective"] for r in rows)
    assert states == ["S", "S", "E", "I", "R"]
    assert all(e["cause"] == "vaccine" and e["from"] == "S" and e["to"] == "R" for e in events)


def test_empty_elegibles_zero_budget_and_none():
    for states in (["E", "I", "R"], ["S", "S"]):
        assert select(states, [], k=0) == []
        assert select(states, [], "none", k=10) == []
    assert select(["E", "I", "R"], [], k=10) == []


def test_paired_simulations_k_zero_and_execution_order():
    from simulation.engine import simulate_paired
    from simulation.network import generate_graph

    c = normalize_configuration(
        {"scenario": {"populationSize": 50, "days": 4}, "intervention": {"vaccines": 0}}
    )
    g = generate_graph(c)
    forward = simulate_paired(c, g)
    reverse = simulate_paired(c, g, policy_order=("targeted", "random", "none"))
    assert forward == reverse
    assert forward["none"] == forward["random"] == forward["targeted"]
    assert list(reverse) == ["none", "random", "targeted"]


def test_intervention_day_zero_protects_and_day_T_does_not_rescue_exposed():
    from simulation.engine import simulate_paired
    from simulation.network import generate_graph

    base = normalize_configuration(
        {
            "scenario": {
                "populationSize": 50,
                "days": 1,
                "beta": 1,
                "gamma": 0,
                "origin": {"kind": "node", "value": 0},
            },
            "intervention": {"vaccines": 49, "vaccineEfficacy": 1},
        }
    )
    graph = generate_graph(base)
    graph["edges"] = [edge(0, 0, 1, days=(0, 1))]
    early = simulate_paired(base, graph)
    late = simulate_paired(
        replace(base, intervention=replace(base.intervention, intervention_day=1)), graph
    )
    for policy in ("random", "targeted"):
        assert early[policy].daily[0]["r"] == 49
        assert early[policy].daily[1]["cumulativeInfected"] == 1
        assert late[policy].daily[1]["e"] == 1
        assert late[policy].daily[1]["r"] == 48
        assert late[policy].vaccines_assigned == 48 and late[policy].vaccines_unused == 1
        assert all(r["nodeId"] != 1 for r in late[policy].selections)
    assert early["none"].vaccines_unused == 49


def test_shared_efficacy_and_replica_order():
    from simulation.engine import simulate_paired
    from simulation.network import generate_graph

    c = normalize_configuration(
        {
            "scenario": {"populationSize": 50, "days": 3, "beta": 0},
            "intervention": {"vaccines": 50, "vaccineEfficacy": 0.5},
        }
    )
    g = generate_graph(c)
    forward = {i: simulate_paired(c, g, replicate_index=i) for i in range(3)}
    assert forward == {
        i: simulate_paired(c, g, replicate_index=i, policy_order=("random", "targeted", "none"))
        for i in reversed(range(3))
    }
    for result in forward.values():
        a, b = result["random"], result["targeted"]
        assert {r["nodeId"]: r["effective"] for r in a.selections} == {
            r["nodeId"]: r["effective"] for r in b.selections
        }
        assert a.vaccines_assigned == b.vaccines_assigned == 49
        assert a.randomness_hash == b.randomness_hash == result["none"].randomness_hash
        assert a.daily[0]["cumulativeInfected"] == 1


def test_failing_vaccines_keep_curves_but_consume_doses():
    from simulation.engine import simulate_paired
    from simulation.network import generate_graph

    c = normalize_configuration(
        {
            "scenario": {"populationSize": 50, "days": 4},
            "intervention": {"vaccines": 10, "vaccineEfficacy": 0},
        }
    )
    result = simulate_paired(c, generate_graph(c))
    for policy in ("random", "targeted"):
        assert result[policy].daily == result["none"].daily
        assert result[policy].vaccines_assigned == 10 and result[policy].vaccines_effective == 0
        assert result[policy].vaccines_unused == 0


def test_selection_and_vaccine_events_match_shared_schemas():
    definitions = json.loads(
        (Path(__file__).resolve().parents[2] / "schemas/common.schema.json").read_text()
    )["$defs"]
    states = ["S", "S", "I"]
    for policy in ("random", "targeted"):
        _, rows, events = vaccinate(
            states,
            [edge(0, 0, 1)],
            policy=policy,
            vaccines=3,
            day=0,
            efficacy=1,
            potentials=np.zeros(3),
            rng=create_rng(1, "policy-random"),
        )
        for name, values in (("Selection", rows), ("Event", events)):
            validator = Draft202012Validator({"$defs": definitions, "$ref": "#/$defs/" + name})
            for value in values:
                validator.validate(value)


def test_efficacy_threshold_is_strict_and_budget_is_not_replenished():
    from simulation.engine import simulate_paired
    from simulation.network import generate_graph

    after, rows, events = vaccinate(
        ["S"],
        [],
        policy="targeted",
        vaccines=1,
        day=0,
        efficacy=0.5,
        potentials=np.array([0.5]),
        rng=create_rng(1, "policy-random"),
    )
    assert after == ["S"] and not rows[0]["effective"] and events == []
    c = normalize_configuration(
        {
            "scenario": {"populationSize": 50, "days": 4, "beta": 0},
            "intervention": {"vaccines": 10, "vaccineEfficacy": 0},
        }
    )
    paired = simulate_paired(c, generate_graph(c))
    for policy in ("random", "targeted"):
        assert len(paired[policy].selections) == 10
        assert all(row["day"] == 0 for row in paired[policy].selections)


@pytest.mark.parametrize(
    "order", [("none", "random"), ("none", "random", "random"), ("none", "random", "unknown")]
)
def test_incomplete_or_unknown_policy_sets_rejected(order):
    from simulation.engine import simulate_paired
    from simulation.network import generate_graph

    c = normalize_configuration(
        {"scenario": {"populationSize": 50, "days": 1}, "intervention": {"vaccines": 0}}
    )
    with pytest.raises(ValueError, match="tres políticas"):
        simulate_paired(c, generate_graph(c), policy_order=order)


def test_delayed_decisions_share_snapshot_and_conserve_states():
    from simulation.engine import simulate_paired
    from simulation.network import generate_graph

    c = normalize_configuration(
        {
            "scenario": {"populationSize": 50, "days": 7, "beta": 1},
            "intervention": {"vaccines": 20, "interventionDay": 3},
        }
    )
    result = simulate_paired(c, generate_graph(c))
    assert result["random"].frames[:3] == result["targeted"].frames[:3] == result["none"].frames[:3]
    assert result["random"].vaccines_assigned == result["targeted"].vaccines_assigned
    for trace in result.values():
        assert trace.vaccines_assigned + trace.vaccines_unused == 20
        for row in trace.daily:
            assert sum(row[k] for k in ("s", "e", "i", "r")) == 50
        for selection in trace.selections:
            node = selection["nodeId"]
            # The none run is exactly the shared pre-intervention state.
            assert result["none"].frames[3][node] == "S"
        assert trace.events == sorted(
            trace.events, key=lambda row: (row["day"], row["nodeId"], row["cause"])
        )


def test_paired_traces_repeat_in_three_processes(tmp_path):
    source = Path(__file__).resolve().parents[1] / "src"
    script = "from domain.configuration import normalize_configuration; from domain.reproducibility import json_hash; from simulation.network import generate_graph; from simulation.engine import simulate_paired; from dataclasses import asdict; c=normalize_configuration({'scenario':{'populationSize':50,'days':4},'intervention':{'vaccines':10,'vaccineEfficacy':0.5}}); print(json_hash({k:asdict(v) for k,v in simulate_paired(c,generate_graph(c)).items()}))"
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
