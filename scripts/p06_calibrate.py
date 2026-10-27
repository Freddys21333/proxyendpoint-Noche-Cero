"""P-06: calibra el SEIR de mezcla homogénea al dengue notificado de Manabí.

El protocolo está congelado en `specs/pro-roadmap.md` (P-06) antes de mirar
resultados: ventanas de dos tercios por número de semanas, función de
observación binomial negativa, parámetros del motor fijados, bootstrap
determinista y preset versionado.

Subcomandos, desde la raíz::

    backend/.venv/bin/python scripts/p06_calibrate.py fit
    backend/.venv/bin/python scripts/p06_calibrate.py verify
    backend/.venv/bin/python scripts/p06_calibrate.py summary
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend/src"))

from data.calibration import (  # noqa: E402
    BOOTSTRAP_REPLICATES,
    BOOTSTRAP_SEED,
    DISPERSION_GRID,
    ENGINE_PRESET_ID,
    FIT_DENOMINATOR,
    FIT_NUMERATOR,
    GAMMA,
    POPULATION,
    SIGMA,
    Fit,
    Metrics,
    Model,
    SimulationError,
    bootstrap,
    evaluate,
    fit,
    load_series,
    mean_baseline,
    persistence_baseline,
    profile_beta,
    simulate,
    summarise,
)
from data.dengue import text_sha256  # noqa: E402
from domain.configuration import normalize_configuration  # noqa: E402
from domain.reproducibility import json_hash  # noqa: E402
from simulation.engine import simulate_policy  # noqa: E402
from simulation.network import generate_graph  # noqa: E402

CSV_PATH = ROOT / "data/p05/manabi-dengue-weekly.csv"
PRESET_PATH = ROOT / "data/p06/dengue-preset-v1.json"
FRONTEND_PRESET_PATH = ROOT / "frontend/src/lib/dengue-preset.json"
DATASET_ID = "manabi-dengue-weekly-v1"
MODEL_FORM = "seir-homogeneous-mixing-v1"
YEARS = (2025, 2026)
TOLERANCE_RELATIVE = 1e-9
TOLERANCE_ABSOLUTE = 1e-12
BRIDGE_WINDOW = (14, 45)
BRIDGE_REPLICATES = 10


def read_text(path: Path) -> str:
    with path.open("r", encoding="utf-8", newline="") as stream:
        return stream.read()


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as stream:
        stream.write(text)


def round_float(value: float) -> float:
    return round(float(value), 10)


def metrics_payload(metrics: Metrics) -> dict[str, float]:
    return {
        "mae": round_float(metrics.mae),
        "rmse": round_float(metrics.rmse),
        "bias": round_float(metrics.bias),
        "logScore": round_float(metrics.log_score),
        "coverage95": round_float(metrics.coverage95),
    }


def theory_growth_rate(beta: float) -> float:
    """Tasa de crecimiento diaria del SEIR determinista: (r+σ)(r+γ) = σβ."""

    total = SIGMA + GAMMA
    discriminant = total * total - 4.0 * SIGMA * (GAMMA - beta)
    if discriminant < 0:
        return 0.0
    return (-total + math.sqrt(discriminant)) / 2.0


def mean_daily_weight_per_node(graph: dict[str, Any], days: int) -> float:
    """Peso medio diario por persona: Σ pesos de aristas activas · 2 / N."""

    population = len(graph["nodes"])
    totals = [0.0] * days
    for edge in graph["edges"]:
        for day in edge["activeDays"]:
            if 0 <= day < days:
                totals[day] += edge["weight"]
    return round_float(2.0 * sum(totals) / (population * days))


def engine_configuration(beta: float) -> dict[str, Any]:
    """Configuración mínima del motor con el preset aplicado."""

    payload = {
        "rootSeed": 20261026,
        "repetitions": 2,
        "scenario": {
            "populationSize": 1000,
            "days": 90,
            "beta": round(beta, 6),
            "sigma": SIGMA,
            "gamma": GAMMA,
            "initialInfectious": 3,
            "origin": {"kind": "random", "value": None},
        },
    }
    return normalize_configuration(payload).to_dict()


def growth_from_onsets(onsets: dict[int, int]) -> float | None:
    """Pendiente log-lineal de los inicios de síntomas en la ventana declarada."""

    window = [
        (day, count)
        for day, count in sorted(onsets.items())
        if BRIDGE_WINDOW[0] <= day <= BRIDGE_WINDOW[1] and count > 0
    ]
    if len(window) < 5:
        return None
    xs = [point[0] for point in window]
    ys = [math.log(point[1]) for point in window]
    mean_x = sum(xs) / len(xs)
    mean_y = sum(ys) / len(ys)
    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys, strict=True))
    denominator = sum((x - mean_x) ** 2 for x in xs)
    return numerator / denominator if denominator else None


def bridge_check(configuration: dict[str, Any], calibrated_beta: float) -> dict[str, Any]:
    """Compara el preset en el motor real con la teoría de mezcla homogénea.

    La teoría usa el ``beta`` calibrado (mezcla homogénea). El motor usa la red
    heterogénea y el ``beta`` aproximado por ``R₀·γ/w̄``. Se ejecutan 10 réplicas
    para no depender de una sola realización y se cuentan las extinciones: con
    tan pocos infecciosos iniciales el brote puede apagarse por azar.
    """

    normalized = normalize_configuration(configuration)
    graph = generate_graph(normalized)
    growths: list[float] = []
    extinctions = 0
    attack_rates: list[float] = []
    for replicate_index in range(BRIDGE_REPLICATES):
        trace = simulate_policy(normalized, graph, policy="none", replicate_index=replicate_index)
        onsets: dict[int, int] = {}
        for event in trace.events:
            if event["from"] == "E" and event["to"] == "I":
                onsets[event["day"]] = onsets.get(event["day"], 0) + 1
        if trace.daily[-1]["cumulativeInfected"] <= normalized.scenario.initial_infectious:
            extinctions += 1
        estimate = growth_from_onsets(onsets)
        if estimate is not None:
            growths.append(estimate)
        attack_rates.append(
            trace.daily[-1]["cumulativeInfected"] / normalized.scenario.population_size
        )
    growths.sort()
    theoretical = theory_growth_rate(calibrated_beta)
    median_growth = growths[len(growths) // 2] if growths else None
    return {
        "window": list(BRIDGE_WINDOW),
        "replicates": BRIDGE_REPLICATES,
        "extinctions": extinctions,
        "fizzledRate": round_float(extinctions / BRIDGE_REPLICATES),
        "growthRateTheory": round_float(theoretical),
        "growthRateEngineMedian": round_float(median_growth) if median_growth is not None else None,
        "ratioMedian": round_float(median_growth / theoretical)
        if median_growth is not None and theoretical
        else None,
        "medianAttackRate90Days": round_float(sorted(attack_rates)[len(attack_rates) // 2]),
        "note": (
            "El motor parte de 3 infecciosos en 1 000 personas y una red heterogénea; "
            "la teoría asume mezcla homogénea y un estado casi estacionario. Si el "
            "brote se extingue por azar no hay pendiente que comparar. El cociente se "
            "publica como desviación entre aproximaciones, no como validación."
        ),
    }


def fit_year(csv_text: str, year: int) -> dict[str, Any]:
    observations = load_series(csv_text, year)
    cases = [row.cases for row in observations]
    weeks = len(cases)
    fit_end = FIT_NUMERATOR * weeks // FIT_DENOMINATOR
    first = float(cases[0])

    model_fit: Fit = fit(cases[1:fit_end], weeks=weeks)
    model = Model(beta=model_fit.beta, reporting=model_fit.reporting)
    predictions = [
        round_float(value) for value in simulate(model, weeks=weeks, first_week_cases=first)
    ]

    fit_observed = cases[1:fit_end]
    fit_predicted = predictions[1:fit_end]
    validation_observed = cases[fit_end:]
    validation_predicted = predictions[fit_end:]

    samples = bootstrap(cases[1:fit_end], weeks=weeks, replicates=BOOTSTRAP_REPLICATES)
    uncertainty = {
        "beta": summarise([item.beta for item in samples]),
        "reporting": summarise([item.reporting for item in samples]),
        "r0": summarise([item.r0 for item in samples]),
        "dispersion": summarise([item.dispersion for item in samples]),
        "replicates": len(samples),
        "seed": BOOTSTRAP_SEED,
    }

    grid = [model_fit.beta * factor for factor in (0.5, 0.7, 0.85, 1.0, 1.2, 1.5)]
    profile = [
        {"beta": round_float(beta), "logLikelihood": round_float(score)}
        for beta, score in profile_beta(cases[1:fit_end], weeks=weeks, betas=grid)
    ]

    persistence = persistence_baseline(fit_observed, validation_observed)
    average = mean_baseline(fit_observed, validation_observed)

    return {
        "year": year,
        "window": {
            "fitStart": 1,
            "fitEnd": fit_end,
            "validationStart": fit_end + 1,
            "validationEnd": weeks,
            "weeks": weeks,
            "rule": f"primeras floor({FIT_NUMERATOR}n/{FIT_DENOMINATOR}) semanas para ajuste",
        },
        "parameters": {
            "beta": round_float(model_fit.beta),
            "reporting": round_float(model_fit.reporting),
            "dispersion": round_float(model_fit.dispersion),
            "r0": round_float(model_fit.r0),
            "logLikelihood": round_float(model_fit.loglik),
            "evaluations": model_fit.evaluations,
        },
        "fixed": {
            "sigma": SIGMA,
            "gamma": GAMMA,
            "population": POPULATION,
            "initialState": "E0 = y1/(7·ρ·σ); I0 = σ·E0/β; la semana 1 solo condiciona",
            "dispersionGrid": list(DISPERSION_GRID),
        },
        "uncertainty": uncertainty,
        "profile": profile,
        "metrics": {
            "fit": metrics_payload(evaluate(fit_observed, fit_predicted, model_fit.dispersion)),
            "validation": metrics_payload(
                evaluate(validation_observed, validation_predicted, model_fit.dispersion)
            ),
            "fitPoints": len(fit_observed),
            "validationPoints": len(validation_observed),
        },
        "baselines": {
            "persistence": metrics_payload(
                evaluate(validation_observed, persistence, model_fit.dispersion)
            ),
            "mean": metrics_payload(evaluate(validation_observed, average, model_fit.dispersion)),
        },
        "series": {
            "observed": cases,
            "predicted": predictions,
        },
    }


def identifiability(csv_text: str, year: int) -> dict[str, Any]:
    """Perfil de verosimilitud de beta, con ``reporting`` reoptimizado y beta fijo.

    La rejilla se declara aquí y no depende del resultado: 16 valores entre 0.10 y
    0.25, que cubren ``R₀`` de 0,7 a 1,75 con ``γ`` del motor. Un perfil con un
    máximo claro indica que el dato determina ``beta`` **condicionado al modelo**;
    no corrige el mal ajuste ni la confusión entre ``N`` y ``rho``.
    """

    observations = load_series(csv_text, year)
    cases = [row.cases for row in observations]
    weeks = len(cases)
    fit_end = FIT_NUMERATOR * weeks // FIT_DENOMINATOR
    observed = cases[1:fit_end]
    betas = [0.10 + 0.01 * index for index in range(16)]
    profile = profile_beta(observed, weeks=weeks, betas=betas)
    best = max(score for _, score in profile)
    best_beta = next(beta for beta, score in profile if score == best)
    points = [
        {
            "beta": round_float(beta),
            "r0": round_float(beta / GAMMA),
            "logLikelihood": round_float(score),
            "delta": round_float(score - best),
        }
        for beta, score in profile
    ]
    flat = [point["beta"] for point in points if point["delta"] >= -2.0]
    ten_percent = profile_beta(observed, weeks=weeks, betas=(best_beta * 0.9, best_beta * 1.1))
    deltas = [{round_float(beta): round_float(score - best)} for beta, score in ten_percent]
    return {
        "year": year,
        "grid": [round_float(beta) for beta in betas],
        "points": points,
        "bestBeta": round_float(best_beta),
        "withinTwoLogUnits": {"min": min(flat), "max": max(flat), "count": len(flat)},
        "tenPercentDelta": {
            "down": next(iter(deltas[0].values())),
            "up": next(iter(deltas[1].values())),
        },
        "identified": (max(flat) - min(flat)) < 0.05,
        "note": (
            "beta queda determinado con precisión condicionado al modelo de mezcla "
            "homogénea, a sigma, gamma y N fijos y a la rejilla de dispersión. Eso no "
            "corrige el mal ajuste ni la confusión estructural entre N y rho, y el "
            "objetivo no es suave porque k se elige en rejilla: la búsqueda es rejilla "
            "más refinamiento local, no una prueba de óptimo global."
        ),
    }


def build_preset(csv_text: str) -> dict[str, Any]:
    fits = [fit_year(csv_text, year) for year in YEARS]
    primary = fits[0]
    scenario = engine_configuration(0.0)  # solo para medir la red
    normalized = normalize_configuration(scenario)
    graph = generate_graph(normalized)
    weight = mean_daily_weight_per_node(graph, normalized.scenario.days)
    r0 = primary["parameters"]["r0"]
    beta_engine = r0 * GAMMA / weight
    if not 0.0 < beta_engine <= 1.0:
        raise SimulationError(f"beta del motor fuera de (0, 1]: {beta_engine}")
    configuration = engine_configuration(beta_engine)
    validation_beats_persistence = all(
        item["metrics"]["validation"]["mae"] < item["baselines"]["persistence"]["mae"]
        for item in fits
    )
    status = "fitted-not-validated" if not validation_beats_persistence else "fitted-and-validated"

    payload: dict[str, Any] = {
        "schemaVersion": "p06-dengue-preset-v1",
        "presetId": ENGINE_PRESET_ID,
        "status": status,
        "label": (
            "SEIR calibrado al dengue notificado de Manabí (2025); "
            "validación fuera de muestra desfavorable frente a persistencia"
        ),
        "generatedBy": "scripts/p06_calibrate.py",
        "dataset": {
            "datasetId": DATASET_ID,
            "csvPath": "data/p05/manabi-dengue-weekly.csv",
            "csvSha256": text_sha256(csv_text),
            "rows": sum(len(fit_item["series"]["observed"]) for fit_item in fits),
            "years": list(YEARS),
        },
        "model": {
            "form": MODEL_FORM,
            "stateVariables": ["S", "E", "I", "R"],
            "forceOfInfection": "beta * I / N",
            "observation": "negative-binomial",
            "observationMean": "rho * sum(sigma * E_d) over the 7 days of the week",
            "sigma": SIGMA,
            "gamma": GAMMA,
            "population": POPULATION,
            "dispersionGrid": list(DISPERSION_GRID),
        },
        "fits": fits,
        "identifiability": identifiability(csv_text, YEARS[0]),
        "engine": {
            "configuration": configuration,
            "meanDailyWeightPerNode": weight,
            "r0": round_float(r0),
            "betaApproximation": round_float(beta_engine),
            "bridgeCheck": bridge_check(configuration, primary["parameters"]["beta"]),
        },
        "limits": [
            "No es un modelo de dengue: es la forma del motor SEIR ajustada a una curva de casos.",
            "La serie observada es provincial, preliminar y sin granularidad de Manta.",
            "N y rho estan confundidos: solo se identifica rho·N; se fija N y se reporta rho|N.",
            "El preset del motor arranca con 3 infecciosos en 1 000 personas, no en el estado de la semana 1.",
            "El motor simula como maximo 180 dias; la ventana de ajuste de 2025 tiene 371 dias.",
            "Los efectos y costos educativos del simulador no se vuelven reales por calibrar una curva.",
            "El modo ficticio del simulador sigue siendo el predeterminado; este preset es optativo.",
            "La validación fuera de muestra pierde frente a persistencia en 2025 y 2026: el ajuste no predice la onda observada.",
            "beta y R0 se identifican solo de forma condicional al modelo; un parámetro preciso no corrige un modelo mal especificado.",
        ],
        "provenance": {
            "protocol": "specs/pro-roadmap.md#p-06--modelo-y-preset-calibrado-validación-fuera-de-muestra-pro-5",
            "fitCommand": "backend/.venv/bin/python scripts/p06_calibrate.py fit",
            "verifyCommand": "backend/.venv/bin/python scripts/p06_calibrate.py verify",
            "frontendCopy": "frontend/src/lib/dengue-preset.json",
        },
    }
    payload["hash"] = json_hash(payload)
    return payload


def frontend_copy(preset: dict[str, Any]) -> dict[str, Any]:
    """Subconjunto que el frontend necesita para cargar el preset."""

    return {
        "presetId": preset["presetId"],
        "schemaVersion": preset["schemaVersion"],
        "hash": preset["hash"],
        "status": preset["status"],
        "label": preset["label"],
        "dataset": {
            "datasetId": preset["dataset"]["datasetId"],
            "csvSha256": preset["dataset"]["csvSha256"],
            "years": preset["dataset"]["years"],
        },
        "parameters": {
            "beta": preset["fits"][0]["parameters"]["beta"],
            "reporting": preset["fits"][0]["parameters"]["reporting"],
            "r0": preset["fits"][0]["parameters"]["r0"],
            "dispersion": preset["fits"][0]["parameters"]["dispersion"],
            "logLikelihood": preset["fits"][0]["parameters"]["logLikelihood"],
            "fitWindow": preset["fits"][0]["window"],
        },
        "uncertainty": preset["fits"][0]["uncertainty"],
        "metrics": preset["fits"][0]["metrics"],
        "identifiability": {
            "identified": preset["identifiability"]["identified"],
            "withinTwoLogUnits": preset["identifiability"]["withinTwoLogUnits"],
            "tenPercentDelta": preset["identifiability"]["tenPercentDelta"],
            "note": preset["identifiability"]["note"],
        },
        "engine": preset["engine"],
        "limits": preset["limits"],
    }


def command_fit(args: argparse.Namespace) -> int:
    csv_text = read_text(args.csv)
    preset = build_preset(csv_text)
    write_text(args.output, json.dumps(preset, ensure_ascii=False, indent=1) + "\n")
    write_text(
        args.frontend,
        json.dumps(frontend_copy(preset), ensure_ascii=False, indent=1) + "\n",
    )
    summary = {
        "presetId": preset["presetId"],
        "hash": preset["hash"],
        "dataset": preset["dataset"]["csvSha256"],
        "fits": [
            {
                "year": item["year"],
                "window": [item["window"]["fitEnd"], item["window"]["validationEnd"]],
                "beta": item["parameters"]["beta"],
                "reporting": item["parameters"]["reporting"],
                "dispersion": item["parameters"]["dispersion"],
                "r0": item["parameters"]["r0"],
                "validationMae": item["metrics"]["validation"]["mae"],
                "persistenceMae": item["baselines"]["persistence"]["mae"],
                "meanMae": item["baselines"]["mean"]["mae"],
                "coverage95": item["metrics"]["validation"]["coverage95"],
            }
            for item in preset["fits"]
        ],
        "engine": {
            "beta": preset["engine"]["configuration"]["scenario"]["beta"],
            "r0": preset["engine"]["r0"],
            "meanDailyWeightPerNode": preset["engine"]["meanDailyWeightPerNode"],
            "bridge": preset["engine"]["bridgeCheck"],
        },
    }
    print(json.dumps(summary, ensure_ascii=False))
    return 0


def close(left: float, right: float) -> bool:
    return abs(left - right) <= max(TOLERANCE_ABSOLUTE, TOLERANCE_RELATIVE * abs(right))


def compare_metrics(stored: dict[str, Any], fresh: dict[str, Any], label: str) -> None:
    for key in ("mae", "rmse", "bias", "logScore", "coverage95"):
        if not close(float(stored[key]), float(fresh[key])):
            raise SimulationError(
                f"{label}: {key} publicado {stored[key]} y recalculado {fresh[key]}"
            )


def command_verify(args: argparse.Namespace) -> int:
    csv_text = read_text(args.csv)
    stored = json.loads(read_text(args.output))
    if stored.get("dataset", {}).get("csvSha256") != text_sha256(csv_text):
        raise SimulationError("el CSV de P-05 no coincide con el hash del preset")
    recomputed = build_preset(csv_text)

    if stored.get("hash") != recomputed["hash"]:
        raise SimulationError(
            f"hash del preset {stored.get('hash')} distinto del recalculado {recomputed['hash']}"
        )

    for stored_fit, fresh_fit in zip(stored["fits"], recomputed["fits"], strict=True):
        label = f"ajuste {stored_fit['year']}"
        for key in ("beta", "reporting", "dispersion", "r0", "logLikelihood"):
            if not close(float(stored_fit["parameters"][key]), float(fresh_fit["parameters"][key])):
                raise SimulationError(
                    f"{label}: {key} publicado {stored_fit['parameters'][key]} "
                    f"y recalculado {fresh_fit['parameters'][key]}"
                )
        for window in ("fit", "validation"):
            compare_metrics(
                stored_fit["metrics"][window], fresh_fit["metrics"][window], f"{label} {window}"
            )
        for baseline in ("persistence", "mean"):
            compare_metrics(
                stored_fit["baselines"][baseline],
                fresh_fit["baselines"][baseline],
                f"{label} referencia {baseline}",
            )
        for key in ("beta", "reporting", "r0", "dispersion"):
            for statistic in ("mean", "p05", "p50", "p95"):
                if not close(
                    float(stored_fit["uncertainty"][key][statistic]),
                    float(fresh_fit["uncertainty"][key][statistic]),
                ):
                    raise SimulationError(f"{label}: incertidumbre {key}.{statistic} no reproduce")

    expected_frontend = frontend_copy(recomputed)
    current_frontend = json.loads(read_text(args.frontend))
    if current_frontend != expected_frontend:
        raise SimulationError("la copia del frontend no coincide con el preset recalculado")

    print(
        json.dumps(
            {
                "status": "passed",
                "presetId": stored["presetId"],
                "hash": stored["hash"],
                "fits": [
                    {
                        "year": item["year"],
                        "beta": item["parameters"]["beta"],
                        "reporting": item["parameters"]["reporting"],
                        "r0": item["parameters"]["r0"],
                        "validationMae": item["metrics"]["validation"]["mae"],
                        "validationCoverage95": item["metrics"]["validation"]["coverage95"],
                    }
                    for item in stored["fits"]
                ],
                "engineBeta": stored["engine"]["configuration"]["scenario"]["beta"],
                "bridgeRatio": stored["engine"]["bridgeCheck"]["ratioMedian"],
                "bridgeExtinctions": stored["engine"]["bridgeCheck"]["extinctions"],
                "identifiabilityWindow": stored["identifiability"]["withinTwoLogUnits"],
            },
            ensure_ascii=False,
        )
    )
    return 0


def command_summary(args: argparse.Namespace) -> int:
    preset = json.loads(read_text(args.output))
    rows = []
    for item in preset["fits"]:
        rows.append(
            {
                "year": item["year"],
                "fit": f"S{item['window']['fitStart']}-S{item['window']['fitEnd']}",
                "validation": f"S{item['window']['validationStart']}-S{item['window']['validationEnd']}",
                "beta": item["parameters"]["beta"],
                "rho": item["parameters"]["reporting"],
                "r0": item["parameters"]["r0"],
                "fitMae": item["metrics"]["fit"]["mae"],
                "validationMae": item["metrics"]["validation"]["mae"],
                "persistenceMae": item["baselines"]["persistence"]["mae"],
                "coverage": item["metrics"]["validation"]["coverage95"],
            }
        )
    print(json.dumps({"presetId": preset["presetId"], "rows": rows}, ensure_ascii=False, indent=1))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    for name, handler, help_text in (
        ("fit", command_fit, "ajusta, valida y escribe el preset"),
        ("verify", command_verify, "recalcula todo y compara con lo publicado"),
        ("summary", command_summary, "resume el preset publicado"),
    ):
        sub = subparsers.add_parser(name, help=help_text)
        sub.add_argument("--csv", type=Path, default=CSV_PATH)
        sub.add_argument("--output", type=Path, default=PRESET_PATH)
        if name != "summary":
            sub.add_argument("--frontend", type=Path, default=FRONTEND_PRESET_PATH)
        sub.set_defaults(handler=handler)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command == "summary":
        args.frontend = FRONTEND_PRESET_PATH
    try:
        return int(args.handler(args))
    except SimulationError as error:
        print(f"P-06: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
