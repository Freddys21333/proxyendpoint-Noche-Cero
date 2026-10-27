"""P-06: calibración y validación fuera de muestra sobre el dengue de Manabí.

Las pruebas fijan el protocolo declarado en `specs/pro-roadmap.md` antes de
mirar resultados: ventanas de dos tercios por número de semanas, función de
observación binomial negativa, parámetros fijados por el motor y bootstrap
determinista.
"""

import json
import math
from pathlib import Path

import pytest

from data.calibration import (
    BOOTSTRAP_REPLICATES,
    DISPERSION_GRID,
    ENGINE_PRESET_ID,
    GAMMA,
    POPULATION,
    SIGMA,
    Model,
    SimulationError,
    best_dispersion,
    bootstrap,
    evaluate,
    fit,
    load_series,
    log_likelihood,
    mean_baseline,
    negative_binomial_logpmf,
    persistence_baseline,
    predictive_interval,
    profile_beta,
    sample_observations,
    simulate,
    split_window,
)
from domain.configuration import normalize_configuration

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data/p05"
PRESET = ROOT / "data/p06/dengue-preset-v1.json"
FRONTEND_PRESET = ROOT / "frontend/src/lib/dengue-preset.json"
EXPECTED_CSV_SHA256 = "e51b0858624ccd32349e86fcee57777bc1834579b80416e21ce54b1b11d1913a"


def read_csv_text() -> str:
    with (DATA / "manabi-dengue-weekly.csv").open("r", encoding="utf-8", newline="") as stream:
        return stream.read()


def series(year: int) -> list[int]:
    return [row.cases for row in load_series(read_csv_text(), year)]


def load_preset() -> dict:
    return json.loads(PRESET.read_text(encoding="utf-8"))


# --- protocolo declarado ---------------------------------------------------


def test_split_window_uses_two_thirds_by_week_count() -> None:
    window_2025 = split_window(53)
    assert (window_2025.fit_start, window_2025.fit_end) == (1, 35)
    assert (window_2025.validation_start, window_2025.validation_end) == (36, 53)

    window_2026 = split_window(41)
    assert (window_2026.fit_start, window_2026.fit_end) == (1, 27)
    assert (window_2026.validation_start, window_2026.validation_end) == (28, 41)

    with pytest.raises(SimulationError):
        split_window(2)


def test_fixed_parameters_come_from_the_engine_defaults() -> None:
    assert SIGMA == pytest.approx(0.333333)
    assert GAMMA == pytest.approx(0.142857)
    assert POPULATION == 1_661_447
    assert DISPERSION_GRID == (2.0, 5.0, 10.0, 25.0, 50.0, 100.0)
    assert BOOTSTRAP_REPLICATES == 120


# --- simulación y verosimilitud -------------------------------------------


def test_simulation_conserves_population_and_is_deterministic() -> None:
    model = Model(beta=0.2, reporting=0.05)
    first = simulate(model, weeks=20, first_week_cases=31)
    second = simulate(model, weeks=20, first_week_cases=31)
    assert first == second
    assert len(first) == 20
    assert all(value >= 0 for value in first)
    # La semana 1 condiciona el estado inicial: debe quedar cerca del dato observado.
    assert 0.8 * 31 <= first[0] <= 1.2 * 31


def test_simulation_is_monotone_in_beta_at_the_start() -> None:
    slow = simulate(Model(beta=0.15, reporting=0.05), weeks=6, first_week_cases=31)
    fast = simulate(Model(beta=0.35, reporting=0.05), weeks=6, first_week_cases=31)
    assert fast[4] > slow[4]
    assert fast[1] > slow[1]


def test_invalid_parameters_are_rejected() -> None:
    for beta, reporting in ((0.0, 0.05), (1.5, 0.05), (0.2, 0.0), (0.2, 1.5)):
        with pytest.raises(SimulationError):
            simulate(Model(beta=beta, reporting=reporting), weeks=4, first_week_cases=10)
    with pytest.raises(SimulationError):
        simulate(Model(beta=0.2, reporting=0.05), weeks=0, first_week_cases=10)
    with pytest.raises(SimulationError):
        simulate(Model(beta=0.2, reporting=1e-12), weeks=4, first_week_cases=10)


def test_negative_binomial_logpmf_matches_the_formula() -> None:
    cases, mean, dispersion = 12, 9.5, 25.0
    expected = (
        math.lgamma(cases + dispersion)
        - math.lgamma(dispersion)
        - math.lgamma(cases + 1)
        + dispersion * math.log(dispersion / (dispersion + mean))
        + cases * math.log(mean / (dispersion + mean))
    )
    assert negative_binomial_logpmf(cases, mean, dispersion) == pytest.approx(expected)


