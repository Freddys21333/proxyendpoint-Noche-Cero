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
      Ajustar Dirigida según el brote
    </label>
    {value && <>
      <p className="adaptive-version">Dirigida ajusta los cierres y la prioridad de vacunación según los casos del día. Aleatoria mantiene su calendario.</p>
      <label className="combined-toggle">
        <input type="checkbox" checked={value.enabled !== false} onChange={event => onChange({ ...value, enabled: event.target.checked })} />
        Activar estas reglas
      </label>
      <div className="configuration-fields">
        {percentField('Cerrar con este % de zombies', 'closureInfectionThreshold')}
        {percentField('Reabrir con menos de este %', 'reopenInfectionThreshold')}
      </div>
      <p>Porcentaje de zombies sobre toda la población.</p>
      {invalid && <p className="adaptive-error" role="alert">El porcentaje para reabrir debe ser igual o menor al de cierre.</p>}
      <label className="combined-toggle">
        <input type="checkbox" checked={value.ringVaccinationPriority} onChange={event => onChange({ ...value, ringVaccinationPriority: event.target.checked })} />
        Vacunar primero a quienes tienen más contacto con zombies
      </label>
      <p className="adaptive-assumption">Reglas educativas basadas en los casos y recursos disponibles.</p>
      {value.enabled === false && <p className="adaptive-note">Reglas pausadas: se usa el calendario configurado.</p>}
      <details><summary>Detalles del modelo</summary><p>Versión {value.modelVersion}. El modelo conoce los estados de las personas del día actual, no eventos futuros ni resultados de otras estrategias.</p></details>
    </>}
  </section>
}
