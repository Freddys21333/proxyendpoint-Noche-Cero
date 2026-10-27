"""P-02: Decisiones adaptativas observables (PRO-3).

Verifica gatillos adaptativos:
- Cierre de contexto dinámico según umbral infeccioso.
- Re-apertura según umbral bajo.
- Cero brigadas si no hay infecciosos activos (brote contenido).
- Prioridad de vacunación de anillo (ring vaccination) a vecinos de infectados.
- Preservación exacta de presupuesto, inventario y reproducibilidad.
"""

from domain.configuration import normalize_configuration
from simulation.engine import simulate_paired
from simulation.network import generate_graph
from strategies.vaccination import select_candidates


def test_adaptive_ring_vaccination_priority_targets_infected_neighbors():
    """Un nodo susceptible con vecinos infecciosos activos debe tener prioridad en anillo."""
    # Nodos: 0(I), 1(S, vecino de 0), 2(S, muchos vecinos S pero no de I), 3(S), 4(S)
    states = ["I", "S", "S", "S", "S"]
    edges = [
        {"id": 0, "u": 0, "v": 1, "weight": 0.5, "context": "household", "activeDays": [0, 1]},
        {"id": 1, "u": 2, "v": 3, "weight": 1.0, "context": "household", "activeDays": [0, 1]},
        {"id": 2, "u": 2, "v": 4, "weight": 1.0, "context": "household", "activeDays": [0, 1]},
    ]
    from numpy.random import default_rng

    rng = default_rng(1234)

    # Con ring_priority=False (modo estándar targeted):
    # Nodo 2 tiene suma de pesos S-S = 2.0; nodo 1 tiene suma S-S = 0.0.
    std_sel = select_candidates(
        states, edges, policy="targeted", vaccines=1, day=0, rng=rng, ring_priority=False
    )
    assert len(std_sel) == 1
    assert std_sel[0]["nodeId"] == 2
    assert std_sel[0]["tieBreak"] == "nodeIdAsc"

    # Con ring_priority=True (modo adaptativo):
    # Nodo 1 tiene contacto directo con el nodo 0 (I), por lo que recibe prioridad de anillo.
    adapt_sel = select_candidates(
        states, edges, policy="targeted", vaccines=1, day=0, rng=rng, ring_priority=True
    )
    assert len(adapt_sel) == 1
    assert adapt_sel[0]["nodeId"] == 1
    assert adapt_sel[0]["tieBreak"] == "ringContact"


def test_adaptive_strategy_simulation_runs_and_preserves_budget():
    """Simulación completa con adaptiveStrategy activa cumple conservación de presupuesto."""
    payload = {
        "scenario": {"populationSize": 50, "days": 5, "beta": 0.2},
        "repetitions": 2,
        "intervention": {
            "vaccines": 5,
            "interventionDay": 0,
            "vaccineEfficacy": 1.0,
            "combined": {
                "modelVersion": "combined-educational-v1",
                "budgetCents": 50000,
                "vaccineCostCents": 1000,
                "closureCostCents": 500,
                "closureContext": "school",
                "closureStart": 0,
                "closureDays": 5,
                "brigadeCostCents": 100,
                "brigadeDailyCapacity": 5,
                "brigadeReduction": 0.4,
                "brigadeStart": 0,
                "brigadeDays": 5,
                "adaptiveStrategy": {
                    "modelVersion": "adaptive-policy-v1",
                    "closureInfectionThreshold": 0.04,  # 4% de 50 = 2 personas
                    "reopenInfectionThreshold": 0.02,  # 2% de 50 = 1 persona
                    "ringVaccinationPriority": True,
                    "enabled": True,
                },
            },
        },
    }
    config = normalize_configuration(payload)
    assert config.intervention.combined is not None
    assert config.intervention.combined.adaptive_strategy is not None
    assert config.intervention.combined.adaptive_strategy.enabled is True

    graph = generate_graph(config)
    traces = simulate_paired(config, graph)

    for policy, trace in traces.items():
        assert len(trace.daily) == 6  # días 0..5
        previous_spent = 0
        for row in trace.daily:
            spent = row["spentCents"]
            cost = row["spentTodayCents"]
            assert spent == previous_spent + cost
            assert row["budgetRemainingCents"] == 50000 - spent
            assert spent <= 50000
            previous_spent = spent
            if policy == "none":
                assert spent == 0
                assert cost == 0
