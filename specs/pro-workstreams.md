# PRO: trabajo separado de backend y frontend

Este documento divide la hoja [PRO-01..PRO-09](pro-roadmap.md) en dos frentes coordinables. El backend implementa las reglas, simulaciones, datos y contratos; el frontend puede diseñar y construir los flujos visuales en paralelo. La hoja de ruta PRO sigue siendo la fuente de alcance, dependencias y aceptación del producto.

## Acuerdos para trabajar en paralelo

- **Backend es la fuente de verdad** para validación, reglas de negocio, cálculos, estado de trabajos, resultados y cifras exportadas. El frontend no vuelve a calcular resultados científicos o financieros.
- **Frontend es responsable de la experiencia**: estados de carga y error, formularios, visualizaciones, accesibilidad, explicación de resultados y descarga/lectura de informes.
- Antes de conectar una capacidad se acuerda un contrato versionado: esquema de petición y respuesta, ejemplos válidos y de error, estados, límites, unidades y comportamiento cuando faltan datos.
- El frontend puede avanzar antes de que exista el endpoint usando fixtures locales rotulados **“datos de ejemplo”**. Esos fixtures no se presentan como simulaciones, datos epidemiológicos ni resultados reales y se eliminan o sustituyen al conectar el contrato.
- Cada entrega se integra por partes pequeñas. Un control visual no se marca terminado hasta que se conecte y maneje los estados reales del backend; un endpoint no se marca listo para producto hasta que el frontend pueda consumirlo y los errores sean comprensibles.
- Los contratos compartidos viven en `schemas/` y se documentan junto con la tarea correspondiente. Las nuevas rutas, nombres de campos o semánticas no se inventan solamente en el cliente.

## División por pendiente

| ID | Backend: lógica y contrato | Frontend: experiencia y diseño | Integración y dependencia |
|---|---|---|---|
| **P-01 Inventario diario** | **Hecho localmente.** Recibe y acumula entregas, aplica capacidad y presupuesto, registra uso/saldo por día, valida conservación y exporta `inventory.csv`. | **Hecho.** Permite editar entregas e inventario inicial y muestra llegadas, uso y saldo en la simulación/exportaciones. | Contrato `ResourceSchedule` y campos diarios. Mantener compatibilidad cuando el calendario no está habilitado. Ver [contrato P-01](p01-resource-schedule.md). |
| **P-02 Decisiones adaptativas** | **Verificado localmente.** `adaptive-v1`, decisiones, editor e historial conectados a resultados reales. Ver [contrato P-02](p02-adaptive-policy.md) y [evidencia UI](../docs/evidencia/p02-ui-2026-10-28.md). | Aceptar escenarios ascendentes/descendentes, recursos agotados y flujo completo; cerrar T-13..T-16. | Contrato y UI local disponibles; requiere aceptación integral. |
| **P-03 Trabajos Monte Carlo locales** | Backend y UI local conectados a `/v1/jobs`; navegador verificó completar R=2/R=31, recarga, ZIP y cancelación R=100. [Contrato P-03](p03-monte-carlo-jobs.md), [evidencia](../docs/evidencia/p03-ui-2026-10-28.md). | Cerrar estados de error y accesibilidad; AWS corresponde a P-04. | Contrato cliente y flujo visual implementados; faltan aceptación completa y P-04. Requiere modelo fijado. |
| **P-04 Miles de réplicas en AWS** | Diseñar IaC y despliegue Step Functions Distributed Map, ejecución por réplica, almacenamiento/manifiestos, roles mínimos, reintentos, cuotas y control de concurrencia/costo. | Reutilizar el flujo de P-03; mostrar cola, porcentaje o conteo real, duración/cancelación y aviso de límites/costo sin prometer una ETA inexacta. | Requiere P-03 y revisión de seguridad, cuotas y presupuesto antes de ejecutar cargas costosas. El frontend consume el mismo contrato de trabajos; AWS no debe filtrarse como una dependencia visual. |
| **P-05 Datos reales** | Obtener y normalizar fuentes epidemiológicas con procedencia, período, geografía, definiciones, faltantes y controles; publicar dataset versionado o razones documentadas de insuficiencia. | Diseñar selector/ficha del dataset con lugar, fechas, fuente y granularidad; mostrar limitaciones y diferenciar dataset real de preset ficticio. | Acordar la metadata pública del dataset. No fabricar una serie para completar la interfaz. Si no hay datos utilizables, presentar estado pendiente con explicación. |
| **P-06 Modelo calibrado** | Definir y versionar modelo/función de observación, parámetros y ajuste; separar entrenamiento y validación retenida; publicar métricas, incertidumbre y límites reproducibles. | Permitir seleccionar modelo/preset y presentar calibración, rango de incertidumbre, métricas, fuente y limitaciones en lenguaje sencillo. No insinuar exactitud fuera del período/geografía evaluados. | Requiere P-05. El contrato separa modelo ficticio de calibrado e incluye versiones y metadatos. Las cifras que muestra la UI proceden de la respuesta validada. |
| **P-07 Animación del mapa** | Proveer frames/eventos temporales reales, ordenados y ligados a réplica, política, día y versión del modelo. Documentar qué evento causal representa cada transición. | Sincronizar mapa/red, día, selección, reproducción, pausa, búsqueda, velocidad y movimiento reducido; pulir transiciones sin inventar contagios ni desplazamientos. | Acordar identidad y esquema de frames/eventos. Puede avanzar el diseño sobre fixtures etiquetados mientras se define el formato; la animación no cambia el resultado ni los hashes. |
| **P-08 Informe para el alcalde** | Crear una proyección de informe desde un experimento completo y validado, con agregados, costos, incertidumbre, procedencia, configuración y hash. Generar PDF determinista y comprobar que coincide con los datos fuente. | Diseñar plantilla legible, resumen ejecutivo, tablas/gráficos, explicación de términos y estados de previsualización/descarga; cuidar impresión y lectura en pantalla. | El contrato del informe identifica el experimento y sus versiones. Requiere resultados completos; no rellenar cifras ausentes ni ocultar pérdidas o incertidumbre. Puede iniciar con escenario ficticio debidamente identificado. |
| **P-09 Mapa geográfico y capa de agentes** | **Sin cambios.** No requiere endpoint nuevo: entrega IDs, casos iniciales, `graphHash` y frames representativos ya existentes. No escribe coordenadas ni campos geográficos en las respuestas. | **Verificado localmente.** Mapa OSM de Manta, trece polígonos residenciales versionados, posiciones deterministas, sincronización con día/política/réplica, selección accesible, reintento de teselas y atribución. | Presentación únicamente. Complementa a P-07 y no lo sustituye. Ver [P-09](p09-geographic-map.md). No consume el RNG del backend ni altera hashes; OSM no equivale a datos epidemiológicos. |

