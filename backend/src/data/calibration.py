"""P-06: calibración de un SEIR de mezcla homogénea al dengue notificado de Manabí.

Este módulo contiene solo lógica pura y determinista: lectura de la serie
normalizada de P-05, simulación semanal, función de observación binomial
negativa, verosimilitud, ajuste por rejilla y búsqueda de patrón, perfil de
verosimilitud, bootstrap paramétrico y métricas de ajuste y validación.

Supuestos declarados en `specs/pro-roadmap.md` antes de mirar resultados:

- La variable observada es el caso **notificado** por semana epidemiológica.
- El modelo es un SEIR de mezcla homogénea con ``λ = β·I/N`` y pasos diarios.
- ``σ`` y ``γ`` son los valores por defecto del motor (3 y 7 días medios), no
  duraciones «de dengue» tomadas de una ficha.
- La notificación sigue al inicio de síntomas, aproximado por la transición
  E→I, con fracción ``ρ``.
- ``N`` y ``ρ`` están exactamente confundidos: se fija ``N`` (población
  implícita de la tabla de tasas de 2025) y se reporta ``ρ`` dado ese ``N``.
- La semana 1 solo condiciona el estado inicial; la verosimilitud empieza en
  la semana 2.
"""

from __future__ import annotations

import hashlib
import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from numpy.random import PCG64, Generator, SeedSequence

from data.dengue import DengueImportError, parse_csv, validate_rows

SIGMA = 0.333333
GAMMA = 0.142857
POPULATION = 1_661_447
FIT_NUMERATOR = 2
FIT_DENOMINATOR = 3
DISPERSION_GRID = (2.0, 5.0, 10.0, 25.0, 50.0, 100.0)
BOOTSTRAP_REPLICATES = 120
BOOTSTRAP_SEED = 20_261_027
ENGINE_PRESET_ID = "manabi-dengue-2025-v1"
BETA_GRID = tuple(10 ** (-1.7 + 1.7 * index / 47) for index in range(48))  # 0.02 .. 1.0
REPORTING_GRID = tuple(10 ** (-3 + 3 * index / 39) for index in range(40))  # 1e-3 .. 1.0
MIN_WEEKS = 6


class SimulationError(ValueError):
    """El modelo, los datos o las ventanas no permiten un ajuste defendible."""


@dataclass(frozen=True, slots=True)
class WeeklyCases:
    """Observación semanal normalizada."""

    year: int
    week: int
    cases: int


@dataclass(frozen=True, slots=True)
class Window:
    """Ventanas de ajuste y validación fijadas antes de ajustar."""

    fit_start: int
    fit_end: int
    validation_start: int
    validation_end: int


@dataclass(frozen=True, slots=True)
class Model:
    """Parámetros del SEIR de mezcla homogénea y de la observación."""

    beta: float
    reporting: float
    sigma: float = SIGMA
    gamma: float = GAMMA
    population: int = POPULATION


@dataclass(frozen=True, slots=True)
class Fit:
    """Resultado de un ajuste por máxima verosimilitud."""

    beta: float
    reporting: float
    dispersion: float
    loglik: float
    r0: float
    evaluations: int


@dataclass(frozen=True, slots=True)
class Metrics:
    """Métricas de ajuste o de predicción sobre una ventana."""

    mae: float
    rmse: float
    bias: float
    log_score: float
    coverage95: float


def split_window(weeks: int) -> Window:
    """Regla de dos tercios por número de semanas disponibles.

    Se declara antes de ajustar y no depende de la forma de la curva: las
    primeras ``floor(2n/3)`` semanas se ajustan y el resto se retiene.
    """

    if type(weeks) is not int or weeks < MIN_WEEKS:
        raise SimulationError(f"se necesitan al menos {MIN_WEEKS} semanas; recibidas {weeks}")
    fit_end = FIT_NUMERATOR * weeks // FIT_DENOMINATOR
    if fit_end < 4 or weeks - fit_end < 2:
        raise SimulationError(f"ventanas insuficientes para {weeks} semanas")
    return Window(
        fit_start=1,
        fit_end=fit_end,
        validation_start=fit_end + 1,
        validation_end=weeks,
    )


