# P-02: política adaptativa observable

Estado: **backend, contrato cliente y UI verificados localmente**. El cliente acepta el contrato, exporta sus registros, ofrece editor de la variante, etiqueta la política y presenta el historial diario de decisiones. La aceptación humana integral de T-13..T-16 sigue abierta. Referencia: PRO-3, P-01 y [división de trabajo](pro-workstreams.md). Evidencia UI: [p02-ui-2026-10-27](../docs/evidencia/p02-ui-2026-10-27.md).

## Contrato vigente

Configuración opcional `intervention.combined.adaptiveStrategy`:

```json
{
  "modelVersion": "adaptive-policy-v1",
  "enabled": true,
  "closureInfectionThreshold": 0.05,
  "reopenInfectionThreshold": 0.02,
  "ringVaccinationPriority": true
}
```

Los umbrales son fracciones finitas 0..1; reapertura no puede superar cierre. `enabled` omitido significa true. El objeto requiere versión, ambos umbrales y prioridad de anillo. Las políticas del contrato continúan `none`, `random`, `targeted`; únicamente `targeted` con esta configuración habilitada usa la variante adaptativa versionada. Comparaciones y exportaciones conservan esa configuración para identificarla. No sustituir la etiqueta de la variante por la dirigida fija sin explicar la diferencia.

Omitir el objeto mantiene el comportamiento y la estructura de resultados anteriores. Configurarlo con `enabled:false` conserva las acciones fijas y agrega registros inactivos; por incluir una configuración distinta y esos registros, no promete el mismo hash que omitirlo.

## Observación y orden diario

Se reciben entregas, se aplican las transiciones del intervalo anterior y se observa el estado del día. La primera versión usa I/N, contactos activos, elegibilidad S e inventario/presupuesto; no implementa una regla de tendencia de casos nuevos ni aprendizaje por refuerzo. Observar los estados individuales completos es un supuesto educativo, no un sistema real de diagnóstico.

1. Cierre: si estaba abierto y I/N >= umbral de cierre, solicitar cierre cuando el presupuesto observado lo permite. Si estaba solicitado y I/N < umbral de reapertura, reabrir. Si ya no alcanza el presupuesto, retirar la solicitud. La histéresis se conserva entre días.
2. Vacunas: respetar día de intervención y, con P-01, capacidad/inventario diario; cobrar primero las dosis asignadas, incluso las fallidas, sin repetir persona. El anillo ordena susceptibles por cantidad descendente de aristas activas hacia I, después grado ponderado S-S descendente y finalmente ID ascendente. `score` conserva el grado S-S y `infectiousContacts` registra el primer criterio cuando la prioridad está activa; `tieBreak: "ringContact"` identifica selecciones con contactos infecciosos. Con cero contactos se usa el desempate habitual.
3. Cierre efectivo: cobrar solo si hay contactos activos de esa capa, cabe el costo después de vacunar y existe intervalo d < T. El cierre adaptativo reemplaza la ventana fija solo en la variante dirigida adaptativa; la referencia aleatoria conserva su calendario fijo. Las selecciones de vacunas observan los contactos previos a intervenir; las brigadas observan la red después del cierre del día.
4. Brigadas: permanecen sujetas a ventana/capacidad, saldo e insumos. Se suspenden si I=0 y se reevalúan al día siguiente. I=0 con E>0 no significa extinción. Si están habilitadas, usan la prioridad de anillo configurada sobre la red tras cierre.

Prioridad monetaria: vacunas, cierre y brigadas. Una solicitud de cierre evaluada antes de vacunar puede quedar sin presupuesto al ejecutarla. Ninguna intervención sobre contactos se cobra en T. Entregas no agregan dinero. Las tres políticas comparten recursos iniciales, calendario de llegadas y potenciales epidemiológicos; la adaptativa se compara contra azar con calendario fijo y no demuestra cuál sería la mejor política aleatoria adaptativa.

## Resultado y exportación

Cada fila diaria, en todas las políticas cuando se configura el objeto, incluye `adaptiveDecisions`:

| Campo | Significado |
|---|---|
| `enabled` | true únicamente para targeted adaptativa habilitada |
| `infectiousFraction` | I/N del snapshot observado |
| `closureActive` | Cierre efectivamente pagado/aplicado; false si no se ejecutó, null en políticas inactivas |
| `brigadesAllowed` | Permiso de la regla, no número de atenciones realizadas |
| `ringVaccinationActive` | Prioridad de anillo habilitada ese día; no implica que se asignaron dosis |
| `triggers` | Motivos de decisión y acciones omitidas |

Los motivos incluyen umbral de cierre/reapertura, falta de presupuesto, ausencia de contactos de cierre, pausa sin infecciosos y prioridad de anillo. Para acciones programadas sin ejecución se registran inventario vacío, capacidad cero, presupuesto insuficiente o ausencia de elegibles. `no_infectious_hold_brigades` describe pausa temporal, incluso con expuestos. `closure_triggered_by_threshold` describe solicitud; comprobar `closureActive` y `closedContext` para la ejecución.

Las columnas diarias de presupuesto/inventario y las selecciones contienen el gasto, consumo, saldo, destinatarios y puntuaciones. `adaptive-decisions.csv` exporta los motivos como arrays JSON correctamente escapados por CSV. `selections.csv` añade `infectiousContacts` cuando se configura adaptativa. Backend y cliente frontend usan las mismas columnas. La exportación base sin adaptativa conserva sus columnas.

Schema autoritativo: `schemas/common.schema.json`, definiciones `AdaptiveStrategy`, `AdaptiveDecisions`, `Daily` y `Selection`. Los registros diarios y selecciones forman parte de hashes científicos. La carga/exportación valida coherencia entre estado, decisiones, presupuesto e inventario, además de hashes; reproducir vuelve a ejecutar la política.

## Entrega al frontend

El cliente TypeScript admite la configuración, reconoce cierres fuera de la ventana fija únicamente para la variante adaptativa, valida registros y conserva su CSV. La explicación de vacunación reconoce el anillo y su cantidad de contactos. Comparar configuraciones por valor evita mostrar una vista obsoleta al restaurar la misma regla.

Entregado al frontend (2026-10-27): `AdaptiveStrategyEditor` habilita/versiona la variante, edita ambos umbrales en porcentaje y la prioridad de anillo, y rechaza reapertura mayor que cierre; `policyVariantLabel` distingue «Dirigida · adaptativa v1» en recomendación, tabla, vacunación de la réplica y encabezado del historial; `AdaptiveDecisionsPanel` muestra el resumen (cierres pagados vs. solicitados, pausas por I=0, días con anillo, omisiones) y la tabla diaria de la réplica representativa con cierre solicitado/ejecutado, brigadas permitidas/atendidas, anillo y motivos. Con `enabled:false` la UI muestra la insignia «(inactiva)» y un aviso, sin inventar filas. Evidencia y límites: [p02-ui-2026-10-27](../docs/evidencia/p02-ui-2026-10-27.md).

## Verificación

[Pruebas y evidencia local](../docs/evidencia/p02-adaptive.md). No declara calibración epidemiológica ni despliegue AWS. Los problemas de trabajos P-03 y OpenAPI se registran por separado en esa evidencia.