def test_best_dispersion_selects_the_grid_value() -> None:
    observed = [10, 20, 30, 25, 15]
    predicted = [11.0, 19.0, 29.0, 26.0, 16.0]
    dispersion, loglik = best_dispersion(observed, predicted)
    assert dispersion in DISPERSION_GRID
    assert loglik == pytest.approx(log_likelihood(observed, predicted, dispersion))
    assert loglik > log_likelihood(observed, predicted, 2.0)


def test_evaluate_reports_metrics_and_coverage() -> None:
    metrics = evaluate([10, 20, 30], [12.0, 18.0, 31.0], dispersion=25.0)
    assert metrics.mae == pytest.approx((2 + 2 + 1) / 3)
    assert metrics.rmse == pytest.approx(math.sqrt((4 + 4 + 1) / 3))
    assert metrics.coverage95 == 1.0
    assert metrics.log_score < 0
    low, high = predictive_interval(20.0, 25.0)
    assert 0 <= low < 20.0 < high


# --- ajuste -----------------------------------------------------------------


def test_fit_recovers_known_parameters_from_synthetic_data() -> None:
    truth = Model(beta=0.2, reporting=0.05)
    expected = simulate(truth, weeks=35, first_week_cases=31)
    observed = sample_observations(expected[1:], 25.0, seed=20_261_027)
    result = fit(observed, weeks=35)
    assert abs(result.beta - truth.beta) / truth.beta < 0.15
    assert abs(result.reporting - truth.reporting) / truth.reporting < 0.5
    assert result.dispersion in DISPERSION_GRID
    assert result.r0 == pytest.approx(result.beta / GAMMA)


def test_fit_rejects_short_or_invalid_series() -> None:
    with pytest.raises(SimulationError):
        fit([1, 2], weeks=5)
    with pytest.raises(SimulationError):
        fit([10, -1, 5, 8], weeks=5)
    with pytest.raises(SimulationError):
        evaluate([1, 2], [1.0], dispersion=10.0)


def test_profile_likelihood_peaks_near_the_estimate() -> None:
    observed = series(2025)[1:35]
    result = fit(observed, weeks=35)
    grid = [result.beta * 0.5, result.beta * 0.8, result.beta, result.beta * 1.25]
    profile = profile_beta(observed, weeks=35, betas=grid)
    best = max(profile, key=lambda point: point[1])
    assert best[0] == pytest.approx(result.beta)


def test_bootstrap_is_deterministic_and_ordered() -> None:
    observed = series(2025)[1:35]
    first = bootstrap(observed, weeks=35, replicates=5, seed=7)
    second = bootstrap(observed, weeks=35, replicates=5, seed=7)
    assert [item.beta for item in first] == [item.beta for item in second]
    assert len(first) == 5
    for item in first:
        assert item.beta > 0 and 0 < item.reporting <= 1


# --- datos reales y preset --------------------------------------------------


def test_load_series_reads_the_frozen_dataset() -> None:
    rows = load_series(read_csv_text(), 2025)
    assert len(rows) == 53
    assert rows[0].week == 1 and rows[0].cases == 31
    assert rows[-1].week == 53 and rows[-1].cases == 18
    assert sum(row.cases for row in rows) == 6313
    with pytest.raises(SimulationError):
        load_series(read_csv_text(), 2024)
    with pytest.raises(SimulationError):
        load_series(read_csv_text().replace("MANABI,2025,1,31", "MANABI,2025,3,31"), 2025)


def test_real_fit_matches_the_published_preset() -> None:
    preset = load_preset()
    assert preset["dataset"]["csvSha256"] == EXPECTED_CSV_SHA256
    assert preset["presetId"] == ENGINE_PRESET_ID

    for entry in preset["fits"]:
        observed = series(entry["year"])
        window = split_window(len(observed))
        assert entry["window"]["fitStart"] == window.fit_start
        result = fit(observed[1 : window.fit_end], weeks=len(observed))
        assert result.beta == pytest.approx(entry["parameters"]["beta"], rel=1e-6)
        assert result.reporting == pytest.approx(entry["parameters"]["reporting"], rel=1e-6)
        assert result.dispersion == pytest.approx(entry["parameters"]["dispersion"])
        assert result.loglik == pytest.approx(entry["parameters"]["logLikelihood"], rel=1e-9)


