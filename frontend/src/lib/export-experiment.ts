import { strToU8, zipSync } from 'fflate'
import type { CompareResponse } from './api.ts'

const policies = ['none', 'random', 'targeted'] as const
const metrics = ['cumulativeInfected', 'peakInfectious', 'peakDay', 'finalInfectious', 'outbreakDuration', 'vaccinesAssigned', 'vaccinesEffective', 'vaccinesUnused'] as const
const selections = ['day', 'nodeId', 'score', 'rank', 'stateAtDecision', 'contexts', 'tieBreak', 'effective']
const events = ['day', 'nodeId', 'from', 'to', 'cause', 'sourceNodeId', 'edgeId']

export function csvTable(fields: readonly string[], rows: unknown[]): string {
  const cell = (value: unknown) => {
    const text = value == null ? '' : typeof value === 'object' || typeof value === 'boolean' ? JSON.stringify(value) : String(value)
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return [fields.join(','), ...rows.map(row => {
    if (typeof row !== 'object' || row === null) throw new Error('Fila de exportación inválida.')
    return fields.map(field => cell((row as Record<string, unknown>)[field])).join(',')
  })].join('\r\n') + '\r\n'
}

export function experimentFiles(result: CompareResponse): Record<string, string> {
  const files: Record<string, string> = {
    'configuration.json': JSON.stringify(result.configuration),
    'manifest.json': JSON.stringify({ ...result.manifest, exportMetadata: { exportedEventsScope: 'representative' } }),
    'comparison-summary.json': JSON.stringify(result.pairedComparisons),
  }
  const table = (name: string, fields: readonly string[], rows: unknown[]) => { files[`${name}.csv`] = csvTable(fields, rows) }
  table('nodes', ['id', 'role', 'householdId', 'neighborhoodId', 'schoolId', 'busId', 'marketId'], result.graph.nodes)
  table('edges', ['id', 'u', 'v', 'context', 'weight', 'activeDays'], result.graph.edges)
  const tables: Record<'daily' | 'metrics' | 'selections' | 'events', unknown[]> = { daily: [], metrics: [], selections: [], events: [] }
  for (const rep of [...result.replicates].sort((a, b) => a.index - b.index)) {
    for (const policy of policies) {
      const output = rep.policies[policy]
      if (rep.index !== result.representative.index && output.events !== null) throw new Error('Los eventos exportados deben pertenecer solo a la réplica representativa.')
      for (const name of ['daily', 'metrics', 'selections', 'events'] as const) {
        const rows = name === 'metrics' ? [output.metrics] : output[name] ?? []
        for (const row of rows) {
          if (typeof row !== 'object' || row === null) throw new Error('Registro de experimento inválido.')
          tables[name].push({ ...row, replicateIndex: rep.index, policy })
        }
      }
    }
  }
  table('daily', ['replicateIndex', 'policy', 'day', 's', 'e', 'i', 'r', 'cumulativeInfected'], tables.daily)
  if (result.configuration.intervention.combined) table('budget', ['replicateIndex', 'policy', 'day', 'spentTodayCents', 'spentCents', 'budgetRemainingCents', 'closedContext', 'brigadesActive', 'brigadeNodeIds'], tables.daily)
  table('metrics', ['replicateIndex', 'policy', ...metrics], tables.metrics)
  table('selections', ['replicateIndex', 'policy', ...selections], tables.selections)
  table('events', ['replicateIndex', 'policy', ...events], tables.events)
  table('summary', ['policy', 'metric', 'n', 'mean', 'median', 'p05', 'p95'], policies.flatMap(policy => metrics.map(metric => ({ policy, metric, ...result.summaryByPolicy[policy][metric] }))))
  const paired = result.pairedComparisons
  table('comparisons', ['comparison', 'replicateIndex', 'value'], [
    ['savedVsNone.random', paired.savedVsNone.random], ['savedVsNone.targeted', paired.savedVsNone.targeted], ['gainVsRandom', paired.gainVsRandom],
  ].flatMap(([name, comparison]) => (comparison as typeof paired.gainVsRandom).values.map((value, replicateIndex) => ({ comparison: name, replicateIndex, value }))))
  return files
}

export function experimentZip(result: CompareResponse): Uint8Array<ArrayBuffer> {
  const files = Object.fromEntries(Object.entries(experimentFiles(result)).map(([name, text]) => [name, strToU8(text)]))
  return zipSync(files, { level: 6, mtime: new Date(1980, 0, 1) })
}
