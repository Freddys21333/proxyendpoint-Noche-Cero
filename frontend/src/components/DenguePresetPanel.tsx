import { FlaskConical } from 'lucide-react'
import { presetSummary, type DenguePreset } from '@/lib/dengue-preset'
import './DenguePresetPanel.css'

type Props = {
  preset: DenguePreset | null
  active: boolean
  error?: string
  onLoad: () => void
  onClear: () => void
}

/**
 * Preset calibrado optativo. El modo ficticio sigue siendo el predeterminado y
 * este panel declara que la validación fuera de muestra fue desfavorable.
 */
export function DenguePresetPanel({ preset, active, error, onLoad, onClear }: Props) {
  if (!preset) {
    return error ? (
      <section className="dengue-preset" aria-labelledby="dengue-preset-title" role="status">
        <h3 id="dengue-preset-title">Dengue de Manabí</h3>
        <p className="dengue-preset-error">El preset publicado no se pudo leer: {error}. El modo ficticio sigue disponible.</p>
      </section>
    ) : null
  }
  const summary = presetSummary(preset)
  const years = preset.dataset.years.join(' y ')
  return (
    <section className={`dengue-preset${active ? ' dengue-preset--active' : ''}`} aria-labelledby="dengue-preset-title">
      <div className="dengue-preset-heading">
        <h3 id="dengue-preset-title"><FlaskConical size={16} aria-hidden="true" /> Dengue de Manabí</h3>
        <span className="dengue-preset-status" data-status={preset.status}>
          {preset.status === 'fitted-not-validated' ? 'Ajustado, no validado' : 'Ajustado y validado'}
        </span>
      </div>
      <p className="dengue-preset-intro">
        El simulador usa por defecto el brote ficticio. Este preset sustituye la transmisión por un SEIR de mezcla
        homogénea ajustado a los casos notificados de Manabí ({years}) y traducido a la red sintética.
      </p>
      <p className="dengue-preset-label">{preset.label}</p>
      <p className="dengue-preset-figures" role="status" aria-live="polite">
        <span>{summary.window}</span>
        <span>{summary.validation}</span>
        <span>{summary.bridge}</span>
      </p>
      <p className="dengue-preset-identifiability">
        Identificabilidad: {preset.identifiability.identified ? 'máximo claro, condicionado al modelo' : 'débil'} ·
        mover β un 10 % cuesta {Math.abs(preset.identifiability.tenPercentDelta.up).toFixed(1)} unidades de
        log-verosimilitud. N y ρ siguen confundidos.
      </p>
      <p className="dengue-preset-identifiability">{preset.identifiability.note}</p>
      <details className="dengue-preset-limits">
        <summary>Límites declarados ({preset.limits.length})</summary>
        <ul>{preset.limits.map(limit => <li key={limit}>{limit}</li>)}</ul>
      </details>
      <div className="dengue-preset-actions">
        {active ? (
          <button type="button" className="plain-action" onClick={onClear}>Volver al brote ficticio</button>
        ) : (
          <button type="button" className="plain-action" onClick={onLoad}>Cargar preset de dengue</button>
        )}
        <small>Origen de los datos: {preset.dataset.datasetId} · hash {preset.hash.slice(0, 19)}…</small>
      </div>
    </section>
  )
}