## Orden sugerido para cada incremento

1. **Acordar el contrato**: backend propone schema y semántica con un ejemplo de petición, respuesta y error; frontend revisa que cubra estados y contenido necesarios para diseñar.
2. **Avanzar en paralelo**: backend implementa lógica y validación; frontend crea el flujo visual con fixtures etiquetados. Ambos conservan el contrato como referencia.
3. **Conectar temprano**: reemplazar fixtures por la API cuando esté disponible, resolver discrepancias en el contrato y cubrir carga, vacío, error, límites y datos parciales.
4. **Cerrar junto**: confirmar criterios de aceptación de `pro-roadmap.md`, evidencia y documentación. Registrar como verificado solo lo probado de extremo a extremo; mantener por separado cualquier pendiente de AWS, datos reales o gasto.

## Ideas opcionales de dirección

Las ideas de vacunación estratégica, antídotos, cuarentena inteligente, fumigación, rastreo del paciente cero, saturación hospitalaria y aprendizaje por refuerzo siguen siendo opciones, no entregas comprometidas. Si se prioriza una, primero backend define mecanismo, observaciones, elegibilidad, efectos, costos y versión; frontend puede trabajar en el flujo con un fixture explícito, y la conexión se cierra contra ese contrato. Su estado y límites actuales están en la [hoja de ruta](pro-roadmap.md#4-ideas-de-dirección-opcionales-no-compromisos-de-entrega).

## Trazabilidad PRO-ID → código, contratos y pruebas

Esta tabla es la referencia para saber dónde vive cada pendiente y qué evidencia lo respalda. Si una feature no aparece con código y pruebas, permanece **no iniciada** aunque tenga diseño.

| ID | Backend | Frontend | Contrato | Pruebas |
|---|---|---|---|---|
| P-01 | `domain/configuration.py`, `simulation/engine.py`, `simulation/experiments.py`, `simulation/exports.py` | `ResourceScheduleEditor`, `ResourceInventory`, `lib/resource-schedule.ts` | `schemas/common.schema.json` (`resourceSchedule`) | `tests/test_resource_schedule.py`, `test_combined.py`, `test_exports.py`; `lib/scenario.test.ts` |
| P-02 | Backend `adaptive-v1` y editor/historial local conectados | Reglas, anillo, explicaciones y resultados por réplica | Contrato versionado disponible | `tests/test_combined.py`; [evidencia UI](../docs/evidencia/p02-ui-2026-10-28.md); falta aceptación completa |
| P-03 | Parcial; UI local conectada | Jobs reales, estados backend, cancelación, recuperación en sesión y exportación; faltan aceptar errores/accesibilidad y P-04 AWS | Backend `/v1/jobs` integrado | `frontend/src/pro/jobs-model.test.ts`; [evidencia UI](../docs/evidencia/p03-ui-2026-10-28.md) |
| P-04 | No iniciado | No iniciado | Sin jobs ni IaC | — |
| P-05 | No iniciado | No iniciado | Sin dataset versionado | — |
| P-06 | No iniciado | No iniciado | Sin modelo/preset calibrado | — |
| P-07 | Frames representativos en `simulation/experiments.py` y `exports.py` | `simulation-playback.ts`, `SimulationWorkspace`, `PreviewNetwork`, `ContactNetwork` | `schemas/common.schema.json` (`representative`) | `lib/simulation-playback.test.ts`; `tests/test_experiments.py` |
| P-08 | Parcial | HTML imprimible desde resultado backend validado; falta QA visual y PDF directo | Usa `CompareResponse`; sin afirmación de calibración | `frontend/src/lib/mayor-report.test.ts` |
| P-09 | Sin cambios; consume `preview`/`compare` | `GeographicMap`, `geographic-map.ts`, `geographic-agents-layer.ts`, `manta-geography.ts` | Sin endpoint nuevo; ver [P-09](p09-geographic-map.md) | `geographic-map.test.ts`, `geographic-agents-layer.test.ts`, `manta-geography.test.ts`, `simulation-playback.test.ts` |

Regla de mantenimiento: toda feature PRO nueva debe registrarse en [la hoja de ruta](pro-roadmap.md), aparecer en esta tabla con sus archivos reales y declarar contrato y pruebas. Una feature de solo presentación, como P-09, debe explicar por qué no altera modelo, hashes ni contratos.
