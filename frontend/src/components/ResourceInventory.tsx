import type { InventoryDaily, ResourceSchedule } from '@/lib/api'

export function ResourceInventory({ row, schedule, initialVaccines, day }: {
  row: InventoryDaily | null; schedule: ResourceSchedule; initialVaccines: number; day: number;
}) {
  const upcoming = schedule.deliveries.find(delivery => delivery.day > day)
  return <section className="resource-inventory-panel" aria-label="Inventario diario de recursos">
    <h3>Inventario de recursos</h3>
    {!row ? <p>Antes de las entregas: {initialVaccines} dosis y {schedule.initialBrigadeSupplies} insumos de brigadas iniciales. Ejecuta la comparación con reproducción para recorrer el registro diario.</p> : <>
      <p>Día {day}. Recibidas hasta hoy: {row.vaccinesReceivedTotal} dosis y {row.brigadeSuppliesReceivedTotal} insumos, incluidos los iniciales.</p>
      <table><caption>Existencias físicas, separadas del saldo monetario</caption><thead><tr><th>Recurso</th><th>Llega hoy</th><th>Usado hoy</th><th>Disponible</th></tr></thead><tbody>
        <tr><th>Dosis</th><td>{row.vaccinesDeliveredToday}</td><td>{row.vaccinesUsedToday}</td><td>{row.vaccinesAvailable}</td></tr>
        <tr><th>Insumos brigadas</th><td>{row.brigadeSuppliesDeliveredToday}</td><td>{row.brigadeSuppliesUsedToday}</td><td>{row.brigadeSuppliesAvailable}</td></tr>
      </tbody></table>
      <p>{upcoming ? `Próxima entrega: día ${upcoming.day}, ${upcoming.vaccines} dosis y ${upcoming.brigadeSupplies} insumos.` : 'No quedan entregas programadas.'}</p>
    </>}
    <p>Recibir no aumenta el presupuesto. Cada uso descuenta existencias y su costo; los remanentes se acumulan.</p>
  </section>
}
