# Requisitos de implementación — versión base

**Versión:** 1.1
**Fecha:** 27 de octubre de 2026
**Estado:** borrador para revisión del equipo; no acredita implementación.
**Fuentes:** [PRD](../PRD.md) v1.1 y [TRD](../TRD.md) v1.3.
**Complementos:** [Diseño](design.md), [Acuerdos técnicos](agreements.md) y [Tareas](tasks.md).

## 1. Propósito y alcance

Construir una herramienta educativa para comparar intervenciones sobre una población sintética inspirada en Manta. El comité configura un brote, ejecuta varias réplicas y decide con curvas, métricas e incertidumbre. El jurado debe poder cambiar la semilla y las condiciones sin editar código.

El alcance base incluye red multicapa, SEIR, vacunas limitadas, políticas `none`, `random`, `targeted`, API, interfaz, exportación reproducible y despliegue AWS. No incluye predicción clínica, datos personales, mortalidad, reinfección ni garantías de que `targeted` siempre gane.

El enunciado oficial prevalece; PRD define el producto y TRD la implementación. Estas specs cubren exclusivamente la construcción y validación técnica del sistema. Las referencias a CA-14 cubren aquí solo documentación y evidencias técnicas. Cada tarea enlaza a los requisitos originales. Los cambios de contrato requieren actualizar specs, esquemas, pruebas y documentos afectados.

## 2. Requisitos funcionales y aceptación

| ID de spec | Necesidad y comportamiento esperado | Trazabilidad | Verificación prevista |
|---|---|---|---|
| REQ-01 | Crear y cargar configuración normalizada, con semilla y versiones visibles; editar población, días, tasas, casos iniciales, origen, dosis, fecha, eficacia y réplicas. Revalidar en backend. | RF-01/02/19; CA-08 | Defaults, límites inclusivos, tipos inválidos, campos desconocidos y conservación del formulario ante errores. |
| REQ-02 | Generar red sintética de hogar, colegio, bus, mercado y barrio; seleccionar origen aleatorio, contexto o nodo. Sin candidatos de contexto, rechazar con `ORIGIN_EMPTY`. | RF-03; RNF-01/03 | Igual semilla genera mismo grafo y origen; selección sin reemplazo; identificador inválido rechazado. |
| REQ-03 | Registrar día 0 y días 1..T; aplicar SEIR síncrono y conservar población. Un nuevo expuesto no progresa ese mismo día. | RF-04; CA-01/04 | `S+E+I+R=N`, estados únicos, R absorbente, beta cero, grafo sin aristas y tasas extremas. |
| REQ-04 | Comparar exactamente las tres políticas con mismas condiciones externas. Solo S recibe vacuna; cada dosis asignada se consume aunque falle. | RF-05/06/12; CA-02/03/05/07 | Misma elegibilidad previa a la primera intervención; K=0 produce curvas idénticas; sin dosis repetidas ni exceso; desempate estable. |
| REQ-05 | Ejecutar 2..30 réplicas síncronas y reportar cantidad válida y fallos. No presentar una respuesta parcial como recomendación final. | RF-07; RNF-09 | Resultado completo o fallo explícito; indicador de ejecución sin porcentaje ficticio. |
| REQ-06 | Mostrar curvas y métricas por política: acumulados, pico, primer día del pico, infecciosos finales y dosis asignadas/efectivas/no usadas. | RF-08/10; CA-09 | Recalcular desde eventos y series, incluyendo infectados iniciales y excluyendo R por vacunación del acumulado infectado. |
| REQ-07 | Mostrar R, media, mediana, P05/P95 y diferencias pareadas. Etiquetar percentiles como rango empírico; con R≥30 calcular bootstrap pareado 95 % reproducible. | RF-09/10; CA-10 | Fixtures numéricos conocidos; 2.000 remuestras y semilla registrada. |
| REQ-08 | Explicar ganancia, empate o pérdida y selección de nodos sin ocultar resultados desfavorables. La política no observa el futuro. | RF-11/12; RNF-10 | Recomendaciones para los tres casos; score, rank, estado y desempate contrastados con la selección. |
| REQ-09 | Exportar JSON y CSV con configuración, grafo, semillas, versiones, métricas, curvas, resultados y hashes; reproducir el JSON en otro proceso. | RF-13/17/19; CA-06/07/11 | Tres procesos con igual hash; orden de políticas/réplicas irrelevante; campos volátiles excluidos. |
| REQ-10 | Configurar manualmente los casos variables y la semilla que solicite el jurado, sin presets fijos obligatorios. | RF-15/16/17; CA-12 | Cambios manuales validados, invalidación de resultados anteriores y registro de valores/semilla; flujo humano <5 min. |
| REQ-11 | Ofrecer URL pública y health; documentar instalación, pruebas, despliegue, supuestos, arquitectura, costos, Budget y límites. | RF-20/21/22; CA-13/14/15 | Smoke desde sesión limpia, enlaces reales, comandos ejecutados y evidencia de cuenta/despliegue sin secretos. |
| REQ-12 | Ofrecer animación identificada por réplica y comparación visual base/sorpresa cuando se implemente lo esperado. | RF-14/18 (DEBERÍA) | Réplica más cercana a mediana, desempate por índice, semilla visible; no llamarla promedio. Justificar ausencia. |