def load_series(csv_text: str, year: int) -> list[WeeklyCases]:
    """Lee el CSV normalizado de P-05 y devuelve un año completo y ordenado."""

    try:
        rows = parse_csv(csv_text)
        validate_rows(rows)
    except DengueImportError as error:  # pragma: no cover - se reetiqueta
        raise SimulationError(f"serie normalizada inválida: {error}") from error
    selected = [WeeklyCases(year=row.year, week=row.week, cases=row.cases) for row in rows]
    selected = [row for row in selected if row.year == year]
    if not selected:
        raise SimulationError(f"el dataset no contiene el año {year}")
    expected = list(range(1, len(selected) + 1))
    if [row.week for row in selected] != expected:
        raise SimulationError(f"el año {year} no cubre semanas consecutivas desde 1")
    return selected


def _validate_model(model: Model) -> None:
    if not 0.0 < model.beta <= 1.0:
        raise SimulationError(f"beta fuera de (0, 1]: {model.beta}")
    if not 0.0 < model.reporting <= 1.0:
        raise SimulationError(f"reporting fuera de (0, 1]: {model.reporting}")
    for name, rate in (("sigma", model.sigma), ("gamma", model.gamma)):
        if not 0.0 < rate < 1.0:
            raise SimulationError(f"{name} fuera de (0, 1): {rate}")
    if type(model.population) is not int or model.population <= 0:
        raise SimulationError("la población debe ser un entero positivo")


def _initial_state(model: Model, first_week_cases: float) -> tuple[float, float]:
    """Estado casi estacionario de la semana 1 a partir del dato observado.

    Se exige equilibrio entre entradas y salidas: ``σ·E₀ = β·I₀`` y
    ``ρ·7·σ·E₀ = y₁``. Así la primera semana es coherente con la dinámica del
    modelo y solo condiciona; no entra en la verosimilitud.
    """

    if first_week_cases <= 0:
        raise SimulationError("la primera semana necesita casos positivos para condicionar")
    onsets_per_day = first_week_cases / (7.0 * model.reporting)
    exposed = onsets_per_day / model.sigma
    infectious = model.sigma * exposed / model.beta
    if exposed + infectious >= 0.5 * model.population:
        raise SimulationError(
            "la condición inicial supera media población: reporting demasiado pequeño"
        )
    return exposed, infectious


def simulate(model: Model, weeks: int, first_week_cases: float) -> list[float]:
    """Casos notificados esperados por semana; la semana 1 solo condiciona."""

    _validate_model(model)
    if type(weeks) is not int or weeks <= 0:
        raise SimulationError(f"semanas inválidas: {weeks}")
    population = float(model.population)
    exposed, infectious = _initial_state(model, first_week_cases)
    susceptible = population - exposed - infectious
    weekly: list[float] = []
    for _week in range(weeks):
        total = 0.0
        for _day in range(7):
            force = model.beta * infectious / population
            new_infections = force * susceptible
            onsets = model.sigma * exposed
            exits = model.gamma * infectious
            susceptible = max(0.0, susceptible - new_infections)
            exposed = max(0.0, exposed + new_infections - onsets)
            infectious = max(0.0, infectious + onsets - exits)
            total += onsets * model.reporting
        weekly.append(total)
    return weekly


def negative_binomial_logpmf(cases: int, mean: float, dispersion: float) -> float:
    """Log-verosimilitud de una binomial negativa con media y dispersión dadas."""

    if dispersion <= 0.0:
        raise SimulationError("la dispersión debe ser positiva")
    if mean <= 0.0:
        return -math.inf
    if cases < 0:
        raise SimulationError("los casos no pueden ser negativos")
    return (
        math.lgamma(cases + dispersion)
        - math.lgamma(dispersion)
        - math.lgamma(cases + 1)
        + dispersion * math.log(dispersion / (dispersion + mean))
        + cases * math.log(mean / (dispersion + mean))
    )


