"""Proyección explicativa para UI; las cifras y reglas viven en backend."""

import math
from collections import Counter
from typing import Any

from domain.models import Policy
from simulation.experiments import POLICIES, statistics

OMISSION_REASONS = (
    "closure_budget_exhausted",
    "closure_no_active_contacts",
    "no_infectious_hold_brigades",
    "vaccine_stock_empty",
    "vaccine_capacity_zero",
    "vaccine_budget_exhausted",
    "vaccine_no_eligible",
    "brigade_capacity_zero",
    "brigade_stock_empty",
    "brigade_budget_exhausted",
    "brigade_no_eligible",
)


def conclusion(best: list[Policy], rows: dict[Policy, dict[str, Any]], confidence: str) -> str:
    labels = {"none": "Sin intervención", "random": "Aleatoria", "targeted": "Dirigida"}

    def money(value: float) -> str:
        return f"USD {value / 100:.2f}".replace(".", ",")

    if len(best) != 1:
        text = "Hay empate en el promedio de contagios; no se elige una única estrategia."
        if rows[best[0]]["budgetCents"] is not None:
            lowest_spend = min(rows[policy]["spentMeanCents"] for policy in best)
            cheapest = [
                policy
                for policy in best
                if math.isclose(
                    rows[policy]["spentMeanCents"], lowest_spend, rel_tol=0, abs_tol=1e-9
                )
            ]
            cheaper = ", ".join(labels[policy] for policy in cheapest)
            verb = "registra" if len(cheapest) == 1 else "registran"
            text += f" Entre las opciones empatadas, {cheaper} {verb} el menor gasto directo: {money(lowest_spend)}, con un presupuesto de {money(rows[best[0]]['budgetCents'])}."
            text += " Gastar más no muestra un beneficio adicional en contagios medios. Son costos educativos y no incluyen el daño de los contagios ni AWS."
        else:
            text += " No se configuró presupuesto monetario para comparar costos y gastos."
        return text
    policy = best[0]
    row = rows[policy]
    parts = [f"{labels[policy]} obtuvo el menor promedio de contagios."]
    if confidence != "supported":
        parts.append(
            "La diferencia no es concluyente; la menor media no garantiza una ventaja consistente."
        )
    if row["budgetCents"] is None:
        return " ".join(
            parts
            + [
                "No se configuró presupuesto monetario; no se puede afirmar cuál opción es más económica."
            ]
        )
    parts.append(
        f"Con un presupuesto de {money(row['budgetCents'])}, su gasto medio fue {money(row['spentMeanCents'])} y dejó {money(row['remainingMeanCents'])} de saldo."
    )
    if row["avoidedVsNoneMean"] > 0:
        avoided = f"{row['avoidedVsNoneMean']:.3f}".rstrip("0").rstrip(".").replace(".", ",")
        parts.append(
            f"Evitó {avoided} contagios en promedio frente a no intervenir, a un costo de {money(row['costPerAvoidedCents'])} por contagio evitado."
        )
        competitors = [
            r for p, r in rows.items() if p != policy and r["costPerAvoidedCents"] is not None
        ]
        if not competitors or all(
            row["costPerAvoidedCents"] <= r["costPerAvoidedCents"] for r in competitors
        ):
            parts.append(
                "Entre las intervenciones con beneficio positivo, tiene el menor costo por contagio evitado (puede haber empate)."
            )
        else:
            parts.append(
                "Otra intervención tiene menor costo por contagio evitado: esta opción destaca por reducir contagios, no por ser la más barata por beneficio."
            )
        other: Policy = "random" if policy == "targeted" else "targeted"
        relation = (
            "igual"
            if math.isclose(row["spentMeanCents"], rows[other]["spentMeanCents"], abs_tol=1e-9)
            else "menor"
            if row["spentMeanCents"] < rows[other]["spentMeanCents"]
            else "mayor"
        )
        parts.append(f"Su gasto medio es {relation} que el de {labels[other]}.")
    else:
        parts.append(
            "No hay beneficio positivo frente a no intervenir para calcular costo por contagio evitado. El modelo no pone precio al daño de los contagios."
        )
    parts.append(
        "Son costos educativos, no precios sanitarios ni gastos AWS. La recomendación no es una optimización económica."
    )
    return " ".join(parts)


