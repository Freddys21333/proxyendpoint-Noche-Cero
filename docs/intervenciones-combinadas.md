# Intervenciones combinadas y presupuesto educativo

Estado: incremento funcional PRO-1 y parte de PRO-2, solicitado explícitamente el 2026-10-27. No implica aprobar la base ni completar todo el alcance PRO. Los costos y efectos editables fueron autorizados como supuestos educativos por el usuario. P-01 añade opcionalmente entregas diarias e inventario: [contrato y evidencia](../specs/p01-resource-schedule.md). Calibración real, planificación óptima y estrategia adaptativa completa PRO-3 siguen pendientes.

## Qué significa y qué aporta el PDF

El PRD §4.2 define vacunas, cierre temporal de una capa y brigadas simuladas, junto con costos unitarios y presupuesto total. El aporte de Finanzas y Gestión Comercial, §4, propone comparar beneficio con el mismo presupuesto y mostrar costo por persona protegida. Sus ejemplos monetarios son explícitamente hipotéticos: no establecen tarifas ni efectos del modelo. En este proyecto el beneficio mostrado es la diferencia de infectados acumulados frente a no intervenir, no el número de dosis ni una garantía de personas protegidas. Los costos de AWS son un cálculo separado en docs/costos.md.

## Contrato y semántica

Activación opcional en `configuration.intervention.combined`. Ausente conserva exactamente el modo base y sus hashes de referencia. El submodelo queda identificado por `modelVersion=combined-educational-v1`, incluido en el JSON y su hash. Montos enteros en centavos USD, sin redondeos acumulados del saldo; la interfaz permite editar dólares con dos decimales. Presupuesto máximo: USD 1.000.000; costos unitarios: USD 0,01 a 10.000. El presupuesto puede ser cero.

Supuestos iniciales editables: presupuesto USD 2.000; dosis USD 10; cierre USD 100 por día; brigada USD 2 por persona atendida y día, hasta 10 personas diarias, reducción de transmisión del 30 %. Cierre y brigadas comienzan en día 0 y duran hasta 7 intervalos, ajustados al horizonte al activar el modo. Desactivar elimina el submodelo. El calendario opcional P-01 extiende la vacunación a días sucesivos con capacidad y existencias limitadas; sin calendario, las reglas siguientes conservan su significado original. No se ajustan silenciosamente calendarios existentes al reducir el horizonte: se informa error para corregirlos.

Un día d registra el estado tras la vacunación de ese día; los cierres y brigadas de d afectan el intervalo d→d+1. No se pagan intervalos después del último día T. Los calendarios son inicio incluido y fin excluido; duración cero desactiva una acción. Cada día se atiende, por orden: vacunación cuando corresponde, cierre y brigadas. No hay reserva automática para dosis de días futuros.

- Vacunas: cada dosis asignada consume inventario y su costo, incluso si falla. Se limita la cantidad por susceptibles, dosis y saldo disponible; se mantienen el sorteo y puntuación del modo base.
- Cierre: suprime todos los contactos del tipo elegido durante ese intervalo, solo si hay contactos activos y puede financiarse el día completo. No cambia la topología ni IDs del grafo exportado. Aleatoria y Dirigida reciben el mismo calendario de cierre.
- Brigadas: atención diaria de susceptibles, elegidos al azar o por la misma puntuación de contactos activos entre susceptibles de la estrategia base. Reducen una sola vez el peso de un contacto si cualquiera de sus extremos fue atendido. No curan, inmunizan ni cambian S/E/I/R directamente. Se asignan solo tantas atenciones como permita el saldo. Las prioridades excluyen la capa cerrada.
- Sin intervención: comparte red, condiciones iniciales y potenciales aleatorios; no consume presupuesto ni ejecuta acciones.

Las brigadas tienen un flujo aleatorio independiente `combined-brigades-v1`. Nunca se accede a potenciales futuros para decidir. Cierre y reducción conservan IDs y tamaño de las matrices de potenciales. No se modela movilidad, fumigación física, vectores ni domicilios; es una abstracción educativa de reducción temporal de contacto/transmisión.

## Resultados, comparación y reproducción

Cada fila diaria combinada añade `spentTodayCents`, `spentCents`, `budgetRemainingCents`, `closedContext`, `brigadesActive` y `brigadeNodeIds`. Backend y cliente comprueban conservación del presupuesto; se incluyen en los hashes de resultado/experimento y la reproducción. El ZIP incorpora `budget.csv`, además de los archivos base. El JSON completo contiene configuración y registro diario por réplica y estrategia.

La simulación muestra el saldo de la réplica/día/estrategia elegidos. La vista de red omite los contactos cerrados. Comparación muestra gasto y saldo medios, contagios evitados frente a no intervenir, costo por contagio evitado (cociente de medias) y evitados por USD 100 gastados. Si no existe mejora positiva, el costo por evitado dice "No aplica"; no se fabrica un beneficio ni se divide por cero. El presupuesto disponible es igual entre políticas, pero el gasto efectivo puede diferir. La recomendación principal conserva su criterio epidemiológico, no promete un óptimo financiero.

Pruebas: saldo exacto y no negativo, Sin intervención sin gasto, presupuesto cero, dosis limitadas por costo, dosis fallidas pagadas, cierre y brigada al 100 %, conservación de IDs/potenciales, validación de calendarios y costos, exportación y reproducción combinadas. Las tres referencias funcionales base conservaron sus hashes previos al activar esta extensión opcional.
