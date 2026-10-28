import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
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

test('report includes adaptive strategy details when configured and supports autoPrint option', () => {
  const result = fixture()
  result.configuration.intervention.combined = {
    modelVersion: 'combined-educational-v1', budgetCents: 15000, vaccineCostCents: 100,
    closureCostCents: 50, closureContext: 'school', closureStart: 0, closureDays: 1,
    brigadeCostCents: 25, brigadeDailyCapacity: 2, brigadeReduction: 0.3, brigadeStart: 0, brigadeDays: 1,
    adaptiveStrategy: {
      modelVersion: 'adaptive-policy-v1',
      closureInfectionThreshold: 0.15,
      reopenInfectionThreshold: 0.05,
      ringVaccinationPriority: true,
      enabled: true,
    },
  }
  const html = buildMayorReportHtml(result, { autoPrint: true })
  assert.match(html, /Variante adaptativa evaluada/i)
  assert.match(html, /adaptive-policy-v1/)
  assert.match(html, /15\.0%/)
  assert.match(html, /5\.0%/)
  assert.match(html, /Prioridad de anillo.*Habilitada/)
  assert.match(html, /window\.print\(\)/)
  assert.match(html, /@page/)
})

test('CLI script exports deterministic HTML and PDF reports from valid experiment JSON', () => {
  const scriptPath = resolve('../scripts/export_mayor_report_pdf.mjs')
  const fixturePath = resolve('../schemas/examples/compare-response-vaccines.json')
  const outputHtml = resolve(tmpdir(), `test-mayor-report-${Date.now()}.html`)
  const outputPdf = resolve(tmpdir(), `test-mayor-report-${Date.now()}.pdf`)

  // Probar exportación HTML
  const resHtml = spawnSync('node', ['--experimental-strip-types', scriptPath, fixturePath, '--output', outputHtml, '--html-only'], { encoding: 'utf8' })
  assert.equal(resHtml.status, 0, resHtml.stderr)
  assert.ok(existsSync(outputHtml))
  const htmlContent = readFileSync(outputHtml, 'utf8')
  assert.match(htmlContent, /ESCENARIO FICTICIO/)
  assert.match(htmlContent, /sha256:eee/)
  unlinkSync(outputHtml)

  // Probar exportación PDF si Chromium está disponible
  const resPdf = spawnSync('node', ['--experimental-strip-types', scriptPath, fixturePath, '--output', outputPdf], { encoding: 'utf8' })
  assert.equal(resPdf.status, 0, resPdf.stderr)
  if (existsSync(outputPdf)) {
    const pdfBuf = readFileSync(outputPdf)
    assert.ok(pdfBuf.length > 1000)
    assert.equal(pdfBuf.subarray(0, 5).toString('ascii'), '%PDF-')
    unlinkSync(outputPdf)
  }
})
