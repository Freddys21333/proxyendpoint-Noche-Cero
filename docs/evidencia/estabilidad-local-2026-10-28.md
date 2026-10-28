# Estabilidad local — 2026-10-28

**Resultado: recorrido local revisado y utilizable**, con dos correcciones preventivas en trabajos PRO y una corrección de recurso estático. [Guía para probar](../probar-local.md), [matriz y hashes](estabilidad-local-2026-10-28.json).

La prioridad autorizada es local → UX → AWS por partes. Esta revisión no se usa para exigir el cierre previo de calibración nueva, miles de réplicas ni jurado. Tampoco convierte una comprobación automática en aceptación humana de T-13..T-16/T-23.

## Qué se corrigió

1. PRO mostraba un máximo global de 100 y dejaba enviar las 30 réplicas predeterminadas para la red N1000/T90; el servidor responde 422 porque supera 50 millones de arista-día-réplicas. Ahora el máximo refleja la red y el límite publicado por el backend (9 para esa red), muestra error antes de enviar y ofrece cantidades rápidas válidas. **No recorta silenciosamente** las réplicas escritas ni aumenta el límite.
2. La semilla editable de PRO podía no corresponder al hash de la vista previa. Ahora se muestra la semilla previsualizada como solo lectura; para otra, se indica editar el simulador y consultar la red. La validación detecta discrepancias. Se comprobó realmente el cambio de semilla a 12345 desde el simulador y su uso en PRO.
3. Se añadió favicon SVG local y se eliminó la etiqueta theme-color duplicada. La carga nueva ya no solicita un icono inexistente.

El cálculo del máximo es validación del contrato de carga publicado, no ciencia epidemiológica ni finanzas. El backend sigue siendo autoridad y vuelve a validar toda solicitud. No se cambió backend, motor, RNG, datos, esquemas ni protocolo T-22.

## Matriz ejecutada contra API real

| Caso | Resultado observado |
|---|---|
| Sesión limpia y escenario predeterminado | Preview y comparación N1000/T90/R30 completos; frames y hash c37de168… conservados; cero pageErrors. |
| Exportación | Descargas reales de JSON, ZIP/CSV, PDF y HTML desde navegador. ZIP pasa CRC y su manifiesto coincide con JSON; PDF tiene cabecera válida y HTML cita el hash. |
| Reproducción | JSON predeterminado y los dos casos de presupuesto/inventario reproducidos por CLI en procesos nuevos con el mismo hash. |
| Presupuesto agotado | N60/T7/R2, plan adaptativo, presupuesto 0, 10 dosis iniciales y 5 llegadas el día 2: gasto 0, dosis asignadas 0 y 15 disponibles al final. |
| Sin susceptibles elegibles | N60/T7/R2, 60 dosis, capacidad 60 y presupuesto suficiente: random/targeted asignan 59 dosis, S=0 desde día 0 y queda 1 dosis sin usar. |
| PRO completo y sesión | Se creó R2, se leyó resultado y se recuperó el trabajo tras recargar. Las capacidades permanecen en sessionStorage y no se registran en la evidencia. |
| Cancelación/reintento | Vista previa N400/T90, semilla 12345, máximo 44: trabajo cancelado, reintento completado y resultado leído con esa configuración. |
| Entrada inválida | Población 49 queda visible; la consulta no se envía y la comparación anterior queda deshabilitada. |
| Falla de conexión | Se inyectó un abort de la petición preview, sin inventar una simulación. El error es recuperable, conserva campos y la nueva consulta real responde 200. |
| Pantalla estrecha y teclado | Mapa, comparación y PRO a 390 px con scrollWidth=390; Tab/Enter en salto al contenido enfoca main-content. No sustituye prueba táctil/lector de pantalla. |
| Puertos habituales | Se iniciaron API :8000 y Vite :5174; smoke HTTP y guion real de navegador pasan también con el proxy habitual. |

El caso sin elegibles se ejecutó mediante cobertura completa válida. Un intento inicial de configurar I0=60 fue bloqueado correctamente por el máximo de 20 del formulario; no se cambió ese límite. No se presenta el timeout de aquel guion como fallo del producto.

## Pruebas y herramientas

- Backend antes de tocar código: **510 pruebas**, Ruff y mypy correctos. No hay cambios posteriores de backend.
- Frontend después: **151 pruebas**, tipos y build correctos.
- TDD del ajuste de trabajos: prueba nueva roja (100 vs 9) y después verde, junto con comprobación de semilla, preservación de entradas y red imposible dentro del límite.
- Flujos HTTP existentes: verify_local_integration (manual, sin vacunas, sin transmisión), verify_adaptive_integration y verify_jobs_flow pasan; este último comprueba también token, idempotencia, cancelación y rechazo del resultado parcial.
- Guion versionado de navegador: `scripts/verify_local_stability.browser.js`; en Edge real y contra API real, cuatro descargas, reproducción, trabajo completo, campos inválidos y comparación móvil; **pageErrors=[]**.
- Guiones adicionales/archivos crudos en `.tools/local-stability/`, ignorados por Git. La evidencia JSON versiona sus tamaños, hashes y resultados. Las fallas HTTP esperadas del caso negativo previo y del abort controlado no se confunden con excepciones JS inesperadas.
- Skill aplicada: error-handling-ux para prevención, comunicación y recuperación; Playwright CLI para interacción real. No se instalaron dependencias de aplicación nuevas ni se usó AWS.

## Qué queda para después

No se encontraron bloqueos en los casos revisados. Quedan mejoras de comprensión/UX y aceptación humana de accesibilidad, tiempo de uso y dispositivos táctiles; no se marcaron esas tareas completas. La impresión nativa de HTML no se evaluó manualmente (sí se descargaron PDF y HTML). OSM depende de red externa, con alternativa Red. Los jobs continúan en memoria y se pierden al reiniciar la API; tienen límites de retención/cola. T-23 externo y staging/AWS siguen separados.

Implementación: `9d1f399090c0344ea6580e542b15318a5a3676ea`. Las comprobaciones se ejecutaron sobre ese contenido antes de publicarlo.
