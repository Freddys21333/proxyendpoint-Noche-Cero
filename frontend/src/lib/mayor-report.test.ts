import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import type { CompareResponse } from './api.ts'
import { buildMayorReportHtml } from './mayor-report.ts'

const fixture = (): CompareResponse => JSON.parse(readFileSync(new URL('../../../schemas/examples/compare-response-vaccines.json', import.meta.url), 'utf8'))

test('mayor report labels the synthetic scenario, preserves uncertainty and cites its experiment hash', () => {
  const result = fixture()
  const html = buildMayorReportHtml(result)
  assert.match(html, /escenario ficticio/i)
  assert.match(html, /población sintética/i)
  assert.ok(html.includes(result.manifest.experimentHash))
  assert.match(html, /P05–P95/)
  assert.match(html, /empates|diferencias pareadas|incertidumbre/i)
  assert.match(html, /no representa dengue real/i)
})

test('mayor report keeps losses and escapes configured text for a standalone HTML file', () => {
  const result = fixture()
  result.pairedComparisons.gainVsRandom.values[0] = -3
  result.pairedComparisons.gainVsRandom.mean = -1.5
  result.pairedComparisons.gainVsRandom.p05 = -3
  result.recommendation.limitations = ['<script>alert("x")</script>']
  const html = buildMayorReportHtml(result)
  assert.match(html, /-3/)
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(!html.includes('<script>alert'))
  assert.deepEqual(Buffer.from(buildMayorReportHtml(fixture())), Buffer.from(buildMayorReportHtml(fixture())))
})

test('report explains the shared educational budget without calling it AWS or real spending', () => {
  const result = fixture()
  result.configuration.intervention.combined = {
    modelVersion: 'combined-educational-v1', budgetCents: 12000, vaccineCostCents: 100,
    closureCostCents: 50, closureContext: 'school', closureStart: 0, closureDays: 1,
    brigadeCostCents: 25, brigadeDailyCapacity: 2, brigadeReduction: 0.3, brigadeStart: 0, brigadeDays: 1,
  }
  const html = buildMayorReportHtml(result)
  assert.match(html, /presupuesto máximo educativo/i)
  assert.match(html, /no es el gasto operativo real/i)
  assert.match(html, /Sin intervención/)
  assert.match(html, /Aleatoria/)
  assert.match(html, /Dirigida/)
})
