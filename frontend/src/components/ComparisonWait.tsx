import { useEffect, useState } from 'react'
import type { ConfigurationInput } from '@/lib/api'

const number = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 })
const origins: Record<string, string> = { random: 'Aleatorio', household: 'Hogar', school: 'Colegio', bus: 'Ruta de bus', market: 'Mercado', neighborhood: 'Barrio', node: 'Persona específica' }

export function ComparisonWait({ configuration }: { configuration: ConfigurationInput }) {
  const [started] = useState(() => performance.now())
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(Math.floor((performance.now() - started) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [started])
  const { scenario, intervention } = configuration
  return <section className="comparison-wait" aria-label="Estado de la comparación">
    <p role="status">Comparación en curso. Esperando la respuesta del servidor…</p>
    <p className="elapsed-time">Tiempo transcurrido: <strong role="timer" aria-live="off">{Math.floor(seconds / 60)} min {seconds % 60} s</strong></p>
    <p>El servidor entrega los resultados al terminar; no informa fases ni avance intermedio. El tiempo transcurrido no indica cuánto falta.</p>
    <h2>Configuración enviada</h2>
    <dl className="submitted-configuration">
      <div><dt>Población</dt><dd>{number.format(scenario.populationSize)} personas</dd></div>
      <div><dt>Duración</dt><dd>{scenario.days} días</dd></div>
      <div><dt>Réplicas</dt><dd>{configuration.repetitions} repeticiones por estrategia</dd></div>
      <div><dt>Semilla</dt><dd>{configuration.rootSeed}</dd></div>
    </dl>
    <details><summary>Otros parámetros del escenario</summary>
      <dl className="submitted-configuration">
        <div><dt>Origen del brote</dt><dd>{origins[scenario.origin.kind] ?? scenario.origin.kind}{scenario.origin.value !== null ? ` ${scenario.origin.value}` : ''}</dd></div>
        <div><dt>Facilidad de contagio</dt><dd>{number.format(scenario.beta * 100)} de 100</dd></div>
        <div><dt>Casos iniciales</dt><dd>{scenario.initialInfectious} personas</dd></div>
        <div><dt>Progresión diaria</dt><dd>{number.format(scenario.sigma * 100)} %</dd></div>
        <div><dt>Recuperación diaria</dt><dd>{number.format(scenario.gamma * 100)} %</dd></div>
        <div><dt>Dosis iniciales</dt><dd>{intervention.vaccines} dosis</dd></div>
        <div><dt>Eficacia</dt><dd>{number.format(intervention.vaccineEfficacy * 100)} %</dd></div>
        <div><dt>Día de vacunación</dt><dd>Día {intervention.interventionDay}</dd></div>
        <div><dt>Intervenciones combinadas</dt><dd>{intervention.combined ? 'Activadas' : 'Desactivadas'}</dd></div>
      </dl>
    </details>
    <p>Se comparan Sin intervención, Aleatoria y Dirigida con la misma población. Puedes cancelar; tus parámetros se conservan.</p>
  </section>
}
