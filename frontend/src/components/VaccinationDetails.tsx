import type { Policy, VaccinationSelection } from '@/lib/api'
import { selectionReason, vaccinationContexts, vaccinationsAtDay } from '@/lib/vaccination'
import { policyLabels } from '@/lib/comparison'

export function VaccinationPerson({ selection }: { selection: VaccinationSelection }) {
  return <section className="vaccination-person" aria-label="Detalle de la dosis">
    <h4>Dosis recibida · día {selection.day}</h4>
    <p>{selection.effective ? 'Efectiva: produjo inmunización (S → R).' : 'No efectiva: consumió una dosis sin producir inmunización.'}</p>
    <p>Estado al decidir: S (susceptible y elegible). El estado actual puede ser diferente.</p>
    <p>{selectionReason(selection)}</p>
    <p>Contextos de contactos entre susceptibles al decidir: {selection.contexts.length ? selection.contexts.map(context => vaccinationContexts[context]).join(', ') : 'ninguno'}.</p>
  </section>
}

export function VaccinationDetails({ selections, day, interventionDay, vaccines, policy, onSelect, selectedId }: {
  selections: VaccinationSelection[]; day: number; interventionDay: number; vaccines: number; policy: Policy; onSelect: (id: string) => void; selectedId?: string
}) {
  const applied = vaccinationsAtDay(selections, day)
  const effective = applied.filter(row => row.effective).length
  return <section className="vaccination-details" aria-label="Vacunación de la réplica">
    <h3>Vacunación · {policyLabels[policy]}</h3>
    {policy === 'none' ? <p>Esta estrategia no aplica vacunas.</p> : day < interventionDay ? <p>Intervención pendiente: se aplica al registrar el día {interventionDay}. Aún no se ha administrado ninguna dosis.</p> : <p>Se seleccionaron susceptibles al decidir. Cada selección consume una dosis, incluso si no es efectiva.</p>}
    <p aria-label="Inventario de dosis">Asignadas: {applied.length} · Efectivas: {effective} · Sin usar: {vaccines - applied.length}</p>
    {applied.length > 0 && <>
      <p>Borde violeta continuo: dosis efectiva. Borde violeta discontinuo: dosis no efectiva. El color interior sigue indicando el estado SEIR.</p>
      <details className="chart-table"><summary>Ver personas vacunadas ({applied.length})</summary><div><table>
        <caption>Selecciones de esta réplica, en el orden registrado por el motor</caption>
        <thead><tr><th>Posición</th><th>Persona</th><th>Día</th><th>Puntuación</th><th>Dosis</th></tr></thead>
        <tbody>{applied.map(row => <tr key={row.nodeId}><td>{row.rank}</td><td><button type="button" className="plain-action" onClick={() => onSelect(String(row.nodeId))}>Persona {String(row.nodeId).padStart(3, '0')}</button></td><td>{row.day}</td><td>{row.score === null ? 'No aplica' : row.score.toLocaleString('es-EC', { maximumFractionDigits: 6 })}</td><td>{row.effective ? 'Efectiva' : 'No efectiva'}</td></tr>)}</tbody>
      </table></div></details>
    </>}
    {selectedId !== undefined && applied.find(row => String(row.nodeId) === selectedId) && <><h4>Persona {selectedId.padStart(3, '0')}</h4><VaccinationPerson selection={applied.find(row => String(row.nodeId) === selectedId)!} /></>}
  </section>
}
