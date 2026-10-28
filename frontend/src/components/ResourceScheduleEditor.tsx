import type { ResourceSchedule } from '@/lib/api'

export function ResourceScheduleEditor({ value, onChange, days, population, initialSupplies }: {
  value?: ResourceSchedule; onChange: (value: ResourceSchedule | undefined) => void;
  days: number; population: number; initialSupplies: number;
}) {
  const input = (label: string, number: number, max: number, change: (n: number) => void) => <label className="field" key={label}><span>{label}</span>
    <div className="input-wrap"><input type="number" name={label} autoComplete="off" inputMode="numeric" min={0} max={max} step={1} value={Number.isNaN(number) ? '' : number} onChange={event => change(event.target.value === '' ? NaN : Number(event.target.value))} /></div></label>
  return <section className="resource-schedule-editor" aria-label="Entregas diarias de recursos">
    <label className="combined-toggle"><input type="checkbox" checked={Boolean(value)} onChange={event => onChange(event.target.checked ? { modelVersion: 'daily-inventory-v1', vaccineDailyCapacity: population, initialBrigadeSupplies: initialSupplies, deliveries: [] } : undefined)} />Programar entregas e inventario diario</label>
    {value && <>
      <p>Las entregas llegan antes de las acciones del día. Se paga al usar, sin aumentar el presupuesto. Lo no utilizado se acumula sin caducidad.</p>
      <p>La vacunación diaria comienza en el Día de vacunación, según inventario, capacidad y presupuesto. Dosis iniciales indica las disponibles al comenzar; cada persona recibe como máximo una.</p>
      <div className="configuration-fields">
        {input('Dosis máximas por día', value.vaccineDailyCapacity, population, n => onChange({ ...value, vaccineDailyCapacity: n }))}
        {input('Insumos iniciales de brigadas', value.initialBrigadeSupplies, 360000, n => onChange({ ...value, initialBrigadeSupplies: n }))}
      </div>
      <p>Un insumo permite atender una persona un día. Dosis iniciales más entregas: máximo {population}; insumos totales: máximo 360000.</p>
      {value.deliveries.map((row, index) => <fieldset className="resource-delivery" key={index}>
        <legend>Entrega {index + 1}</legend>
        <div className="configuration-fields">{(['day', 'vaccines', 'brigadeSupplies'] as const).map(key => input(key === 'day' ? 'Día de llegada' : key === 'vaccines' ? 'Dosis que llegan' : 'Insumos de brigadas que llegan', row[key], key === 'day' ? days : key === 'vaccines' ? population : 360000,
          n => onChange({ ...value, deliveries: value.deliveries.map((r, i) => i === index ? { ...r, [key]: n } : r) })))}</div>
        <button type="button" className="plain-action" aria-label={`Quitar entrega ${index + 1}`} onClick={() => onChange({ ...value, deliveries: value.deliveries.filter((_, i) => i !== index) })}>Quitar entrega</button>
      </fieldset>)}
      <button type="button" className="plain-action" disabled={value.deliveries.length >= 512} onClick={() => onChange({ ...value, deliveries: [...value.deliveries, { day: 0, vaccines: 0, brigadeSupplies: 0 }] })}>Añadir entrega</button>
    </>}
  </section>
}
