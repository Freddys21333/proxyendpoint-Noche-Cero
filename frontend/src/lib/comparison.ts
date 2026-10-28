import type { CompareResponse, CurveMetric } from './api.ts'

export const policyLabels = { none: 'Sin intervención', random: 'Aleatoria', targeted: 'Dirigida' }
export const metricLabels = { s: 'Sanos', e: 'Mordidos', i: 'Zombies', r: 'Exorcizados', cumulativeInfected: 'Infectados acumulados' }

export function pairedOutcome(mean: number): { magnitude: number; label: string } {
  return { magnitude: Math.abs(mean), label: mean === 0 ? 'sin diferencia media' : `contagios ${mean > 0 ? 'menos' : 'más'}, en promedio` }
}

export function comparisonRows(result: CompareResponse, metric: CurveMetric) {
  return result.aggregatedCurves.none.map((row, day) => ({ day: row.day,
    none: row[metric].mean!, random: result.aggregatedCurves.random[day][metric].mean!, targeted: result.aggregatedCurves.targeted[day][metric].mean!,
    noneRange: [row[metric].p05!, row[metric].p95!] as [number, number],
    randomRange: [result.aggregatedCurves.random[day][metric].p05!, result.aggregatedCurves.random[day][metric].p95!] as [number, number],
    targetedRange: [result.aggregatedCurves.targeted[day][metric].p05!, result.aggregatedCurves.targeted[day][metric].p95!] as [number, number],
  }))
}
