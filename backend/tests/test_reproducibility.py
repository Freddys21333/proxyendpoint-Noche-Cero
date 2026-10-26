"""T-05 / CA-06/07: canonización y flujos reproducibles aislados."""

import hashlib
import os
import struct
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

from domain.reproducibility import canonical_json, create_rng, json_hash, seed_entropy


def test_canonical_bytes_and_known_digest() -> None:
    value = {"z": [-0.0, 2.0, True, None], "á": "Manta", "a": 0.125}
    expected = '{"a":0.125,"z":[0,2,true,null],"á":"Manta"}'.encode()
    assert canonical_json(value) == expected
    assert value["z"][0] == -0.0
    assert (
        json_hash({}) == "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"
    )
    assert json_hash(value) == "sha256:" + hashlib.sha256(expected).hexdigest()


@pytest.mark.parametrize(
    "value", [float("nan"), float("inf"), -float("inf"), {1: "x"}, (1,), object()]
)
def test_rejects_non_json_values(value: object) -> None:
    with pytest.raises((ValueError, TypeError)):
        canonical_json(value)


def test_mapping_order_is_irrelevant_but_array_order_is_preserved() -> None:
    assert json_hash({"b": 2, "a": 1}) == json_hash({"a": 1.0, "b": 2.0})
    assert json_hash([1, 2]) != json_hash([2, 1])


@pytest.mark.parametrize(
    "domain",
    [
        "graph",
        "initial",
        "transmission",
        "progression",
        "vaccine",
        "policy-random",
        "layout",
        "bootstrap",
    ],
)
def test_entropy_and_bit_generator_follow_spec(domain: str) -> None:
    index = 0 if domain in {"graph", "layout", "bootstrap"} else 3
    entropy = [20261026, index, *struct.unpack("<8I", hashlib.sha256(domain.encode()).digest())]
    assert seed_entropy(20261026, domain, 3) == tuple(entropy)
    expected = np.random.Generator(np.random.PCG64(np.random.SeedSequence(entropy)))
    assert create_rng(20261026, domain, 3).random(10).tolist() == expected.random(10).tolist()


def test_domains_replicates_and_consumption_are_independent() -> None:
    expected = create_rng(12, "transmission", 2).random(8).tolist()
    for domain in ["policy-random", "layout", "graph", "progression"]:
        create_rng(12, domain, 2).random(100)
    assert create_rng(12, "transmission", 2).random(8).tolist() == expected
    assert create_rng(12, "transmission", 1).random(8).tolist() != expected
    assert create_rng(13, "transmission", 2).random(8).tolist() != expected
    assert create_rng(12, "initial", 2).random(8).tolist() != expected
    assert (
        create_rng(12, "graph", 2).random(8).tolist()
        == create_rng(12, "graph", 0).random(8).tolist()
    )


def test_rng_v1_fixed_vector() -> None:
    assert create_rng(20261026, "transmission", 2).random(4).tolist() == [
        0.6169540235538498,
        0.6370443772485739,
        0.9957305823638358,
        0.18331750811934844,
    ]


@pytest.mark.parametrize(
    "root,domain,index",
    [
        (True, "graph", 0),
        (-1, "graph", 0),
        (2**32, "graph", 0),
        (1, "unknown", 0),
        (1, "initial", -1),
        (1, "initial", True),
    ],
)
def test_invalid_seed_arguments(root: int, domain: str, index: int) -> None:
    with pytest.raises(ValueError):
        create_rng(root, domain, index)


def test_three_fresh_processes_ignore_hash_seed_and_working_directory(tmp_path: Path) -> None:
    source = Path(__file__).resolve().parents[1] / "src"
    script = """
from domain.reproducibility import create_rng, json_hash
from domain.configuration import normalize_configuration
print(json_hash({'configuration': normalize_configuration().to_dict(),
                 'draws': create_rng(20261026, 'transmission', 2).random(8).tolist()}))
"""
    outputs = []
    for seed in ["1", "42", "random"]:
        environment = dict(os.environ, PYTHONPATH=str(source), PYTHONHASHSEED=seed)
        outputs.append(
            subprocess.check_output(
                [sys.executable, "-c", script], cwd=tmp_path, env=environment, text=True
            ).strip()
        )
    assert len(set(outputs)) == 1
    assert outputs[0].startswith("sha256:")
