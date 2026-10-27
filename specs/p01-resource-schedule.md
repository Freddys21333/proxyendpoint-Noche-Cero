# P-01: entregas e inventario diario

Estado: **verificado localmente**. Contrato del 2026-10-27; referencia PRD PRO-2 y TRD §6.3. Amplía opcionalmente el modelo combinado, sin alterar el modo base ni `combined-educational-v1` sin calendario.

## Semántica acordada para este incremento

`configuration.intervention.combined.resourceSchedule` es opcional. Al activarlo incluye `modelVersion: daily-inventory-v1`, `vaccineDailyCapacity` (0..N), `initialBrigadeSupplies` (0..360000) y `deliveries` (hasta 512 filas de entrada). Cada entrega contiene `day`, `vaccines` y `brigadeSupplies`, enteros no negativos; día entre 0 y T. Se suman filas del mismo día y se ordenan por día al normalizar. El inventario inicial de vacunas sigue siendo `intervention.vaccines`; cada insumo de brigada permite atender una persona durante un día, sujeto a la capacidad diaria existente.

Las entregas llegan antes de decidir las acciones del día; los saldos no perecen y se acumulan. El día 0 admite llegadas; el día T también, pero en T no se consume para brigadas/cierres porque no hay intervalo posterior. No hay cancelaciones, caducidad, financiación adicional ni nuevas clases de recursos en este incremento. El cierre usa presupuesto y calendario, sin inventario consumible ficticio.

La recepción no cuesta dinero: los costos actuales se pagan al usar dosis o insumos, una sola vez. Recibir recursos no cambia el presupuesto. Un recurso disponible sin presupuesto no se consume; presupuesto sin existencias no permite actuar. Se conserva la prioridad diaria vacunas → cierre → brigadas y las tres políticas comparten inventario inicial, calendario y presupuesto.

Con calendario activo, se vacuna cada día desde `interventionDay` hasta T, limitado por existencias, capacidad, presupuesto y susceptibles sin dosis previa. Cada persona recibe como máximo una dosis en el experimento, incluso si fue inefectiva; así se conservan selección única por persona y costo de dosis fallidas. Las prioridades/sorteos se evalúan sobre el estado del día con los mismos algoritmos existentes; P-02 sigue pendiente. Los ranks se numeran globalmente entre días. Sin calendario continúa la vacunación única y capacidad de brigadas del contrato anterior.

Inicial más entregas de vacunas no puede superar N; los insumos acumulados de brigadas no pueden superar 360000. Son límites de esta versión para mantener tamaños y métricas compatibles, no estimaciones logísticas reales. Entradas incompatibles se rechazan, sin recortar cantidades o fechas silenciosamente.

## Registro y aceptación

Cada día registra `vaccinesDeliveredToday`, `vaccinesReceivedTotal` (incluye inicial), `vaccinesUsedToday`, `vaccinesAvailable`, y equivalentes `brigadeSuppliesDeliveredToday`, `brigadeSuppliesReceivedTotal`, `brigadeSuppliesUsedToday`, `brigadeSuppliesAvailable`. Recepción acumulada = inicial + entregas hasta el día; saldo = recepción acumulada − consumo acumulado. Se exportan por réplica/política y entran en el hash científico, JSON y CSV de inventario. La cantidad final de vacunas sin usar incluye todas las entregas válidas del horizonte, no recursos futuros fuera de él.

Pruebas previstas: normalización e independencia del orden de entregas; ninguna utilización anticipada; acumulación y conservación; días 0/T; varias entregas el mismo día; cero inventario o presupuesto; capacidades; ninguna segunda dosis ni doble cargo; negativos, horizonte y límites inválidos; registro manipulado; exportación/reproducción y hashes anteriores sin calendario. La UI permite añadir/quitar entregas y consultar el saldo físico del día real, separado del presupuesto y de dosis futuras.


## Evidencia de verificación

[Registro P-01](../docs/evidencia/p01-inventario.md). Ciclo TDD: prueba inicial rechazada por campo desconocido; después normalización y pruebas de consumo/conservación pasan. El incremento conserva las tres referencias base y las tres combinadas sin calendario. El alcance es local, sin recursos AWS nuevos ni calibración sanitaria.
