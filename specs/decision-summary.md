# Resumen de decisión para UX

Actualización 28/10/2026: `conclusion` opcional (texto del backend, máximo 6000
caracteres) añade una lectura de impacto/costos/gasto/beneficio. No cambia criterio
ni optimiza presupuesto. Se excluye del hash científico como el resto de esta
proyección; cuando existe se comprueba al cargar/reproducir. Se conserva validación
exacta de todos los campos antiguos cuando el texto no está presente. No alterar
la redacción generada en futuras versiones sin preservar su compatibilidad.
[Evidencia](../docs/evidencia/ajustes-comparacion-controles-2026-10-28.md).

Estado: **verificado localmente**, 2026-10-27. [Evidencia](../docs/evidencia/resumen-decision-2026-10-27.md). Alcance autorizado: completar datos explicativos para UX-02/03/04/05, RF-12/13/19. Sin alterar motor, presupuesto, recomendación ni T-22. Este incremento no cierra todo el backlog de UX ni la aceptación humana integral.

## Contrato

`CompareResponse.decisionSummary` es una proyección aditiva `decision-summary-v1`, presente en nuevas exportaciones y respuestas compare/jobs. Es opcional en el esquema para conservar JSON antiguos. Se excluye del hash científico, se recalcula y comprueba cuando está presente, y se contrasta en reproducción. No se inventa el resumen al cargar un JSON antiguo; la UI informa su ausencia y solicita nueva ejecución.

ZIP/CSV conserva archivos y columnas existentes; no se añade un CSV nuevo en este incremento. El benchmark de exportación informa si excluye la proyección aditiva al contrastar el contenido de un JSON legado.

Por política: infectados medios, porcentaje de población, evitados frente a no intervenir (diferencia de medias), reducción relativa porcentual, dosis medias usadas, dosis totales recibidas, presupuesto, gasto y saldo medios, costo por evitado y evitados por USD 100. Moneda en centavos sin redondear; redondeo solo al presentar. Reducción = 100 × evitados / media sin intervención; referencia cero → null. Costo por evitado = gasto medio / evitados medios, solo si evitados >0; evitados por USD 100 requiere además gasto >0. Con pérdidas se conservan evitados/reducción negativos y cocientes null. Sin costos configurados, moneda null, no cero ficticio.

Decisión: criterio vigente de menor media de infectados acumulados; políticas empatadas en la menor media y confianza original. Cuando hay una única menor media, se incluyen las políticas de la siguiente media y su diferencia absoluta respecto de la primera; un empate en la mejor posición produce alternativa null. Se reutiliza la tolerancia vigente de 1e-9; no se convierte una diferencia descriptiva en recomendación respaldada ni se introduce optimización económica.

Omisiones: contar motivos ya registrados por la política adaptativa habilitada; unidad **réplica-día**, contando cada motivo como máximo una vez por fila. No son personas ni acciones financiables calculadas de nuevo. Sin observación adaptativa habilitada → null, distinto de lista vacía observada. Se conservan registros diarios para inspección; la UI traduce los códigos existentes.

## Aceptación y pruebas

- Comparar cifras con réplicas reales, registros de gasto y configuración; no mutar entradas ni modificar hashes/semillas.
- Cero referencia, empate, pérdida, presupuesto cero, inventario y ausencia de costos: sin NaN/infinito ni beneficio fabricado.
- Rechazar resumen manipulado y conservar compatibilidad con JSON sin el campo; reproducción de ambos.
- Cliente valida estructura y finitud del resumen si existe; UI usa los datos del backend, sin calcular resultados económicos o científicos nuevos.
- Nuevas respuestas compare/jobs, exportación y PDF conservan contratos existentes; no ampliar límites de ejecución ni invocar AWS.
- Pruebas existentes y nuevas, Ruff/mypy, frontend test/tipos/build, integración HTTP real y evidencia antes del cierre.
