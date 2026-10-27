import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'

export function FloatingSimulationControls({ children }: { children: ReactNode }) {
  const id = useId()
  const panel = useRef<HTMLDetailsElement>(null)
  useLayoutEffect(() => {
    const element = panel.current
    const workspace = element?.parentElement
    if (!element || !workspace) return
    const inventory = workspace.querySelector('.population-inventory-summary')
    const position = () => {
      const bounds = workspace.getBoundingClientRect()
      const scene = workspace.querySelector('.network-view:not([hidden])')?.getBoundingClientRect()
      const top = Math.max(inventory ? inventory.getBoundingClientRect().bottom - bounds.top + 12 : 24, scene ? scene.top - bounds.top + 12 : 24)
      element.style.setProperty('--controls-top', `${top}px`)
      element.style.setProperty('--controls-height', `${Math.max(160, (scene?.bottom ?? bounds.bottom) - bounds.top - top - 12)}px`)
    }
    const observer = new ResizeObserver(position)
    observer.observe(workspace)
    workspace.querySelectorAll('.network-demo-heading, .network-meaning, .population-inventory-summary, .network-view').forEach(node => observer.observe(node))
    position()
    return () => observer.disconnect()
  }, [])
  return <details ref={panel} className="floating-simulation-controls" open>
    <summary aria-controls={id}>
      <SlidersHorizontal size={17} aria-hidden="true" />
      <span>Controles</span>
      <ChevronDown size={17} className="floating-controls-chevron" aria-hidden="true" />
    </summary>
    <div id={id} className="floating-controls-body simulator-control-column">{children}</div>
  </details>
}
