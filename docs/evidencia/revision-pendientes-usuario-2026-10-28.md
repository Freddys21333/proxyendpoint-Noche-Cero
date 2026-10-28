# Revisión de los pendientes del usuario

Fecha: 2026-10-28. Contrasta la lista compartida con el código, pruebas y evidencia disponibles. “Implementado” describe capacidad local; no equivale a aceptación completa ni a validación científica.

## Correcciones y pruebas solicitadas

| Punto | Estado comprobable | Qué falta |
|---|---|---|
| Optimizar tiempos de carga | El build divide ComparisonResults, mapa y espacio PRO en chunks. El artefacto base más reciente conocido pesa 122 KB gzip; no se ha medido Core Web Vitals. | Medir LCP/INP/CLS y carga móvil en una sesión limpia. El motor por defecto sigue en 44,3 s backend frente a objetivo ≤25 s; esto es tiempo de cálculo, distinto de carga web. |
| SEO | `lang="es"` y título ya existían; se añadieron description, theme-color y Open Graph/Twitter en `frontend/index.html`, con una prueba de contrato. | No hay dominio público confirmado: no añadir canonical/og:url ficticios ni sitemap absoluto. Falta revisar indexabilidad/rendimiento en el host público cuando exista. |
| Colores fuera de la paleta | El CSS del espacio PRO contenía una paleta clara verde/blanca paralela. Se migraron sus colores a tokens del tema Noche Cero y tokens semánticos oscuros. | Ejecutar auditoría formal de contraste y revisar estados de éxito/aviso/error en tamaños y navegadores objetivo. |
| Centrar el mapa donde se ven los nodos | La vista de mapa inicia en el centro de Manta (`-0.9677, -80.7089`) y encuadra los agentes con `fitBounds`; hay pruebas de cámara, límites y recentrado en `frontend/src/lib/geographic-map.test.ts`. | No parece pendiente de implementación. Repetir aceptación visual con varias densidades de agentes y móvil; la capa sigue siendo geográfica/sintética. |
| Varias intervenciones, costos y presupuesto total | P-01 y `combined-educational-v1` implementan vacunas, cierre temporal de una capa, brigadas simuladas, costos y presupuesto compartido; hay evidencia local P-01. | Ejecutar una matriz integrada de escenarios, agotamiento de saldo, entregas e igualdad de recursos entre políticas; completar aceptación humana. Costos son supuestos educativos, no tarifas reales. |
| SEIR en red, K vacunas y tres estrategias | Implementados y cubiertos por backend: `none`, `random`, `targeted`, transiciones SEIR y dosis limitadas. | Cerrar gate científico T-22; la matriz v1 está ejecutándose. No afirmar que dirigida gana antes del informe del gate. |
| Curva de contagios y cuántos se salvan | Comparación real muestra curvas, acumulados y diferencias pareadas; “salvados” se presenta como infectados evitados contra referencia y admite valores negativos. | Revisar casos de empate/pérdida/error/parcial en E2E y validar el lenguaje con usuarios. |
| Cambiar contagio, vacunas y origen | Formulario editable y preview real del backend existen; conserva entradas ante error y descarta resultados obsoletos. | Aceptación completa de T-13..T-16, teclado, accesibilidad y prueba moderada siguen pendientes. |

## Funciones PRO

| Punto | Estado comprobable | Qué falta |
|---|---|---|
| Recursos por día y decisiones adaptativas | P-01 tiene entregas/inventario; P-02 tiene política versionada, editor e historial de decisiones reales por réplica. | El registro de P-02 solo expone la política educativa disponible. Aceptar escenarios ascendentes/descendentes, recursos agotados y experiencia completa. Evidencia [P-02 UI](p02-ui-2026-10-28.md). |
| Vacunas, cuarentenas, cierres, fumigación, antídotos y campañas | Vacunas, cierre de una capa de contactos y brigadas de reducción educativa están disponibles. | No existe modelado de fumigación/vector, antídotos, campañas ni cuarentena individual. Definir mecanismo y contrato antes de agregarlos; no etiquetar brigadas actuales como fumigación. |
| Miles de simulaciones en AWS | `/v1/jobs` y cola Monte Carlo local existen; la pantalla PRO aún contiene fixtures. | Conectar UI a trabajos reales y completar P-04 Distributed Map/S3/IAM/cuotas/costos; AWS queda para la última fase y no se despliega aquí. |
| Calibración con dengue en Manabí | Fuentes candidatas están investigadas; no hay dataset aceptado ni calibración. | Inspeccionar condiciones/licencia y esquema, agregar fuente trazable, normalizar y verificar totales; después diseñar modelo que represente transmisión vectorial. Ver [investigación P-05](p05-investigacion-fuentes-2026-10-28.md). |
| Mapa animado | Reproducción real por día/réplica y capas mapa/red ya existen. | P-07: aceptar sincronización de mapa/red/curva/tabla, transiciones, pausa/seek/velocidad, movimiento reducido, accesibilidad y rendimiento. |
| Informe sencillo para alcaldía | No hay exportación de informe PDF determinista. | P-08: construir desde un experimento aceptado, con cifras trazables, costos, incertidumbre, empates/pérdidas, fuente, hash y límites. |
| Ideas de dirección | Hay vacunación dirigida, prioridad adaptativa por anillo, selección de origen/nodo y cierre de capa. | No hay reparto de antídotos, cuarentena inteligente por persona, modelo de mosquito, rastreo causal del paciente cero ni saturación hospitalaria. Tratar cada idea como modelo/contrato nuevo. |

## Costos y operación

`docs/costos.md` contiene evidencia histórica provisional de un AWS Budget de USD 20/mes y ahora separa ese límite de una estimación. El costo mensual por arquitectura aún no está calculado y el gasto real del evento no está confirmado. Las capturas antiguas de USD 0 no demuestran que el gasto final fuera cero.

## Resultado de esta revisión

Ya estaban implementados varios puntos funcionales (SEIR, formularios, curva, mapa, costos de intervención e inventario por días). Las brechas de UI P-02, SEO básico y colores del espacio PRO se están cerrando en esta iteración. Permanecen como dependencias principales T-22, aceptación E2E/humana, importación de fuente P-05, UI de jobs, validación del mapa animado, PDF y fase AWS final.
