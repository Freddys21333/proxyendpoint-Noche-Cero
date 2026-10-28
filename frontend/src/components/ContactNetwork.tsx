import { useRef, type ReactNode } from 'react'
import { Network } from 'lucide-react'
import type { PreviewResponse, CompareResponse } from '@/lib/api'
import type { ComparisonState } from '@/lib/simulation-playback'
import { SimulationWorkspace } from './SimulationWorkspace'
import { FloatingSimulationControls } from './FloatingSimulationControls'
import './ContactNetwork.css'

export function ContactNetwork(props: { resetKey: number; layer: string; children?: ReactNode; panelActions?: ReactNode; preview?: PreviewResponse | null; comparison?: CompareResponse | null; comparisonState?: ComparisonState; renderTools?: (view: 'network' | 'map', matchingPeople?: number) => ReactNode; onChooseOrigin?: (id: number) => void }) {
  const lastPreview = useRef<PreviewResponse | null>(null)
  if (props.preview) lastPreview.current = props.preview
  if (lastPreview.current) return <SimulationWorkspace {...props} preview={lastPreview.current} active={Boolean(props.preview)} />
  return <div className="simulator-workbench network-workbench">
    <section className="network-demo-panel simulation-empty" aria-label="Preparar escenario">
      <Network size={40} strokeWidth={1.5} aria-hidden="true" />
      <h2>Prepara tu primer escenario</h2>
      <p>Ajusta la población, el brote y la vacunación en <strong>Escenario</strong>. Pulsa <strong>Consultar red</strong> para ver las personas y sus contactos.</p>
      <p className="simulation-empty-note">Población y ubicaciones sintéticas de Manta. Aún no hay resultados.</p>
    </section>
    <FloatingSimulationControls actions={props.panelActions}>{props.children}</FloatingSimulationControls>
  </div>
}
