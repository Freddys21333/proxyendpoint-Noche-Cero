/** Real local verification of the optional educational budget model. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createApiClient } from '../frontend/src/lib/api.ts'
import { experimentFiles } from '../frontend/src/lib/export-experiment.ts'

const api = createApiClient('http://127.0.0.1:5174/v1')
const config = await api.config()
const output = resolve('.tools', `combined-validation-${new Date().toISOString().replaceAll(':','-')}`)
await mkdir(output, { recursive: true })
for (const budgetCents of [0, 2500, 100000]) {
  const c = structuredClone(config.defaults)
  Object.assign(c, { rootSeed: 314159265, repetitions: 2 })
  Object.assign(c.scenario, { populationSize: 50, days: 3 })
  Object.assign(c.intervention, { vaccines: 3, vaccineEfficacy: 0.5, combined: {
    modelVersion: 'combined-educational-v1', budgetCents, vaccineCostCents: 1000,
    closureCostCents: 500, closureContext: 'school', closureStart: 0, closureDays: 2,
    brigadeCostCents: 100, brigadeDailyCapacity: 5, brigadeReduction: 0.3, brigadeStart: 0, brigadeDays: 2,
  } })
  const preview = await api.preview(c, undefined, config.limits)
  const result = await api.compareForPlayback(c, preview.graphHash, undefined, config.limits)
  for (const rep of result.replicates) for (const [policy, data] of Object.entries(rep.policies)) {
    for (const row of data.daily) {
      assert.ok(row.budgetRemainingCents >= 0 && row.spentCents <= budgetCents)
      assert.equal(row.spentCents + row.budgetRemainingCents, budgetCents)
      if (policy === 'none' || budgetCents === 0) assert.equal(row.spentCents, 0)
    }
  }
  assert.ok(experimentFiles(result)['budget.csv'].includes('budgetRemainingCents'))
  await writeFile(resolve(output, `budget-${budgetCents}.json`), JSON.stringify(result))
  console.log(JSON.stringify({ budgetCents, hash: result.manifest.experimentHash, finalTargetedBalance: result.replicates[0].policies.targeted.daily.at(-1).budgetRemainingCents }))
}
console.log(`OUTPUT=${output}`)
