import type { CombinedPlan } from '@/lib/api'
import { ResourceScheduleEditor } from './ResourceScheduleEditor'

export function CombinedInterventions({ value, onChange, days, population }: {
  value?: CombinedPlan; onChange: (value: CombinedPlan | undefined) => void; days: number; population: number;
}) {
  const defaults = (): CombinedPlan => ({ modelVersion: 'combined-educational-v1', budgetCents: 200000,
    vaccineCostCents: 1000, closureCostCents: 10000, closureContext: 'school', closureStart: 0,
    closureDays: Math.min(days, 7), brigadeCostCents: 200, brigadeDailyCapacity: Math.min(population, 10),
    brigadeReduction: 0.3, brigadeStart: 0, brigadeDays: Math.min(days, 7) })
  const number = (label: string, key: keyof CombinedPlan, max: number, money = false, percent = false) => <label className="field" key={key}>
    <span>{label}</span><input type="number" min={money && key !== 'budgetCents' ? 0.01 : 0} max={max} step={money ? 0.01 : 1}
      value={Number.isNaN(value![key]) ? '' : Number(value![key]) / (money ? 100 : percent ? 0.01 : 1)}
      onChange={event => onChange({ ...value!, [key]: event.target.value === '' ? NaN : money ? Math.round(Number(event.target.value) * 100) : Number(event.target.value) * (percent ? 0.01 : 1) })} /></label>
  return <section className="combined-settings" aria-label="Intervenciones combinadas y presupuesto">
    <label className="combined-toggle"><input type="checkbox" checked={Boolean(value)} onChange={event => onChange(event.target.checked ? defaults() : undefined)} />Combinar intervenciones con presupuesto</label>
    {value && <>
      <p className="educational-assumption">Supuestos educativos editables en USD. No son precios reales ni efectos sanitarios calibrados.</p>
      <div className="configuration-fields">{number('Presupuesto total (USD)', 'budgetCents', 1000000, true)}{number('Costo por dosis (USD)', 'vaccineCostCents', 10000, true)}</div>
      <ResourceScheduleEditor value={value.resourceSchedule} days={days} population={population} initialSupplies={value.brigadeDailyCapacity * value.brigadeDays} onChange={schedule => {
        const next = { ...value }; if (schedule) next.resourceSchedule = schedule; else delete next.resourceSchedule; onChange(next)
      }} />
      <details open><summary>Cierre temporal de contactos</summary>
        <label className="field"><span>Tipo de contacto a cerrar</span><select value={value.closureContext} onChange={event => onChange({ ...value, closureContext: event.target.value as CombinedPlan['closureContext'] })}>
          <option value="household">Hogares</option><option value="school">Colegios</option><option value="bus">Rutas de bus</option><option value="market">Mercado</option><option value="neighborhood">Barrios</option>
        </select></label>
        <div className="configuration-fields">{number('Costo por día de cierre (USD)', 'closureCostCents', 10000, true)}{number('Inicio del cierre', 'closureStart', days)}{number('Días de cierre (0 desactiva)', 'closureDays', days)}</div>
      </details>
      <details open><summary>Brigadas simuladas</summary><p>Reducen temporalmente la transmisión de contactos de personas susceptibles atendidas. No curan ni inmunizan.</p>
        <div className="configuration-fields">{number('Costo por persona y día (USD)', 'brigadeCostCents', 10000, true)}{number('Personas atendidas por día', 'brigadeDailyCapacity', population)}{number('Reducción de transmisión (%)', 'brigadeReduction', 100, false, true)}{number('Inicio de brigadas', 'brigadeStart', days)}{number('Días de brigadas (0 desactiva)', 'brigadeDays', days)}</div>
      </details>
      <details className="adaptive-strategy-editor">
        <summary>Política adaptativa dirigida</summary>
        <label className="combined-toggle"><input type="checkbox" checked={Boolean(value.adaptiveStrategy)} onChange={event => {
          const next = { ...value }
          if (event.target.checked) next.adaptiveStrategy = {
            modelVersion: 'adaptive-policy-v1', closureInfectionThreshold: 0.05,
            reopenInfectionThreshold: 0.02, ringVaccinationPriority: true, enabled: true,
          }
          else delete next.adaptiveStrategy
          onChange(next)
        }} />Habilitar la variante adaptativa para la estrategia Dirigida</label>
        {value.adaptiveStrategy && <>
          <p className="educational-assumption">Versión adaptive-policy-v1. Observa la fracción infecciosa del día y los recursos disponibles; no predice el futuro ni representa diagnóstico real.</p>
          <label className="combined-toggle"><input type="checkbox" checked={value.adaptiveStrategy.enabled !== false} onChange={event => onChange({
            ...value, adaptiveStrategy: { ...value.adaptiveStrategy!, enabled: event.target.checked },
          })} />Aplicar decisiones adaptativas</label>
          <div className="configuration-fields">
            <label className="field"><span>Umbral de cierre (% de población infecciosa)</span><input type="number" min={0} max={100} step={0.1}
              value={value.adaptiveStrategy.closureInfectionThreshold * 100}
              onChange={event => onChange({ ...value, adaptiveStrategy: { ...value.adaptiveStrategy!, closureInfectionThreshold: event.target.value === '' ? Number.NaN : Number(event.target.value) / 100 } })} /></label>
            <label className="field"><span>Umbral de reapertura (%)</span><input type="number" min={0} max={100} step={0.1}
              value={value.adaptiveStrategy.reopenInfectionThreshold * 100}
              onChange={event => onChange({ ...value, adaptiveStrategy: { ...value.adaptiveStrategy!, reopenInfectionThreshold: event.target.value === '' ? Number.NaN : Number(event.target.value) / 100 } })} /></label>
          </div>
          <label className="combined-toggle"><input type="checkbox" checked={value.adaptiveStrategy.ringVaccinationPriority} onChange={event => onChange({
            ...value, adaptiveStrategy: { ...value.adaptiveStrategy!, ringVaccinationPriority: event.target.checked },
          })} />Priorizar susceptibles con contactos infecciosos (anillo)</label>
          <p>Reapertura debe ser igual o inferior al umbral de cierre. La política aleatoria conserva su calendario fijo para que el resultado identifique claramente la variante evaluada.</p>
        </>}
      </details>
      <p>Orden diario: dosis, cierre y brigadas. Cada acción se aplica solo si alcanza el saldo. Aleatoria y Dirigida comparten el mismo presupuesto; sus decisiones pueden producir gastos distintos.</p>
    </>}
  </section>
}
