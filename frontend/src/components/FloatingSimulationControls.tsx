import { useId, type ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'

export function FloatingSimulationControls({ children }: { children: ReactNode }) {
  const id = useId()
  return <details className="floating-simulation-controls" open>
    <summary aria-controls={id}>
      <SlidersHorizontal size={17} aria-hidden="true" />
      <span>Controles</span>
      <ChevronDown size={17} className="floating-controls-chevron" aria-hidden="true" />
    </summary>
    <div id={id} className="floating-controls-body simulator-control-column">{children}</div>
  </details>
}