def test_validation_metrics_and_baselines_are_published() -> None:
    preset = load_preset()
    entry = next(item for item in preset["fits"] if item["year"] == 2025)
    observed = series(2025)
    window = split_window(len(observed))
    metrics = entry["metrics"]["validation"]
    baselines = entry["baselines"]
    assert 0.0 <= metrics["coverage95"] <= 1.0
    assert metrics["mae"] > 0
    assert baselines["persistence"]["mae"] > 0
    assert baselines["mean"]["mae"] > 0
    assert entry["metrics"]["validationPoints"] == window.validation_end - window.fit_end
    assert persistence_baseline(observed[1:35], observed[35:])[0] == observed[34]
    assert mean_baseline(observed[1:35], observed[35:])[0] == pytest.approx(
        sum(observed[1:35]) / 34
    )


def test_engine_preset_is_a_valid_configuration() -> None:
    preset = load_preset()
    configuration = preset["engine"]["configuration"]
    normalized = normalize_configuration(configuration).to_dict()
    scenario = normalized["scenario"]
    assert 0 < scenario["beta"] <= 1
    assert scenario["populationSize"] <= 2000
    assert scenario["days"] <= 180
    assert scenario["sigma"] == pytest.approx(SIGMA)
    assert scenario["gamma"] == pytest.approx(GAMMA)
    assert preset["engine"]["r0"] == pytest.approx(preset["fits"][0]["parameters"]["r0"], rel=1e-6)
    assert preset["engine"]["betaApproximation"] == pytest.approx(
        preset["engine"]["r0"] * GAMMA / preset["engine"]["meanDailyWeightPerNode"], rel=1e-6
    )
    assert "calibrado" in preset["label"].lower()
    assert preset["status"] == "fitted-not-validated"


def test_identifiability_is_conditional_on_the_model() -> None:
    preset = load_preset()
    block = preset["identifiability"]
    assert block["year"] == 2025
    assert len(block["points"]) == 16
    assert max(point["delta"] for point in block["points"]) == 0.0
    assert all(point["delta"] <= 0.0 for point in block["points"])
    # El perfil tiene un máximo claro: mover beta un 10 % cuesta más de 2 unidades.
    assert block["identified"] is True
    assert block["tenPercentDelta"]["down"] < -2.0
    assert block["tenPercentDelta"]["up"] < -2.0
    assert block["withinTwoLogUnits"]["count"] == 1
    assert "condicionad" in block["note"]


def test_profile_does_not_escape_to_the_global_optimum() -> None:
    observed = series(2025)[1:35]
    result = fit(observed, weeks=53)
    far = result.beta * 1.5
    score = profile_beta(observed, weeks=53, betas=[far])[0][1]
    assert score < result.loglik - 2.0


def test_engine_bridge_is_reported_as_a_deviation() -> None:
    preset = load_preset()
    bridge = preset["engine"]["bridgeCheck"]
    assert bridge["replicates"] == 10
    assert 0 <= bridge["extinctions"] <= bridge["replicates"]
    assert bridge["growthRateTheory"] > 0
    # Con 3 infecciosos iniciales el brote puede apagarse: se declara, no se oculta.
    assert bridge["fizzledRate"] == pytest.approx(bridge["extinctions"] / bridge["replicates"])


def test_validation_result_is_recorded_even_though_it_is_unfavorable() -> None:
    preset = load_preset()
    for entry in preset["fits"]:
        validation = entry["metrics"]["validation"]["mae"]
        persistence = entry["baselines"]["persistence"]["mae"]
        # Resultado publicado: el modelo pierde frente a persistencia. No se re-tunea.
        assert validation > persistence


def test_frontend_copy_matches_the_backend_preset() -> None:
    preset = load_preset()
    frontend = json.loads(FRONTEND_PRESET.read_text(encoding="utf-8"))
    assert frontend["presetId"] == preset["presetId"]
    assert frontend["hash"] == preset["hash"]
    assert frontend["engine"] == preset["engine"]
    assert frontend["label"] == preset["label"]
    assert frontend["limits"] == preset["limits"]
    assert frontend["status"] == preset["status"]
    assert frontend["identifiability"] == {
        "identified": preset["identifiability"]["identified"],
        "withinTwoLogUnits": preset["identifiability"]["withinTwoLogUnits"],
        "tenPercentDelta": preset["identifiability"]["tenPercentDelta"],
        "note": preset["identifiability"]["note"],
    }


def test_preset_keeps_the_fictional_mode_separate() -> None:
    preset = load_preset()
    assert preset["engine"]["configuration"]["scenario"]["beta"] != 0.08
    assert any("no" in limit.lower() and "dengue" in limit.lower() for limit in preset["limits"])
    assert preset["model"]["form"] == "seir-homogeneous-mixing-v1"
    assert preset["provenance"]["verifyCommand"].endswith("p06_calibrate.py verify")
