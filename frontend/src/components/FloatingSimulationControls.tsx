import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'

export function FloatingSimulationControls({ children, actions, transport }: { children: ReactNode; actions?: ReactNode; transport?: ReactNode }) {
  const id = useId()
  const panel = useRef<HTMLDetailsElement>(null)
  useLayoutEffect(() => {
    const element = panel.current
    const workspace = element?.parentElement
    if (!element || !workspace) return
    // The viewport layout owns sizing; floating-position measurements do not apply.
    if (workspace.closest('.simulator-page')) return
    const inventory = workspace.querySelector('.population-inventory-summary')
    const position = () => {
      const bounds = workspace.getBoundingClientRect()
      const scene = workspace.querySelector('.network-view:not([hidden])')?.getBoundingClientRect()
      const top = Math.max(inventory ? inventory.getBoundingClientRect().bottom - bounds.top + 12 : 24, scene ? scene.top - bounds.top + 12 : 24)
      const header = document.querySelector<HTMLElement>('.simulation-header')?.getBoundingClientRect().height ?? 0
      const visibleTop = Math.max(bounds.top + top, header)
      const available = window.innerHeight - visibleTop - 16
      element.style.setProperty('--controls-top', `${top}px`)
      element.style.setProperty('--controls-height', `${Math.max(200, Math.min(900, available))}px`)
    }
    const observer = new ResizeObserver(position)
    const main = workspace.closest('main')
    observer.observe(workspace)
    if (main) observer.observe(main)
    workspace.querySelectorAll('.network-demo-heading, .network-meaning, .population-inventory-summary, .network-view').forEach(node => observer.observe(node))
    window.addEventListener('resize', position)
    position()
    return () => { observer.disconnect(); window.removeEventListener('resize', position) }
  }, [])
  return <details ref={panel} className="floating-simulation-controls" open>
    <summary aria-controls={id}>
      <SlidersHorizontal size={17} aria-hidden="true" />
      <span>Controles</span>
      <ChevronDown size={17} className="floating-controls-chevron" aria-hidden="true" />
    </summary>
    {transport && <div className="floating-controls-transport">{transport}</div>}
    <div className="floating-controls-inner">
      <div id={id} className="floating-controls-body simulator-control-column">{children}</div>
      {actions && <div className="floating-controls-footer">{actions}</div>}
    </div>
  </details>
}