def _check_pair(observed: Sequence[int], predicted: Sequence[float]) -> None:
    if not observed or len(observed) != len(predicted):
        raise SimulationError(
            f"series incompatibles: {len(observed)} observadas y {len(predicted)} predichas"
        )
    if any(cases < 0 for cases in observed):
        raise SimulationError("la serie observada tiene casos negativos")


def log_likelihood(observed: Sequence[int], predicted: Sequence[float], dispersion: float) -> float:
    """Suma de log-verosimilitudes binomiales negativas."""

    _check_pair(observed, predicted)
    return sum(
        negative_binomial_logpmf(cases, mean, dispersion)
        for cases, mean in zip(observed, predicted, strict=True)
    )


def best_dispersion(observed: Sequence[int], predicted: Sequence[float]) -> tuple[float, float]:
    """Dispersión de la rejilla declarada con mayor verosimilitud."""

    scores = [
        (log_likelihood(observed, predicted, dispersion), dispersion)
        for dispersion in DISPERSION_GRID
    ]
    score, dispersion = max(scores)
    return dispersion, score


def predictive_interval(mean: float, dispersion: float, level: float = 0.95) -> tuple[int, int]:
    """Intervalo predictivo de la binomial negativa por suma de la CDF."""

    if not 0.0 < level < 1.0:
        raise SimulationError("el nivel del intervalo debe estar en (0, 1)")
    if mean <= 0.0 or dispersion <= 0.0:
        raise SimulationError("media y dispersión deben ser positivas")
    tail = (1.0 - level) / 2.0
    cumulative = 0.0
    low: int | None = None
    high: int | None = None
    for cases in range(0, 1_000_000):
        cumulative += math.exp(negative_binomial_logpmf(cases, mean, dispersion))
        if low is None and cumulative >= tail:
            low = cases
        if cumulative >= 1.0 - tail:
            high = cases
            break
    if low is None or high is None:  # pragma: no cover - defensivo
        raise SimulationError("no se pudo construir el intervalo predictivo")
    return low, high


def evaluate(observed: Sequence[int], predicted: Sequence[float], dispersion: float) -> Metrics:
    """Error absoluto, error cuadrático, sesgo, log-score y cobertura."""

    _check_pair(observed, predicted)
    errors = [mean - cases for cases, mean in zip(observed, predicted, strict=True)]
    covered = 0
    for cases, mean in zip(observed, predicted, strict=True):
        low, high = predictive_interval(mean, dispersion)
        covered += int(low <= cases <= high)
    return Metrics(
        mae=sum(abs(error) for error in errors) / len(errors),
        rmse=math.sqrt(sum(error * error for error in errors) / len(errors)),
        bias=sum(errors) / len(errors),
        log_score=log_likelihood(observed, predicted, dispersion) / len(observed),
        coverage95=covered / len(observed),
    )


def persistence_baseline(fit_weeks: Sequence[int], validation: Sequence[int]) -> list[float]:
    """Referencia trivial: repetir el último valor de la ventana de ajuste."""

    if not fit_weeks or not validation:
        raise SimulationError("las referencias necesitan ambas ventanas")
    return [float(fit_weeks[-1])] * len(validation)


def mean_baseline(fit_weeks: Sequence[int], validation: Sequence[int]) -> list[float]:
    """Referencia trivial: la media de la ventana de ajuste."""

    if not fit_weeks or not validation:
        raise SimulationError("las referencias necesitan ambas ventanas")
    mean = sum(fit_weeks) / len(fit_weeks)
    return [mean] * len(validation)


def _predict_until(model: Model, weeks: int, first_week_cases: float, stop: int) -> list[float]:
    return simulate(model, weeks=weeks, first_week_cases=first_week_cases)[1:stop]


def _objective(
    beta: float, reporting: float, observed: Sequence[int], weeks: int, first: float
) -> tuple[float, float]:
    """Devuelve (loglik, dispersión) para un par (beta, reporting)."""

    try:
        model = Model(beta=beta, reporting=reporting)
        predicted = _predict_until(model, weeks, first, len(observed) + 1)
    except SimulationError:
        return -math.inf, DISPERSION_GRID[0]
    dispersion, score = best_dispersion(observed, predicted)
    return score, dispersion


