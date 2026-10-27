import { useRef, type ReactNode } from 'react'
import { MapPinned } from 'lucide-react'
import type { PreviewResponse, CompareResponse } from '@/lib/api'
import type { ComparisonState } from '@/lib/simulation-playback'
import { SimulationWorkspace } from './SimulationWorkspace'
import './ContactNetwork.css'

export function ContactNetwork(props: { resetKey: number; layer: string; children?: ReactNode; preview?: PreviewResponse | null; comparison?: CompareResponse | null; comparisonState?: ComparisonState }) {
  const lastPreview = useRef<PreviewResponse | null>(null)
  if (props.preview) lastPreview.current = props.preview
  if (lastPreview.current) return <SimulationWorkspace {...props} preview={lastPreview.current} active={Boolean(props.preview)} />
  return <div className="simulator-workbench network-workbench">
    <section className="network-demo-panel simulation-empty" aria-label="Preparar simulación real">
      <div className="simulation-empty-icon"><MapPinned size={40} aria-hidden="true" /></div>
      <span className="simulation-empty-eyebrow">Simulación sobre el mapa de Manta</span>
      <h2>Tu escenario empieza aquí</h2>
      <p>Ajusta los parámetros y pulsa <strong>Consultar red</strong> para ver tu población sintética en el mapa.</p>
      <ol><li>Configura la población y los contactos.</li><li>Consulta el escenario en el mapa.</li><li>Compara estrategias para reproducir una réplica real.</li></ol>
      <p className="simulation-empty-note">Las ubicaciones son sintéticas. Los datos aparecerán al consultar el servidor.</p>
    </section>
    <div className="simulator-control-column">{props.children}</div>
  </div>
}
