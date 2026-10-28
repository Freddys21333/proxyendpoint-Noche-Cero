import { Database, ListChecks, ShieldCheck } from 'lucide-react'
import type { CompareResponse, ConfigResponse, PreviewResponse } from '../lib/api.ts'
import { policyLabels } from '../lib/comparison.ts'
import { JobsWorkspace } from './JobsWorkspace.tsx'
import './ProWorkspace.css'

const policies = ['none', 'random', 'targeted'] as const
const number = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 1 })

export function ProWorkspace({ comparison, comparisonPending, config, preview, onShowSimulator, onShowResults }: {
  comparison: CompareResponse | null
  comparisonPending: boolean
  config: ConfigResponse | null
  preview: PreviewResponse | null
  onShowSimulator: () => void
  onShowResults: () => void
}) {
  const jobsEnabled = Boolean(config?.features.asyncJobs)
  const awsJobs = config?.features.jobBackend === 'aws'
  return <section className="pro-workspace" aria-labelledby="pro-title">
    <header className="pro-heading">
      <div>
        <h1 id="pro-title">PRO</h1>
        <p>Estado de las capacidades PRO y trabajos Monte Carlo.</p>
      </div>
      <span className={`pro-badge${jobsEnabled ? '' : ' pro-badge--muted'}`}>Trabajos: {jobsEnabled ? (awsJobs ? 'AWS' : 'servidor local') : 'deshabilitados'}</span>
    </header>

    <section className="pro-current" aria-labelledby="pro-current-title">
      <div className="pro-current-heading">
        <div>
          <h2 id="pro-current-title">Experimento disponible ahora</h2>
          <p>Comparación del motor, con 2 a 30 réplicas y tres políticas pareadas.</p>
        </div>
        <span className="pro-badge">Backend real</span>
      </div>
      {comparison ? <>
        <p className="pro-current-meta">Semilla {comparison.configuration.rootSeed} · {comparison.configuration.repetitions} réplicas · {comparison.configuration.scenario.populationSize} personas · {comparison.configuration.scenario.days} días</p>
        <div className="pro-table-scroll"><table>
          <caption>Media de infectados acumulados del experimento vigente</caption>
          <thead><tr><th scope="col">Política</th><th scope="col">Media de infectados</th></tr></thead>
          <tbody>{policies.map(policy => <tr key={policy}><th scope="row">{policyLabels[policy]}</th><td>{comparison.summaryByPolicy[policy].cumulativeInfected.mean === null ? '—' : number.format(comparison.summaryByPolicy[policy].cumulativeInfected.mean!)}</td></tr>)}</tbody>
        </table></div>
        <p className="pro-current-footnote">Son medias del backend para este escenario. La incertidumbre, diferencias pareadas y límites están en la comparación completa.</p>
        <button type="button" className="pro-secondary" onClick={onShowResults}>Abrir comparación completa</button>
      </> : comparisonPending ? <div className="pro-current-empty" role="status">
        <p>La comparación está en curso. El resumen aparecerá cuando el backend termine todas las réplicas.</p>
        <button type="button" className="pro-secondary" onClick={onShowResults}>Ver estado de la comparación</button>
      </div> : <div className="pro-current-empty">
        <p>Sin experimento vigente. Configura el escenario, consulta la red y ejecuta una comparación para ver resultados reales aquí.</p>
        <button type="button" className="pro-secondary" onClick={onShowSimulator}>Ir al simulador</button>
      </div>}
    </section>

    <div className="pro-demo-note" role="note">
      {jobsEnabled ? <>{awsJobs ? 'Los trabajos se guardan en AWS durante un día. Máximo un trabajo activo y tres nuevos al día; dos trabajadores en paralelo.' : 'Los trabajos locales se pierden al reiniciar el servidor.'} Las credenciales se descartan al cerrar la pestaña.</>
        : <>La comparación está disponible. Los trabajos grandes en AWS siguen pendientes de implementación (P-04).</>}
    </div>

    <nav className="pro-section-nav" aria-label="Secciones PRO">
      <button type="button" aria-current="page"><ListChecks size={17} aria-hidden="true" /> Trabajos</button>
      <button type="button" disabled title="Se habilitará al cerrar el contrato de evidencia"><Database size={17} aria-hidden="true" /> Evidencia <small>Próximamente</small></button>
    </nav>

    {jobsEnabled
      ? <JobsWorkspace config={config} preview={preview} onShowSimulator={onShowSimulator} />
      : <p role="status">Trabajos asíncronos deshabilitados en este despliegue. Usa la comparación del simulador.</p>}
    <p>El informe para alcaldía se descarga desde Comparación o desde el resultado completo de un trabajo.</p>

    {jobsEnabled && !awsJobs && <details className="pro-contract">
      <summary><ShieldCheck size={17} aria-hidden="true" /> Estado de integración</summary>
      <div className="pro-contract-grid">
        <div><span>Contrato <span className="mono">/v1/jobs</span></span><strong>Verificado localmente</strong></div>
        <div><span>Backend de trabajos</span><strong>Cola local, token e idempotencia</strong></div>
        <div><span>Esta pantalla</span><strong>API real, sin fixtures</strong></div>
        <div><span>Pendiente</span><strong>P-04 en AWS</strong></div>
      </div>
      <p>La pantalla usa estados, progreso, cancelación y resultado del servidor local. Las cifras de un trabajo solo son válidas para su hash y su configuración; la ejecución distribuida de miles de réplicas sigue pendiente en P-04.</p>
    </details>}
  </section>
}
