"""Consistencia de mocks compartidos, sin ejecutar el generador ni el motor."""

import json
from collections import Counter
from pathlib import Path
from statistics import mean

import pytest

EXAMPLES = Path(__file__).resolve().parents[2] / "schemas" / "examples"


@pytest.mark.parametrize(
    "filename",
    [
        "compare-response.json",
        "compare-response-no-frames.json",
        "compare-response-vaccines.json",
        "compare-response-bootstrap.json",
    ],
)
def test_handcrafted_compare_examples_are_internally_consistent(filename: str) -> None:
    result = json.loads((EXAMPLES / filename).read_text(encoding="utf-8"))
    configuration = result["configuration"]
    n = configuration["scenario"]["populationSize"]
    days = configuration["scenario"]["days"]
    repetitions = configuration["repetitions"]
    assert result["progress"] == {
        "replicatesTotal": repetitions,
        "replicatesSucceeded": repetitions,
        "replicatesFailed": 0,
    }
    assert len(result["graph"]["nodes"]) == n
    assert [item["index"] for item in result["replicates"]] == list(range(repetitions))
    for replicate in result["replicates"]:
        for policy, data in replicate["policies"].items():
            assert [row["day"] for row in data["daily"]] == list(range(days + 1))
            assert all(sum(row[key] for key in ("s", "e", "i", "r")) == n for row in data["daily"])
            assert data["metrics"]["vaccinesAssigned"] == len(data["selections"])
            assert data["metrics"]["vaccinesEffective"] == sum(
                selection["effective"] for selection in data["selections"]
            )
            assert (
                data["metrics"]["vaccinesUnused"] + data["metrics"]["vaccinesAssigned"]
                == configuration["intervention"]["vaccines"]
            )
            if policy == "none":
                assert data["selections"] == []
            if replicate["index"] != result["representative"]["index"]:
                assert data["events"] is None
    for policy in ("none", "random", "targeted"):
        for metric, statistic in result["summaryByPolicy"][policy].items():
            values = [
                replicate["policies"][policy]["metrics"][metric]
                for replicate in result["replicates"]
            ]
            values = [value for value in values if value is not None]
            assert statistic["n"] == len(values)
            assert statistic["mean"] == (mean(values) if values else None)
        frames = result["representative"]["frames"]
        if frames is not None:
            rows = result["replicates"][result["representative"]["index"]]["policies"][policy][
                "daily"
            ]
            assert len(frames[policy]) == days + 1
            for frame, daily in zip(frames[policy], rows, strict=True):
                assert len(frame) == n
                counts = Counter(frame)
                assert all(counts[key.upper()] == daily[key] for key in ("s", "e", "i", "r"))
