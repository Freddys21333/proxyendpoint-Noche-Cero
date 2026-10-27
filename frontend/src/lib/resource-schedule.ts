import type { CombinedPlan, ResourceSchedule } from './api.ts'

export function normalizeResourceSchedule(schedule: ResourceSchedule): ResourceSchedule {
  const days = new Map<number, { day: number; vaccines: number; brigadeSupplies: number }>()
  for (const row of schedule.deliveries) {
    const current = days.get(row.day) ?? { day: row.day, vaccines: 0, brigadeSupplies: 0 }
    days.set(row.day, { day: row.day, vaccines: current.vaccines + row.vaccines, brigadeSupplies: current.brigadeSupplies + row.brigadeSupplies })
  }
  return { modelVersion: schedule.modelVersion, vaccineDailyCapacity: schedule.vaccineDailyCapacity,
    initialBrigadeSupplies: schedule.initialBrigadeSupplies, deliveries: [...days.values()].sort((a, b) => a.day - b.day) }
}

export function normalizedCombinedPlan(plan: CombinedPlan): CombinedPlan {
  return { ...plan, ...(plan.resourceSchedule ? { resourceSchedule: normalizeResourceSchedule(plan.resourceSchedule) } : {}),
    ...(plan.adaptiveStrategy ? { adaptiveStrategy: { modelVersion: plan.adaptiveStrategy.modelVersion,
      closureInfectionThreshold: plan.adaptiveStrategy.closureInfectionThreshold, reopenInfectionThreshold: plan.adaptiveStrategy.reopenInfectionThreshold,
      ringVaccinationPriority: plan.adaptiveStrategy.ringVaccinationPriority, enabled: plan.adaptiveStrategy.enabled ?? true } } : {}) }
}

export function sameCombinedPlan(a: CombinedPlan, b: CombinedPlan): boolean {
  const left = normalizedCombinedPlan(a), right = normalizedCombinedPlan(b)
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].every(key => key === 'resourceSchedule' || key === 'adaptiveStrategy'
    ? JSON.stringify(left[key]) === JSON.stringify(right[key])
    : left[key as keyof CombinedPlan] === right[key as keyof CombinedPlan])
}
