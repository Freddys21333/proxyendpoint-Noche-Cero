import { useId } from 'react'
import { Gauge, Play, ShieldCheck } from 'lucide-react'
import { JOB_POLICIES, JOB_REPLICATE_MIN, JOB_SEED_MAX, type ProJobDraft } from './jobs-model.ts'
import { policyLabels } from '../lib/comparison.ts'

export function JobForm({ draft, errors, maxReplicates, hasPreview, previewLabel, available, busy, onChange, onSubmit, onShowSimulator }: {
  draft: ProJobDraft
  errors: { replicates?: string; rootSeed?: string }
  maxReplicates: number
  hasPreview: boolean
  previewLabel: string | null
  available: boolean
  busy: boolean
  onChange: (draft: ProJobDraft) => void
  onSubmit: () => void
  onShowSimulator: () => void
}) {
  const replicatesId = useId()
  const seedId = useId()
  const replicateError = errors.replicates
  const seedError = errors.rootSeed
  const quickValues = [...new Set([10, 50, Math.min(100, maxReplicates)])].filter(value => value >= JOB_REPLICATE_MIN && value <= maxReplicates)
  const canSubmit = available && hasPreview && !busy

  return <section className="pro-card pro-form-card" aria-labelledby="pro-job-form-title">
    <div className="pro-card-heading">
      <div>
        <h2 id="pro-job-form-title">Nuevo trabajo</h2>
        <p>Ejecuta el escenario vigente como trabajo local de 2 a {maxReplicates.toLocaleString('es-EC')} réplicas.</p>
      </div>
      <span className={`pro-badge${available ? '' : ' pro-badge--muted'}`}>{available ? 'Backend local' : 'Sin trabajos'}</span>
    </div>

    {!available && <div className="pro-alert pro-alert--warning" role="alert">
      <ShieldCheck size={19} aria-hidden="true" />
      <div>
        <strong>Trabajos asíncronos deshabilitados</strong>
        <p>Este servidor anunció <span className="mono">features.asyncJobs:false</span>. Inicia la API con <span className="mono">scripts/serve_api.py</span> para habilitar <span className="mono">/v1/jobs</span>.</p>
      </div>
    </div>}

    {available && !hasPreview && <div className="pro-alert pro-alert--warning" role="status">
      <ShieldCheck size={19} aria-hidden="true" />
      <div>
        <strong>Falta la vista previa de la red</strong>
        <p>El trabajo reutiliza el escenario y el hash de red de la vista previa. Consulta la red antes de crearlo.</p>
        <button type="button" className="pro-secondary" onClick={onShowSimulator}>Ir al simulador</button>
      </div>
    </div>}

    <form className="pro-form" onSubmit={event => { event.preventDefault(); if (canSubmit) onSubmit() }} noValidate>
      <div className="pro-form-grid">
        <label className="pro-field" htmlFor={replicatesId}>
          <span>Réplicas</span>
          <input
            id={replicatesId}
            type="number"
            inputMode="numeric"
            min={JOB_REPLICATE_MIN}
            max={maxReplicates}
            step={1}
            value={Number.isNaN(draft.replicates) ? '' : draft.replicates}
            aria-invalid={Boolean(replicateError)}
            aria-describedby={replicateError ? `${replicatesId}-error` : undefined}
            disabled={!available}
            onChange={event => onChange({ ...draft, replicates: event.target.value === '' ? NaN : Number(event.target.value) })}
          />
          {replicateError && <small className="pro-field-error" id={`${replicatesId}-error`}>{replicateError}</small>}
        </label>
        <label className="pro-field" htmlFor={seedId}>
          <span>Semilla raíz</span>
          <input
            id={seedId}
            type="number"
            inputMode="numeric"
            min={0}
            max={JOB_SEED_MAX}
            step={1}
            value={Number.isNaN(draft.rootSeed) ? '' : draft.rootSeed}
            aria-invalid={Boolean(seedError)}
            aria-describedby={seedError ? `${seedId}-error` : undefined}
            disabled={!available}
            onChange={event => onChange({ ...draft, rootSeed: event.target.value === '' ? NaN : Number(event.target.value) })}
          />
          {seedError && <small className="pro-field-error" id={`${seedId}-error`}>{seedError}</small>}
        </label>
      </div>
      <div className="pro-quick-row" aria-label="Cantidades rápidas de réplicas">
        {quickValues.map(value => <button
          key={value}
          type="button"
          className="pro-quick"
          aria-pressed={draft.replicates === value}
          disabled={!available}
          onClick={() => onChange({ ...draft, replicates: value })}
        >{value.toLocaleString('es-EC')}</button>)}
        <span>Máximo del servidor: {maxReplicates.toLocaleString('es-EC')} réplicas. La cola admite pocos trabajos a la vez.</span>
      </div>
      <dl className="pro-form-meta">
        <div>
          <dt>Escenario</dt>
          <dd>{previewLabel ?? <span className="pro-badge pro-badge--muted">Sin vista previa</span>}</dd>
        </div>
        <div>
          <dt>Políticas pareadas</dt>
          <dd>{JOB_POLICIES.map(policy => <span className="pro-chip" key={policy}>{policyLabels[policy]}</span>)}</dd>
        </div>
        <div>
          <dt>Modelo</dt>
          <dd><span>Plaga ficticia SEIR</span><span className="pro-badge pro-badge--muted">Ficticio</span></dd>
        </div>
        <div>
          <dt>Red</dt>
          <dd>Fija, misma realización por réplica</dd>
        </div>
      </dl>
      <p className="pro-form-note"><Gauge size={16} aria-hidden="true" /> El progreso lo informa el servidor local; el token de acceso vive solo en esta sesión del navegador. No se consulta AWS.</p>
      <button type="submit" className="pro-primary" disabled={!canSubmit}>
        <Play size={17} aria-hidden="true" /> {busy ? 'Creando trabajo…' : 'Iniciar trabajo'}
      </button>
    </form>
  </section>
}
