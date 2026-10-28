"""P-07: los hashes no sustituyen la integridad de frames y eventos opcionales."""

import copy

import pytest

from domain.configuration import normalize_configuration
from domain.reproducibility import canonical_json
from simulation.experiments import run_experiment
from simulation.exports import experiment_hash, export_experiment, export_zip, load_export


@pytest.fixture(scope="module")
def source():
    return export_experiment(
        run_experiment(
            normalize_configuration(
                {
                    "scenario": {
                        "populationSize": 50,
                        "days": 4,
                        "beta": 1,
                        "sigma": 1,
                        "gamma": 1,
                    },
                    "intervention": {"vaccines": 5, "interventionDay": 1},
                    "repetitions": 2,
                }
            )
        )
    )


def test_same_counts_do_not_allow_relabelling_people(source):
    changed = copy.deepcopy(source)
    frame = changed["representative"]["frames"]["none"][0]
    infected, susceptible = frame.index("I"), frame.index("S")
    frame[infected], frame[susceptible] = frame[susceptible], frame[infected]
    assert experiment_hash(changed) == experiment_hash(source)
    with pytest.raises(ValueError):
        load_export(canonical_json(changed))
    with pytest.raises(ValueError):
        export_zip(changed)
    with pytest.raises(ValueError):
        export_experiment(changed)


@pytest.mark.parametrize(
    "mutation",
    [
        "missing_event",
        "source",
        "edge",
        "day",
        "duplicate",
        "seed",
        "frames_length",
        "representative",
    ],
)
def test_incoherent_optional_playback_rejected(source, mutation):
    changed = copy.deepcopy(source)
    rep = changed["replicates"][changed["representative"]["index"]]
    events = rep["policies"]["none"]["events"]
    contact = next(event for event in events if event["cause"] == "contact")
    if mutation == "missing_event":
        events.remove(contact)
    elif mutation == "source":
        contact["sourceNodeId"] = contact["nodeId"]
    elif mutation == "edge":
        contact["edgeId"] = 9999999
    elif mutation == "day":
        contact["day"] = 5
    elif mutation == "duplicate":
        events.insert(events.index(contact), copy.deepcopy(contact))
    elif mutation == "seed":
        changed["representative"]["initialSeed"]["rootSeed"] += 1
    elif mutation == "representative":
        changed["representative"]["index"] = 1 - changed["representative"]["index"]
    else:
        changed["representative"]["frames"]["none"].pop()
    assert experiment_hash(changed) == experiment_hash(source)
    with pytest.raises(ValueError):
        load_export(canonical_json(changed))


def test_optional_frames_and_events_can_be_absent_without_fabricating_data(source):
    for frames in (True, False):
        for events in (True, False):
            changed = copy.deepcopy(source)
            if not frames:
                changed["representative"]["frames"] = None
            if not events:
                for rep in changed["replicates"]:
                    for result in rep["policies"].values():
                        result["events"] = None
            assert load_export(canonical_json(changed)) == changed


def test_events_are_checked_without_frames_and_frames_without_events(source):
    no_frames = copy.deepcopy(source)
    no_frames["representative"]["frames"] = None
    rep = no_frames["replicates"][no_frames["representative"]["index"]]
    rep["policies"]["none"]["events"].pop()
    with pytest.raises(ValueError):
        load_export(canonical_json(no_frames))
    no_events = copy.deepcopy(source)
    for rep in no_events["replicates"]:
        for result in rep["policies"].values():
            result["events"] = None
    frame = no_events["representative"]["frames"]["none"][0]
    a, b = frame.index("I"), frame.index("S")
    frame[a], frame[b] = frame[b], frame[a]
    with pytest.raises(ValueError):
        load_export(canonical_json(no_events))


@pytest.mark.parametrize(("day", "efficacy"), [(0, 1), (4, 1), (0, 0)])
def test_boundaries_vaccination_failure_and_optional_frames_keep_hashes(day, efficacy):
    cfg = normalize_configuration(
        {
            "scenario": {"populationSize": 50, "days": 4, "beta": 0},
            "intervention": {"vaccines": 5, "interventionDay": day, "vaccineEfficacy": efficacy},
            "repetitions": 2,
        }
    )
    source = export_experiment(run_experiment(cfg))
    before = copy.deepcopy(source)
    assert load_export(canonical_json(source)) == source == before
    without_frames = export_experiment(
        run_experiment(
            cfg, include_representative_frames=False, policy_order=("targeted", "random", "none")
        )
    )
    assert source["manifest"]["experimentHash"] == without_frames["manifest"]["experimentHash"]
    selected = source["replicates"][source["representative"]["index"]]
    for policy in ("random", "targeted"):
        vaccine_events = [
            e for e in selected["policies"][policy]["events"] if e["cause"] == "vaccine"
        ]
        assert len(vaccine_events) == 5 * efficacy
        assert all(e["day"] == day for e in vaccine_events)
