"""P-04: particionar índices conserva el experimento canónico."""

import pytest

from domain.configuration import normalize_configuration
from simulation.experiments import run_experiment
from simulation.network import generate_graph


def test_batches_preserve_global_indices_and_exact_result():
    from simulation.distributed import assemble, batch

    configuration = normalize_configuration(
        {
            "scenario": {"populationSize": 50, "days": 4},
            "intervention": {"vaccines": 10},
            "repetitions": 4,
        }
    )
    graph = generate_graph(configuration)
    rows = batch(configuration, graph, [2, 3]) + batch(configuration, graph, [0, 1])
    assert assemble(configuration, graph, rows, frames=True) == run_experiment(configuration)
    with pytest.raises(ValueError):
        assemble(configuration, graph, rows[:-1], frames=True)
    with pytest.raises(ValueError):
        assemble(configuration, graph, rows + rows[:1], frames=True)


def test_thousand_replicates_export_without_changing_local_input_limits():
    from domain.errors import ConfigurationError
    from simulation.distributed import assemble, batch
    from simulation.exports import export_experiment

    source = {
        "scenario": {"populationSize": 50, "days": 1, "beta": 0},
        "intervention": {"vaccines": 0},
        "repetitions": 1000,
    }
    with pytest.raises(ConfigurationError):
        normalize_configuration(source, for_jobs=True)
    cfg = normalize_configuration(source, for_aws_jobs=True)
    graph = generate_graph(cfg)
    rows = batch(cfg, graph, list(range(1000)))
    document = export_experiment(assemble(cfg, graph, rows))
    assert document["progress"]["replicatesSucceeded"] == 1000
    assert document["summaryByPolicy"]["none"]["cumulativeInfected"]["n"] == 1000
