import { Database, FileText, ListChecks, ShieldCheck } from 'lucide-react'
import type { CompareResponse, ConfigResponse, PreviewResponse, createApiClient } from '../lib/api.ts'
import { policyLabels } from '../lib/comparison.ts'
import { JobsWorkspace } from './JobsWorkspace.tsx'
import './ProWorkspace.css'

const policies = ['none', 'random', 'targeted'] as const
const number = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 1 })

export function ProWorkspace({ api, serverConfig, preview, comparison, comparisonPending, onShowSimulator, onShowResults }: {
  api: ReturnType<typeof createApiClient>
  serverConfig: ConfigResponse | null
  preview: PreviewResponse | null
  comparison: CompareResponse | null
  comparisonPending: boolean
  onShowSimulator: () => void
  onShowResults: () => void
}) {
  return <section className="pro-workspace" aria-labelledby="pro-title">
    <header className="pro-heading">
      <div>
        <h1 id="pro-title">PRO</h1>
        <p>Estado de las capacidades PRO y exploración de trabajos.</p>
      </div>
      <span className={`pro-badge ${serverConfig?.features.asyncJobs ? '' : 'pro-badge--muted'}`}>{serverConfig?.features.asyncJobs ? 'Trabajos: backend local' : 'Trabajos no disponibles'}</span>
    </header>

    <section className="pro-current" aria-labelledby="pro-current-title">
      <div className="pro-current-heading">
        <div>
          <h2 id="pro-current-title">Experimento disponible ahora</h2>
          <p>Comparación síncrona del motor local, con 2 a 30 réplicas y tres políticas pareadas.</p>
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

    <nav className="pro-section-nav" aria-label="Secciones PRO">
      <button type="button" aria-current="page"><ListChecks size={17} aria-hidden="true" /> Trabajos</button>
      <button type="button" disabled title="Se habilitará al cerrar el contrato de evidencia"><Database size={17} aria-hidden="true" /> Evidencia <small>Próximamente</small></button>
      <button type="button" disabled title="Se habilitará al cerrar el contrato de informe"><FileText size={17} aria-hidden="true" /> Informe <small>Próximamente</small></button>
    </nav>

    <JobsWorkspace api={api} serverConfig={serverConfig} comparison={comparison} preview={preview?.configuration ?? null} />

    <details className="pro-contract">
      <summary><ShieldCheck size={17} aria-hidden="true" /> Estado de integración</summary>
      <div className="pro-contract-grid">
        <div><span>Contrato <span className="mono">/v1/jobs</span></span><strong>{serverConfig?.features.asyncJobs ? 'Disponible' : 'No anunciado'}</strong></div>
        <div><span>Backend de trabajos</span><strong>{serverConfig?.features.asyncJobs ? 'Proceso local' : 'Deshabilitado'}</strong></div>
        <div><span>Esta pantalla</span><strong>{serverConfig?.features.asyncJobs ? 'API y sessionStorage' : 'Esperando backend'}</strong></div>
        <div><span>AWS</span><strong>No desplegado</strong></div>
      </div>
      <p>El backend local pierde los trabajos al reiniciarse y conserva resultados temporalmente. La pantalla solo permite lanzar trabajos dentro de los límites anunciados y presenta un agregado cuando está completo.</p>
    </details>
  </section>
}