## 3. Configuración base

Defaults y límites provienen de TRD §4.3; son supuestos del equipo salvo el caso inicial del reto. `sigma` y `gamma` son probabilidades diarias, no duraciones en días.

| Campo | Default | Validación base |
|---|---|---|
| `populationSize` | 1000 | Entero 50..2000 |
| `days` | 90 | Entero 1..180 |
| `beta` | 0.08 | Finito 0..1 |
| `sigma` | 0.333333 | Finito 0..1 |
| `gamma` | 0.142857 | Finito 0..1 |
| `initialInfectious` | 1 | Entero 1..min(20,N) |
| `origin.kind` | `random` | `random`, `household`, `school`, `bus`, `market`, `neighborhood`, `node` |
| `origin.value` | null | Entero para node; null para otros orígenes; pertenencia validada |
| `vaccines` | 100 | Entero 0..N; si N baja de 100, no aceptar el default incompatible silenciosamente |
| `interventionDay` | 0 | Entero 0..T |
| `vaccineEfficacy` | 1.0 | Finito 0..1 |
| `repetitions` | 30 | Entero 2..30 en base |
| `rootSeed` | 20261026 | Entero 0..2^32−1 |
| `networkMode` | `fixed` | Solo `fixed` en base |

Se rechazan NaN, infinitos, campos desconocidos y cuerpos superiores al límite configurado. El backend publica los límites efectivos en `/v1/config`. La configuración canónica completa, incluidos pesos y calendario, se conserva para reproducción.

## 4. Requisitos de calidad

| Referencia | Criterio de aceptación |
|---|---|
| RNF-01/02/03 | Igual entorno fijado, versión, configuración y semilla producen iguales resultados; invariantes diarios y condiciones externas pareadas comprobadas. |
| RNF-04 | Base N=1000, T=90, R=30 termina en ≤60 s p95 total en AWS. Objetivo técnico adicional del TRD: backend ≤25 s para integración síncrona; medir ambos. |
| RNF-05/06 | Configurar, ejecutar e interpretar en ≤3 min en prueba moderada; teclado, foco, etiquetas y contraste AA, con tabla equivalente a gráficos. |
| RNF-07 | Sin secretos; validación server-side, HTTPS, CORS exacto, roles por función y recursos privados cuando correspondan. |
| RNF-08 | Estimación con unidades, fórmulas y tarifas oficiales fechadas; gasto observado separado de créditos y presupuesto. |
| RNF-09/10 | Fallos y límites explícitos; modelo, incertidumbre y decisiones explicables por el equipo. |

## 5. Casos de aceptación mínimos

- Dado un snapshot con S/E/I/R, cuando se vacuna, solo S puede consumir dosis; con eficacia 0 permanece S y con eficacia 1 pasa a R.
- Dada una réplica y K=0, cuando se comparan las tres políticas, las series son idénticas; si cambia el orden de evaluación, cada resultado permanece igual.
- Dado beta=0 o ninguna arista activa, cuando se simula, no aparecen exposiciones por contacto; E/I iniciales sí pueden progresar.
- Dado un JSON exportado, cuando se reproduce en proceso nuevo con versiones fijadas, coincide el hash no volátil.
- Dado un error de validación, la UI conserva entradas y muestra los campos afectados; un resultado parcial no habilita recomendación final.
- Dado un caso nuevo solicitado por el jurado, el operador introduce manualmente parámetros y semilla, vuelve a ejecutar y exporta sin tocar código (TRD §8.4).

## 6. Entrega, bloqueos y alcance PRO

La validación técnica aplica los criterios científicos de PRD §7.5: menor media de acumulados de `targeted` frente a ambas líneas base, diferencia pareada positiva frente a azar, casos de perturbación configurados manualmente, recursos válidos y una semilla externa exportable. La matriz de validación se fija antes de observar resultados; si falla, registrar y justificar ajustes sin seleccionar semillas favorables.

Región de los documentos: `us-east-2`. El README registra que el enunciado menciona `us-east-1` por confirmar: resolver con organización antes de desplegar. El Budget de USD 20 tiene evidencia provisional y 0/2 destinatarios verificados; no se declara operativa la notificación. No activar características avanzadas ni cambiar de plan como efecto implícito de una tarea de código.

PRO-1..PRO-7 permanecen **no iniciados**: intervenciones combinadas, inventario/costos diarios, adaptación, Distributed Map, calibración real, animación PRO e informe. No son dependencias de la entrega base. Toda ampliación necesita alcance, contratos y pruebas propios.
