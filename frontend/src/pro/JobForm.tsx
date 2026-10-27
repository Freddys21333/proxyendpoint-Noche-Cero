import { useId } from 'react'
import { Gauge, Play, ShieldCheck } from 'lucide-react'
import { JOB_POLICIES, JOB_REPLICATE_MAX, JOB_REPLICATE_MIN, JOB_SEED_MAX, type ProJobDraft } from './jobs-model.ts'
import { policyLabels } from '../lib/comparison.ts'

export function JobForm({ draft, errors, onChange, onSubmit }: {
  draft: ProJobDraft
  errors: { replicates?: string; rootSeed?: string }
  onChange: (draft: ProJobDraft) => void
  onSubmit: () => void
}) {
  const replicatesId = useId()
  const seedId = useId()
  const replicateError = errors.replicates
  const seedError = errors.rootSeed

  return <section className="pro-card pro-form-card" aria-labelledby="pro-job-form-title">
    <div className="pro-card-heading">
      <div>
        <h2 id="pro-job-form-title">Nuevo trabajo</h2>
        <p>Configura el experimento antes de enviarlo.</p>
      </div>
      <span className="pro-badge">Fixture local</span>
    </div>
    <form className="pro-form" onSubmit={event => { event.preventDefault(); onSubmit() }} noValidate>
      <div className="pro-form-grid">
        <label className="pro-field" htmlFor={replicatesId}>
          <span>Réplicas</span>
          <input
            id={replicatesId}
            type="number"
            inputMode="numeric"
            min={JOB_REPLICATE_MIN}
            max={JOB_REPLICATE_MAX}
            step={1}
            value={Number.isNaN(draft.replicates) ? '' : draft.replicates}
            aria-invalid={Boolean(replicateError)}
            aria-describedby={replicateError ? `${replicatesId}-error` : undefined}
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
            onChange={event => onChange({ ...draft, rootSeed: event.target.value === '' ? NaN : Number(event.target.value) })}
          />
          {seedError && <small className="pro-field-error" id={`${seedId}-error`}>{seedError}</small>}
        </label>
      </div>
      <div className="pro-quick-row" aria-label="Cantidades rápidas de réplicas">
        {[100, 1000].map(value => <button
          key={value}
          type="button"
          className="pro-quick"
          aria-pressed={draft.replicates === value}
          onClick={() => onChange({ ...draft, replicates: value })}
        >{value.toLocaleString('es-EC')}</button>)}
        <span>Máximo de la demostración: {JOB_REPLICATE_MAX.toLocaleString('es-EC')} réplicas.</span>
      </div>
      <dl className="pro-form-meta">
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
      <p className="pro-form-note"><Gauge size={16} aria-hidden="true" /> El progreso de esta pantalla es simulado. No se ejecuta cómputo real ni se consulta AWS.</p>
      <button type="submit" className="pro-primary"><Play size={17} aria-hidden="true" /> Iniciar trabajo</button>
    </form>
    <div className="pro-contract-note">
      <ShieldCheck size={17} aria-hidden="true" />
      <p>Contrato pendiente: esta UI quedará conectada a <span className="mono">/v1/jobs</span> cuando el backend publique estados, idempotencia y resultado firmado.</p>
    </div>
  </section>
}