def summary_matches(actual: dict[str, Any], expected: dict[str, Any]) -> bool:
    """Los documentos v1 anteriores no contienen la conclusión aditiva."""
    if "conclusion" not in actual:
        expected = {key: value for key, value in expected.items() if key != "conclusion"}
    return actual == expected


def decision_summary(source: dict[str, Any]) -> dict[str, Any]:
    cfg = source["configuration"]
    reps = source["replicates"]
    if len(reps) != cfg["repetitions"] or len(reps) < 2:
        raise ValueError("El resumen requiere réplicas completas.")
    plan = cfg["intervention"].get("combined")
    schedule = plan.get("resourceSchedule") if plan else None
    received = cfg["intervention"]["vaccines"] + (
        sum(row["vaccines"] for row in schedule["deliveries"]) if schedule else 0
    )
    means = {
        policy: statistics(
            [rep["policies"][policy]["metrics"]["cumulativeInfected"] for rep in reps]
        )["mean"]
        for policy in POLICIES
    }
    baseline = means["none"]
    lowest = min(means.values())
    best = [p for p in POLICIES if math.isclose(means[p], lowest, rel_tol=0, abs_tol=1e-9)]
    nearest = None
    if len(best) == 1:
        next_mean = min(value for policy, value in means.items() if policy not in best)
        nearest = dict(
            policies=[
                p for p in POLICIES if math.isclose(means[p], next_mean, rel_tol=0, abs_tol=1e-9)
            ],
            gapMean=next_mean - lowest,
        )
    rows = {}
    for policy in POLICIES:
        results = [rep["policies"][policy] for rep in reps]
        avoided = baseline - means[policy]
        spent = (
            statistics([r["daily"][-1]["spentCents"] for r in results])["mean"] if plan else None
        )
        reasons: list[dict[str, Any]] | None = None
        observed = [
            row["adaptiveDecisions"]
            for r in results
            for row in r["daily"]
            if row.get("adaptiveDecisions", {}).get("enabled")
        ]
        if observed:
            counts = Counter(
                reason
                for row in observed
                for reason in set(row["triggers"])
                if reason in OMISSION_REASONS
            )
            reasons = [
                dict(reason=reason, replicateDays=counts[reason])
                for reason in OMISSION_REASONS
                if counts[reason]
            ]
        rows[policy] = dict(
            infectedMean=means[policy],
            infectedPopulationPercent=100 * means[policy] / cfg["scenario"]["populationSize"],
            avoidedVsNoneMean=avoided,
            reductionVsNonePercent=100 * avoided / baseline if baseline > 0 else None,
            vaccinesAssignedMean=statistics([r["metrics"]["vaccinesAssigned"] for r in results])[
                "mean"
            ],
            vaccinesReceived=received,
            budgetCents=plan["budgetCents"] if plan else None,
            spentMeanCents=spent,
            remainingMeanCents=plan["budgetCents"] - spent if plan else None,
            costPerAvoidedCents=spent / avoided if spent is not None and avoided > 0 else None,
            avoidedPer100Usd=avoided * 10000 / spent
            if avoided > 0 and spent is not None and spent > 0
            else None,
            omissionReasons=reasons,
        )
    return dict(
        modelVersion="decision-summary-v1",
        criterion="minimize-mean-cumulative-infected",
        confidence=source["recommendation"]["confidence"],
        bestPolicies=best,
        nearestAlternative=nearest,
        policies=rows,
        conclusion=conclusion(best, rows, source["recommendation"]["confidence"]),
    )