def _pattern_search(
    start_beta: float,
    start_reporting: float,
    observed: Sequence[int],
    weeks: int,
    first: float,
    *,
    max_steps: int = 60,
) -> tuple[float, float, float, float, int]:
    """Búsqueda de patrón multiplicativa; determinista y sin aleatoriedad."""

    beta, reporting = start_beta, start_reporting
    best, dispersion = _objective(beta, reporting, observed, weeks, first)
    evaluations = 1
    step = 0.5
    while step > 1e-5 and evaluations < max_steps:
        improved = False
        for candidate_beta, candidate_reporting in (
            (beta * (1.0 + step), reporting),
            (beta * (1.0 - step), reporting),
            (beta, reporting * (1.0 + step)),
            (beta, reporting * (1.0 - step)),
        ):
            if not (0.0 < candidate_beta <= 1.0 and 0.0 < candidate_reporting <= 1.0):
                continue
            score, candidate_dispersion = _objective(
                candidate_beta, candidate_reporting, observed, weeks, first
            )
            evaluations += 1
            if score > best:
                beta, reporting, best, dispersion = (
                    candidate_beta,
                    candidate_reporting,
                    score,
                    candidate_dispersion,
                )
                improved = True
        if not improved:
            step *= 0.5
    return beta, reporting, dispersion, best, evaluations


def fit(observed: Sequence[int], weeks: int) -> Fit:
    """Ajusta (beta, reporting) por rejilla gruesa y refinamiento local."""

    if len(observed) < 3:
        raise SimulationError("se necesitan al menos tres semanas en la ventana de ajuste")
    if any(cases < 0 for cases in observed):
        raise SimulationError("la serie de ajuste tiene casos negativos")
    if type(weeks) is not int or weeks <= len(observed):
        raise SimulationError("la ventana total debe cubrir la serie de ajuste y la retenida")
    first = float(observed[0])
    best_score = -math.inf
    best_pair = (BETA_GRID[0], REPORTING_GRID[0])
    evaluations = 0
    for beta in BETA_GRID:
        for reporting in REPORTING_GRID:
            score, _ = _objective(beta, reporting, observed, weeks, first)
            evaluations += 1
            if score > best_score:
                best_score, best_pair = score, (beta, reporting)
    beta, reporting, dispersion, score, refine = _pattern_search(
        best_pair[0], best_pair[1], observed, weeks, first
    )
    if not math.isfinite(score):
        raise SimulationError("ningún par de parámetros produce una verosimilitud finita")
    return Fit(
        beta=beta,
        reporting=reporting,
        dispersion=dispersion,
        loglik=score,
        r0=beta / GAMMA,
        evaluations=evaluations + refine,
    )


def _refine_reporting(
    beta: float,
    start: float,
    observed: Sequence[int],
    weeks: int,
    first: float,
    *,
    max_steps: int = 80,
) -> tuple[float, float]:
    """Refina solo ``reporting`` con ``beta`` fijo (perfil de verosimilitud).

    No se reutiliza ``_pattern_search`` porque mueve ``beta`` y ``reporting`` a la
    vez: eso devolvería el óptimo global etiquetado con otro ``beta`` y el perfil
    sería engañoso.
    """

    reporting = start
    best, _ = _objective(beta, reporting, observed, weeks, first)
    steps = 0
    step = 0.25
    while step > 1e-6 and steps < max_steps:
        improved = False
        for candidate in (reporting * (1.0 + step), reporting * (1.0 - step)):
            if not 0.0 < candidate <= 1.0:
                continue
            score, _ = _objective(beta, candidate, observed, weeks, first)
            steps += 1
            if score > best:
                reporting, best, improved = candidate, score, True
        if not improved:
            step *= 0.5
    return reporting, best


