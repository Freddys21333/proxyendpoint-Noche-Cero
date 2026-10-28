"""Proyección explicativa para UI; las cifras y reglas viven en backend."""

import math
from collections import Counter
from typing import Any

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
    )
