import { useRef, type ReactNode } from 'react'
import { Network } from 'lucide-react'
import type { PreviewResponse, CompareResponse } from '@/lib/api'
import type { ComparisonState } from '@/lib/simulation-playback'
import { SimulationWorkspace } from './SimulationWorkspace'
import { FloatingSimulationControls } from './FloatingSimulationControls'
import './ContactNetwork.css'

export function ContactNetwork(props: { resetKey: number; layer: string; children?: ReactNode; panelActions?: ReactNode; preview?: PreviewResponse | null; comparison?: CompareResponse | null; comparisonState?: ComparisonState; renderTools?: (view: 'network' | 'map') => ReactNode }) {
  const lastPreview = useRef<PreviewResponse | null>(null)
  if (props.preview) lastPreview.current = props.preview
  if (lastPreview.current) return <SimulationWorkspace {...props} preview={lastPreview.current} active={Boolean(props.preview)} />
  return <div className="simulator-workbench network-workbench">
    <section className="network-demo-panel simulation-empty" aria-label="Preparar simulación real">
      <div className="empty-network-art" aria-hidden="true">
        <span className="empty-orbit empty-orbit--one" /><span className="empty-orbit empty-orbit--two" /><span className="empty-orbit empty-orbit--three" />
        <span className="empty-signal empty-signal--one" /><span className="empty-signal empty-signal--two" /><span className="empty-signal empty-signal--three" /><span className="empty-signal empty-signal--four" />
        <span className="empty-network-core"><Network size={38} strokeWidth={1.5} /></span>
      </div>
      <span className="empty-eyebrow">RED DE CONTACTOS · SIN DATOS CARGADOS</span>
      <h2>La noche comienza en la red.</h2>
      <p>Ajusta los parámetros y pulsa <strong>Consultar red</strong> para descubrir la población y sus contactos reales del escenario.</p>
      <div className="empty-steps"><span><b>01</b> Configura</span><span><b>02</b> Consulta la red</span><span><b>03</b> Compara</span></div>
      <p className="simulation-empty-note">Las personas y ubicaciones son sintéticas. Esta ilustración no muestra resultados.</p>
    </section>
    <FloatingSimulationControls actions={props.panelActions}>{props.renderTools?.('network')}{props.children}</FloatingSimulationControls>
  </div>
}
