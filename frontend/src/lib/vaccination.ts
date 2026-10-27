import type { VaccinationSelection } from './api.ts'

export const vaccinationContexts: Record<string, string> = { household: 'Hogar', school: 'Colegio', bus: 'Bus', market: 'Mercado', neighborhood: 'Barrio' }
export function vaccinationsAtDay(selections: VaccinationSelection[], day: number) {
  return selections.filter(row => row.day <= day).sort((a, b) => a.rank - b.rank)
}
export function selectionReason(row: VaccinationSelection): string {
  return row.tieBreak === 'nodeIdAsc'
    ? `Selección dirigida: puntuación ${row.score!.toLocaleString('es-EC', { maximumFractionDigits: 6 })} (suma de pesos de contactos activos hacia susceptibles al decidir). Posición ${row.rank}; prioridad de mayor puntuación, con menor identificador de persona para desempatar.`
    : `Selección aleatoria uniforme sin reemplazo, reproducible con la semilla de esta réplica. Posición ${row.rank} en el sorteo; no usa puntuación de contactos.`
}
