/** P-01 local API integration: receipts, spending, CSV and corrupted-stock rejection. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createApiClient } from '../frontend/src/lib/api.ts'
import { experimentFiles } from '../frontend/src/lib/export-experiment.ts'
const api = createApiClient('http://127.0.0.1:5174/v1')
const published = await api.config()
const output = resolve('.tools', `resource-validation-${new Date().toISOString().replaceAll(':','-')}`)
await mkdir(output,{recursive:true})
for (const budgetCents of [0,100000]) {
 const c=structuredClone(published.defaults)
 Object.assign(c,{rootSeed:314159265,repetitions:2})
 Object.assign(c.scenario,{populationSize:50,days:3,beta:0})
 Object.assign(c.intervention,{vaccines:1,interventionDay:0,vaccineEfficacy:0,combined:{
  modelVersion:'combined-educational-v1',budgetCents,vaccineCostCents:1000,closureCostCents:500,closureContext:'school',closureStart:0,closureDays:0,
  brigadeCostCents:100,brigadeDailyCapacity:2,brigadeReduction:0.3,brigadeStart:0,brigadeDays:3,
  resourceSchedule:{modelVersion:'daily-inventory-v1',vaccineDailyCapacity:2,initialBrigadeSupplies:0,deliveries:[{day:2,vaccines:2,brigadeSupplies:3},{day:2,vaccines:1,brigadeSupplies:1}]}
 }})
 const preview=await api.preview(c,undefined,published.limits)
 const result=await api.compareForPlayback(c,preview.graphHash,undefined,published.limits)
 for(const rep of result.replicates) for(const [policy,data] of Object.entries(rep.policies)) {
  assert.deepEqual(data.daily.map(r=>r.vaccinesDeliveredToday),[0,0,3,0])
  assert.equal(data.daily[1].brigadeSuppliesUsedToday,0)
  assert.ok(data.daily.every(r=>r.vaccinesAvailable>=0&&r.brigadeSuppliesAvailable>=0&&r.budgetRemainingCents>=0))
  if(policy==='none'||budgetCents===0) {assert.equal(data.daily.at(-1).vaccinesAvailable,4);assert.equal(data.daily.at(-1).spentCents,0)}
  else {assert.equal(data.metrics.vaccinesAssigned,4);assert.equal(data.daily.at(-1).spentCents,4200)}
 }
 assert.ok(experimentFiles(result)['inventory.csv'].includes('brigadeSuppliesAvailable'))
 const corrupt=structuredClone(result)
 corrupt.replicates[0].policies.random.daily[2].vaccinesAvailable++
 const fakeTransport=createApiClient('/v1',async()=>Response.json(corrupt))
 await assert.rejects(fakeTransport.compare(c,preview.graphHash,undefined,true),error=>error.code==='INVALID_RESPONSE')
 await writeFile(resolve(output,`budget-${budgetCents}.json`),JSON.stringify(result))
 console.log(JSON.stringify({budgetCents,hash:result.manifest.experimentHash,finalDoses:result.replicates[0].policies.targeted.daily.at(-1).vaccinesAvailable}))
}
console.log(`OUTPUT=${output}`)
