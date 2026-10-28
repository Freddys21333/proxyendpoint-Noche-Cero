# Revisión de los pendientes del usuario

Fecha: 2026-10-28. Contrasta la lista compartida con el código, pruebas y evidencia disponibles. “Implementado” describe capacidad local; no equivale a aceptación completa ni a validación científica.

## Correcciones y pruebas solicitadas

| Punto | Estado comprobable | Qué falta |
|---|---|---|
| Optimizar tiempos de carga | El build divide ComparisonResults, mapa y espacio PRO en chunks. El artefacto base más reciente conocido pesa 122 KB gzip; no se ha medido Core Web Vitals. | Medir LCP/INP/CLS y carga móvil en una sesión limpia. El motor por defecto sigue en 44,3 s backend frente a objetivo ≤25 s; esto es tiempo de cálculo, distinto de carga web. |
| SEO | `lang="es"` y título ya existían; se añadieron description, theme-color y Open Graph/Twitter en `frontend/index.html`, con una prueba de contrato. | No hay dominio público confirmado: no añadir canonical/og:url ficticios ni sitemap absoluto. Falta revisar indexabilidad/rendimiento en el host público cuando exista. |
| Colores fuera de la paleta | El CSS del espacio PRO contenía una paleta clara verde/blanca paralela. Se migraron sus colores a tokens del tema Noche Cero y tokens semánticos oscuros. | Ejecutar auditoría formal de contraste y revisar estados de éxito/aviso/error en tamaños y navegadores objetivo. |
| Centrar el mapa donde se ven los nodos | La vista de mapa inicia en el centro de Manta (`-0.9677, -80.7089`) y encuadra los agentes con `fitBounds`; hay pruebas de cámara, límites y recentrado en `frontend/src/lib/geographic-map.test.ts`. | No parece pendiente de implementación. Repetir aceptación visual con varias densidades de agentes y móvil; la capa sigue siendo geográfica/sintética. |
| Varias intervenciones, costos y presupuesto total | P-01 y `combined-educational-v1` implementan vacunas, cierre temporal de una capa, brigadas simuladas, costos y presupuesto compartido. **20 pruebas focalizadas pasan**, incluyendo costo diario/acumulado, saldo, entregas, consumo y reproducción. | La matriz de motor está automatizada; falta probar combinaciones desde la UI y completar aceptación humana. Costos son supuestos educativos, no tarifas reales. Ver [evidencia P-01](p01-pruebas-combinadas-2026-10-28.md). |
| SEIR en red, K vacunas y tres estrategias | Implementados y cubiertos por backend: `none`, `random`, `targeted`, transiciones SEIR y dosis limitadas. T-22 v1 aprobado sobre cinco raíces y 150 réplicas primarias; medias pareadas `none − targeted = 354.4` y `random − targeted = 215.9`. | La aceptación E2E/humana sigue pendiente. El gate no implica que `targeted` gane en toda réplica ni escenario. Ver [informe T-22](t22-v1-ejecucion.md). |
| Curva de contagios y cuántos se salvan | Comparación real muestra curvas, acumulados y diferencias pareadas; “salvados” se presenta como infectados evitados contra referencia y admite valores negativos. | Revisar casos de empate/pérdida/error/parcial en E2E y validar el lenguaje con usuarios. |
| Cambiar contagio, vacunas y origen | Formulario editable y preview real del backend existen; conserva entradas ante error y descarta resultados obsoletos. | Aceptación completa de T-13..T-16, teclado, accesibilidad y prueba moderada siguen pendientes. |

## Funciones PRO

| Punto | Estado comprobable | Qué falta |
|---|---|---|
| Recursos por día y decisiones adaptativas | P-01 tiene entregas/inventario; P-02 tiene política versionada, editor e historial de decisiones reales por réplica. | El registro de P-02 solo expone la política educativa disponible. Aceptar escenarios ascendentes/descendentes, recursos agotados y experiencia completa. Evidencia [P-02 UI](p02-ui-2026-10-28.md). |
| Vacunas, cuarentenas, cierres, fumigación, antídotos y campañas | Vacunas, cierre de una capa de contactos y brigadas de reducción educativa están disponibles. | No existe modelado de fumigación/vector, antídotos, campañas ni cuarentena individual. Definir mecanismo y contrato antes de agregarlos; no etiquetar brigadas actuales como fumigación. |
| Miles de simulaciones en AWS | `/v1/jobs`, cola Monte Carlo local y UI conectada existen. En navegador se verificó R=2, R=31, recarga, ZIP y cancelación R=100. | AWS Distributed Map/S3/IAM/cuotas/costos sigue pendiente; AWS queda para la última fase. Faltan aceptación de errores y accesibilidad de la UI. Ver [evidencia P-03 UI](p03-ui-2026-10-28.md). |
| Calibración con dengue en Manabí | Se inspeccionaron temporalmente el esquema y los hashes de los dos XLSX OBSALUD; no se importaron filas ni se modificó el modelo. Una hoja contiene agregados semanales; otra incluye campos de detalle por caso. | No hay licencia explícita ni permiso de reutilización confirmado; P-05 sigue abierto y P-06 bloqueado. Resolver uso, agregar solo datos compatibles, validar contra MSP y diseñar un modelo vectorial antes de calibrar. Ver [investigación P-05](p05-investigacion-fuentes-2026-10-28.md). |
| Mapa animado | Reproducción real por día/réplica y capas mapa/red ya existen. | P-07: aceptar sincronización de mapa/red/curva/tabla, transiciones, pausa/seek/velocidad, movimiento reducido, accesibilidad y rendimiento. |
| Informe sencillo para alcaldía | Se añadió descarga de informe HTML imprimible desde una comparación validada, con resultados, incertidumbre, costos educativos, hash y límites del escenario ficticio. Tiene pruebas de escape y fidelidad de campos. | P-08 sigue parcial: falta revisión visual con resultados reales en navegador y cerrar un PDF directo/reproducible. No hay informe calibrado con dengue. |
| Ideas de dirección | Hay vacunación dirigida, prioridad adaptativa por anillo, selección de origen/nodo y cierre de capa. | No hay reparto de antídotos, cuarentena inteligente por persona, modelo de mosquito, rastreo causal del paciente cero ni saturación hospitalaria. Tratar cada idea como modelo/contrato nuevo. |

## Costos y operación

`docs/costos.md` contiene un subtotal de planificación: USD 1,10/mes para la base y USD 2,26–4,93 con 10.000 réplicas PRO/mes, más S3; usa volúmenes asumidos, una tarifa Step Functions de referencia aún no validada en Ohio y duración Lambda no medida. El gasto real del evento sigue sin confirmarse. El Budget de USD 20 es un umbral de alerta, no la estimación. Las capturas antiguas de USD 0 no demuestran que el gasto final fuera cero.

## Resultado de esta revisión

Ya estaban implementados varios puntos funcionales (SEIR, formularios, curva, mapa, costos de intervención e inventario por días). Se cerraron la UI focalizada de P-02, UI local de jobs P-03 en flujos principales, metadatos SEO básicos, paleta del espacio PRO y el gate T-22 v1. Permanecen el objetivo de rendimiento backend ≤25 s, aceptación E2E/humana, importación de fuente P-05, aceptación completa de errores/accesibilidad de jobs, validación del mapa animado, PDF y fase AWS final.
