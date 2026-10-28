import type { CombinedPlan } from '@/lib/api'
import { AdaptiveStrategyEditor } from './AdaptiveStrategyEditor'
import { useId } from 'react'
import { ResourceScheduleEditor } from './ResourceScheduleEditor'

export function CombinedInterventions({ value, onChange, days, population }: {
  value?: CombinedPlan; onChange: (value: CombinedPlan | undefined) => void; days: number; population: number;
}) {
  const helpId = useId()
  const defaults = (): CombinedPlan => ({ modelVersion: 'combined-educational-v1', budgetCents: 200000,
    vaccineCostCents: 1000, closureCostCents: 10000, closureContext: 'school', closureStart: 0,
    closureDays: Math.min(days, 7), brigadeCostCents: 200, brigadeDailyCapacity: Math.min(population, 10),
    brigadeReduction: 0.3, brigadeStart: 0, brigadeDays: Math.min(days, 7) })
  const number = (label: string, key: keyof CombinedPlan, max: number, money = false, percent = false) => <label className="field" key={key}>
    <span>{label}</span><div className="input-wrap"><input type="number" name={String(key)} autoComplete="off" inputMode={money || percent ? 'decimal' : 'numeric'} min={money && key !== 'budgetCents' ? 0.01 : 0} max={max} step={money ? 0.01 : 1}
      value={Number.isNaN(value![key]) ? '' : Number(value![key]) / (money ? 100 : percent ? 0.01 : 1)}
      onChange={event => onChange({ ...value!, [key]: event.target.value === '' ? NaN : money ? Math.round(Number(event.target.value) * 100) : Number(event.target.value) * (percent ? 0.01 : 1) })} /></div></label>
  return <section className="combined-settings" aria-label="Intervenciones combinadas y presupuesto">
    <label className="combined-toggle"><input type="checkbox" aria-describedby={helpId} checked={Boolean(value)} onChange={event => onChange(event.target.checked ? defaults() : undefined)} />Combinar intervenciones con presupuesto</label>
    <p id={helpId} className="combined-toggle-help">Añade cierres y brigadas al plan con un presupuesto común.</p>
    {value && <>
      <p className="educational-assumption">Costos y efectos educativos; no son datos reales.</p>
      <div className="configuration-fields">{number('Presupuesto total (USD)', 'budgetCents', 1000000, true)}{number('Costo por dosis (USD)', 'vaccineCostCents', 10000, true)}</div>
      <ResourceScheduleEditor value={value.resourceSchedule} days={days} population={population} initialSupplies={value.brigadeDailyCapacity * value.brigadeDays} onChange={schedule => {
        const next = { ...value }; if (schedule) next.resourceSchedule = schedule; else delete next.resourceSchedule; onChange(next)
      }} />
      <details><summary>Cierre temporal de contactos</summary>
        <label className="field"><span>Tipo de contacto a cerrar</span><select value={value.closureContext} onChange={event => onChange({ ...value, closureContext: event.target.value as CombinedPlan['closureContext'] })}>
          <option value="household">Hogares</option><option value="school">Colegios</option><option value="bus">Rutas de bus</option><option value="market">Mercado</option><option value="neighborhood">Barrios</option>
        </select></label>
        <div className="configuration-fields">{number('Costo por día de cierre (USD)', 'closureCostCents', 10000, true)}{number('Inicio del cierre', 'closureStart', days)}{number('Días de cierre (0 desactiva)', 'closureDays', days)}</div>
      </details>
      <details><summary>Brigadas simuladas</summary><p>Reducen temporalmente el contagio en personas sanas. No curan ni inmunizan.</p>
        <div className="configuration-fields">{number('Costo por persona y día (USD)', 'brigadeCostCents', 10000, true)}{number('Personas atendidas por día', 'brigadeDailyCapacity', population)}{number('Reducción de transmisión (%)', 'brigadeReduction', 100, false, true)}{number('Inicio de brigadas', 'brigadeStart', days)}{number('Días de brigadas (0 desactiva)', 'brigadeDays', days)}</div>
      </details>
      <AdaptiveStrategyEditor value={value.adaptiveStrategy} onChange={adaptiveStrategy => {
        const next = { ...value }; if (adaptiveStrategy) next.adaptiveStrategy = adaptiveStrategy; else delete next.adaptiveStrategy; onChange(next)
      }} />
      <details className="combined-budget-help"><summary>Cómo se usa el presupuesto</summary><p>Orden diario: dosis, cierre y brigadas. Cada acción se aplica solo si alcanza el saldo. Aleatoria y Dirigida comparten el mismo presupuesto; sus decisiones pueden producir gastos distintos.</p></details>
    </>}
  </section>
}