def profile_beta(
    observed: Sequence[int], weeks: int, betas: Sequence[float]
) -> list[tuple[float, float]]:
    """Perfil de verosimilitud en beta, reoptimizando **solo** reporting."""

    if not betas:
        raise SimulationError("el perfil necesita al menos un valor de beta")
    first = float(observed[0])
    profile: list[tuple[float, float]] = []
    for beta in betas:
        if not 0.0 < beta <= 1.0:
            raise SimulationError(f"beta fuera de (0, 1]: {beta}")
        best_reporting, best_score = REPORTING_GRID[0], -math.inf
        for reporting in REPORTING_GRID:
            score, _ = _objective(beta, reporting, observed, weeks, first)
            if score > best_score:
                best_score, best_reporting = score, reporting
        _, refined = _refine_reporting(beta, best_reporting, observed, weeks, first)
        profile.append((beta, max(best_score, refined)))
    return profile


def _generator(seed: int, index: int) -> Generator:
    """Flujo binomial negativo independiente por réplica.

    No se reutiliza ``rng-v1`` porque su conjunto de dominios está congelado y
    fuerza ``replicate_index = 0`` para el dominio ``bootstrap``; derivar aquí
    el entropía de ``(semilla, índice)`` mantiene la reproducibilidad sin tocar
    el contrato congelado del motor.
    """

    if type(seed) is not int or seed < 0 or type(index) is not int or index < 0:
        raise SimulationError("semilla e índice deben ser enteros no negativos")
    digest = hashlib.sha256(f"p06-bootstrap:{seed}:{index}".encode()).digest()
    return Generator(PCG64(SeedSequence(int.from_bytes(digest[:16], "big"))))


def sample_observations(
    predicted: Sequence[float], dispersion: float, *, seed: int, index: int = 0
) -> list[int]:
    """Muestra observaciones binomiales negativas con la media del modelo."""

    if dispersion <= 0.0:
        raise SimulationError("la dispersión debe ser positiva")
    if not predicted or any(mean <= 0.0 for mean in predicted):
        raise SimulationError("las medias predichas deben ser positivas")
    generator = _generator(seed, index)
    probability = [dispersion / (dispersion + mean) for mean in predicted]
    return [int(generator.negative_binomial(dispersion, item)) for item in probability]


def bootstrap(
    observed: Sequence[int],
    weeks: int,
    *,
    replicates: int = BOOTSTRAP_REPLICATES,
    seed: int = BOOTSTRAP_SEED,
) -> list[Fit]:
    """Bootstrap paramétrico determinista alrededor del ajuste puntual."""

    if type(replicates) is not int or replicates <= 0:
        raise SimulationError("el bootstrap necesita réplicas positivas")
    point = fit(observed, weeks)
    first = float(observed[0])
    predicted = _predict_until(
        Model(beta=point.beta, reporting=point.reporting), weeks, first, len(observed) + 1
    )
    results: list[Fit] = []
    for index in range(replicates):
        sample = sample_observations(predicted, point.dispersion, seed=seed, index=index)
        beta, reporting, dispersion, score, evaluations = _pattern_search(
            point.beta, point.reporting, sample, weeks, first
        )
        results.append(
            Fit(
                beta=beta,
                reporting=reporting,
                dispersion=dispersion,
                loglik=score,
                r0=beta / GAMMA,
                evaluations=evaluations,
            )
        )
    return results


def percentile(values: Sequence[float], probability: float) -> float:
    """Percentil por interpolación lineal sobre valores ordenados."""

    if not values:
        raise SimulationError("no hay valores para el percentil")
    if not 0.0 <= probability <= 1.0:
        raise SimulationError("la probabilidad debe estar en [0, 1]")
    ordered = sorted(values)
    position = probability * (len(ordered) - 1)
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return float(ordered[lower])
    weight = position - lower
    return ordered[lower] * (1.0 - weight) + ordered[upper] * weight


def summarise(samples: Sequence[float]) -> dict[str, Any]:
    """Resumen percentil de una muestra bootstrap."""

    return {
        "mean": sum(samples) / len(samples),
        "p05": percentile(samples, 0.05),
        "p50": percentile(samples, 0.5),
        "p95": percentile(samples, 0.95),
    }
