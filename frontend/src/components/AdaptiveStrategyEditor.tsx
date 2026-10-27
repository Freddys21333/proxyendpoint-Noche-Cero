import type { AdaptiveStrategy } from '@/lib/api'
import './adaptive.css'

const defaults = (): AdaptiveStrategy => ({
  modelVersion: 'adaptive-policy-v1',
  closureInfectionThreshold: 0.05,
  reopenInfectionThreshold: 0.02,
  ringVaccinationPriority: true,
  enabled: true,
})

const toPercent = (fraction: number) => Number.isFinite(fraction) ? Math.round(fraction * 1000) / 10 : NaN
const fromPercent = (text: string) => text === '' ? NaN : Math.round(Number(text) * 10) / 1000

export function AdaptiveStrategyEditor({ value, onChange }: {
  value?: AdaptiveStrategy
  onChange: (value: AdaptiveStrategy | undefined) => void
}) {
  const invalid = Boolean(value && value.reopenInfectionThreshold > value.closureInfectionThreshold)
  const percentField = (label: string, key: 'closureInfectionThreshold' | 'reopenInfectionThreshold') => {
    const percent = toPercent(value![key])
    return <label className="field" key={key}>
      <span>{label}</span>
      <div className="input-wrap">
        <input type="number" min={0} max={100} step={0.1} aria-invalid={invalid}
          value={Number.isNaN(percent) ? '' : percent}
          onChange={event => onChange({ ...value!, [key]: fromPercent(event.target.value) })} />
        <span className="input-unit">%</span>
      </div>
    </label>
  }

  return <section className="adaptive-editor" aria-label="Política adaptativa para la estrategia dirigida">
    <label className="combined-toggle">
      <input type="checkbox" checked={Boolean(value)} onChange={event => onChange(event.target.checked ? defaults() : undefined)} />
      Política adaptativa para Dirigida
    </label>
    {value && <>
      <p className="adaptive-version">Variante <code>{value.modelVersion}</code>. Solo afecta a Dirigida; Aleatoria conserva su calendario fijo.</p>
      <label className="combined-toggle">
        <input type="checkbox" checked={value.enabled !== false} onChange={event => onChange({ ...value, enabled: event.target.checked })} />
        Reglas activas
      </label>
      <div className="configuration-fields">
        {percentField('Cierre si I/N alcanza (%)', 'closureInfectionThreshold')}
        {percentField('Reapertura si I/N baja de (%)', 'reopenInfectionThreshold')}
      </div>
      {invalid && <p className="adaptive-error" role="alert">El umbral de reapertura no debe superar el de cierre.</p>}
      <label className="combined-toggle">
        <input type="checkbox" checked={value.ringVaccinationPriority} onChange={event => onChange({ ...value, ringVaccinationPriority: event.target.checked })} />
        Prioridad de anillo: vacunar primero a quienes tienen más contactos con infecciosos
      </label>
      <p className="adaptive-assumption">Las reglas observan I/N, contactos activos, personas elegibles e inventario/presupuesto. Observar los estados completos es un supuesto educativo; el motor no lee eventos futuros ni resultados de otras políticas.</p>
      {value.enabled === false && <p className="adaptive-note">Con las reglas inactivas se conservan las acciones fijas y el backend registra columnas sin decisiones. Por incluir la configuración, el hash puede diferir de omitir la variante.</p>}
    </>}
  </section>
}
