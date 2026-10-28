# Traspaso para agentes — contexto, estado y backlog

**Fecha de corte:** 2026-10-28.
**Rama de trabajo:** `feat/backend-contratos`.
**Último incremento:** merge de `codex/parametros-comprensibles` ([evidencia](evidencia/merge-parametros-comprensibles-2026-10-28.md)); 510 pruebas backend y 150 frontend. Conserva rendimiento, feat/pro y T-22 aprobado; P-06 sigue ajustado, no validado.
**Estado post-merge:** [checklist y pendientes](evidencia/estado-post-merge-2026-10-27.md).
**Entrada obligatoria:** [AGENTS.md](../AGENTS.md).
**Documento vivo:** [plan de iteraciones PRO](plan-pro-iteraciones.md).

**Datos UX verificados:** [decisionSummary](../specs/decision-summary.md), porcentajes, alternativa siguiente, agregados financieros e incidencias. [Evidencia](evidencia/resumen-decision-2026-10-27.md); no cierra la aceptación humana.

**Mejoras de producto y UX (2026-10-27):** [backlog UX-01..UX-08](../specs/mejoras-sistema-ux.md), derivado de la retroalimentación del equipo y contrastado con capacidades existentes. Incluye presupuesto educativo; pitch y AWS se gestionan por separado. Es planificación, no implementación ni aceptación cerrada, y conserva las dependencias científicas.

Este documento explica qué se está construyendo, qué ya funciona, qué falta, en qué orden y con qué límites. No sustituye al [PRD](../PRD.md), al [TRD](../TRD.md) ni a las [specs](../specs/README.md). Si hay contradicción, prevalecen PRD/TRD y el protocolo congelado de T-22.

---

## 1. Resumen ejecutivo

El proyecto ya tiene un motor SEIR reproducible, comparación pareada de tres políticas, API local, exportación JSON/ZIP, reproducción en proceso nuevo y una interfaz Noche Cero conectada a la API real para preview, comparación, dosis, animación y mapa. La base T-02..T-12 está verificada localmente. La integración de UI existe en gran parte, pero T-13..T-16 siguen abiertas por aceptación, no por ausencia total de código.

Lo que bloquea una entrega creíble no es “hacer otra pantalla”: es cerrar evidencia y contratos. Faltan:

- T-22 científico está completo y APROBADO; quedan rendimiento consistente, semilla externa y aceptación integral.
- P-02: aceptación humana UI; editor, historial y backend adaptativo ya verificados en local.
- P-04: AWS; la pantalla de jobs ya usa la API real (P-03 cerrada en local, no durable).
- P-06: existe el preset `manabi-dengue-2025-v1`, pero la validación fuera de muestra es desfavorable; no hay versión validada.
- P-08: informe PDF verificado localmente en modo ficticio; [contrato](../specs/p08-report.md) y [evidencia](evidencia/p08-informe-2026-10-27.md); no cierra T-22.
- P-07: backend temporal verificado ([evidencia](evidencia/p07-backend-2026-10-27.md)) y UI integrada por el merge de `feat/pro` ([evidencia](evidencia/p07-mapa-animacion-2026-10-28.md)); aceptación en navegador posterior al merge, rendimiento visual y evaluación táctil pendientes.
- T-17..T-21: Terraform, staging, URL pública, benchmark, costos, Budget, arquitectura y pitch.

**T-22 científico está aprobado. No hay URL pública ni AWS desplegado; la aceptación integral sigue pendiente.** Consultar la evidencia y sus límites antes de afirmar que el producto está listo.

---

## 2. Problema, usuarios y promesa

### 2.1 Problema

Un comité necesita decidir a quién vacunar, cuándo intervenir y cuánto recurso usar en un brote ficticio. La comparación debe ser justa: misma red, mismo brote, mismas condiciones externas y recursos equivalentes. La pregunta no es “¿la estrategia dirigida es buena?” sino “¿reduce infectados acumulados frente a no intervenir y frente a vacunar al azar, y en qué casos no?”.

### 2.2 Usuarios

- **Comité de contención:** configura, compara y decide con incertidumbre visible.
- **Jurado/alcaldía:** evalúa impacto, límites, costos y trazabilidad.
- **Operador de demo:** cambia parámetros y semilla manualmente; el flujo objetivo es <5 minutos.
- **Equipo técnico:** reproduce JSON, revisa hashes, contratos y evidencia.

### 2.3 Promesa y límites

- Es un simulador educativo, no un predictor de brotes reales.
- La población es sintética; la geografía OSM es referencia visual, no riesgo epidemiológico.
- `targeted` es una hipótesis medible, no una garantía.
- Se conservan empates, pérdidas, errores y resultados desfavorables.
- La interfaz y la documentación están en español.

---

## 3. Modelo y reglas científicas que no se deben romper

### 3.1 SEIR diario

- `S`: susceptible.
- `E`: expuesto; no contagia todavía.
- `I`: infeccioso; contagia.
- `R`: recuperado o inmunizado; absorbente.
- No hay muerte, reinfección, hospitalización ni vector en el modelo base.
- Se registran T+1 días (0..T). El día 0 es lunes; el calendario no depende del reloj real.
- `S+E+I+R=N` en todos los días.
- La vacunación solo aplica a `S`; una dosis fallida se consume y no se reintenta.
- El acumulado de infectados incluye infectados iniciales y excluye inmunidad por vacuna.

### 3.2 Red sintética

Generador `synthetic-manta-v1`: hogares, colegios, buses, mercados y barrios. La red se fija por semilla y se comparte entre políticas y réplicas dentro de una raíz. El calendario semanal determina contactos activos. No hay domicilios reales ni movilidad real.

### 3.3 Políticas

- `none`: no interviene.
- `random`: muestrea susceptibles elegibles.
- `targeted`: puntúa susceptibles por suma de pesos de aristas activas hacia otros susceptibles y ordena por `(-score, nodeId)`.
- Las tres comparten red, origen, potenciales aleatorios y recursos externos.
- `targeted` no ve el futuro ni resultados de otras políticas.

### 3.4 Reproducibilidad

- Semillas por dominio (`rng-v1`, PCG64), canonización (`canonical-v1`) y hashes estables.
- `graphHash`, `initialStateHash`, `randomnessHash`, `resultHash` y `experimentHash`.
- El JSON exportado se reproduce en un proceso nuevo con las mismas versiones.
- Cambiar el orden de políticas o réplicas no debe cambiar resultados.
- Un cambio semántico del motor exige versionar el modelo y explicar el impacto; no “arreglar” hashes a mano.

### 3.5 Lectura correcta de resultados

- P05/P95 son rango empírico, no intervalo de confianza.
- El bootstrap es pareado por raíz; no tratar 150 réplicas como 150 redes independientes.
- La réplica representativa es una trayectoria, no el promedio.
- La recomendación del backend (`supported`, `inconclusive`, `descriptive`) no equivale al gate global T-22.
- Una media favorable no borra derrotas por réplica ni empates por brotes que no prosperan.

---

## 4. Arquitectura y flujo

```text
Frontend React/TS (Noche Cero)
  -> cliente /v1 (health, config, preview, compare)
  -> API Lambda local o handlers (backend/src/api)
  -> dominio/configuración y contratos compartidos (schemas/)
  -> simulación: red -> SEIR -> políticas -> agregación
  -> exportación JSON/ZIP + hashes + reproducción CLI
  -> Terraform/AWS (pendiente; infra/ vacío)
```

### 4.1 Backend

| Ruta | Responsabilidad |
|---|---|
| `backend/src/domain/configuration.py` | Normalización, defaults, límites, errores, parseo estricto. |
| `backend/src/domain/models.py` | Tipos inmutables de configuración y dominio. |
| `backend/src/domain/reproducibility.py` | RNG por dominio, canonización, hashes. |
| `backend/src/simulation/network.py` | Grafo sintético, calendario, origen, preview. |
| `backend/src/simulation/engine.py` | Motor SEIR, transiciones, eventos, vacunación pareada. |
| `backend/src/simulation/experiments.py` | Réplicas, métricas, agregación, bootstrap, representativa. |
| `backend/src/simulation/exports.py` | Manifiesto, JSON, ZIP/CSV, validación, reproducción. |
| `backend/src/strategies/vaccination.py` | Selección `none/random/targeted`, scores y explicación. |
| `backend/src/strategies/combined.py` | Intervenciones combinadas, costos, brigadas, cierre. |
| `backend/src/api/` | Handlers HTTP API v2: health, config, preview, compare. |
| `schemas/` | OpenAPI, JSON Schemas y ejemplos mock compartidos. |
| `scripts/` | Servidor local, exportación, reproducción, benchmark, T-22. |

### 4.2 Frontend

| Ruta | Responsabilidad |
|---|---|
| `frontend/src/App.tsx` | Composición, navegación, estado de configuración y resultados. |
| `frontend/src/lib/api.ts` | Cliente tipado, gzip, validación de contrato, errores. |
| `frontend/src/components/PreviewNetwork.tsx` | Red real, filtros, inspección. |
| `frontend/src/components/ComparisonResults.tsx` | Curvas, métricas, tabla, recomendación. |
| `frontend/src/components/SimulationWorkspace.tsx` | Día, política, pausa, velocidad, sincronización. |
| `frontend/src/components/VaccinationDetails.tsx` | Dosis, selección, explicación. |
| `frontend/src/components/GeographicMap.tsx` | Mapa OSM y agentes sintéticos. |
| `frontend/src/pro/` | Pantalla PRO; hoy jobs con fixtures. |

### 4.3 Contrato

Antes de agregar una capacidad PRO, acordar en `schemas/`:

- petición, respuesta y errores versionados;
- semántica temporal y unidades;
- estados de carga, vacío, error, cancelación y resultado parcial;
- límites de tamaño, réplicas y frames;
- ejemplos válidos e inválidos.

El frontend no inventa campos ni recalcula epidemiología, costos o decisiones.

---

## 5. Funcionalidades que ya existen

### 5.1 Base verificada localmente

- Configuración canónica con defaults, límites, errores saneados y sin coerción silenciosa.
- Red `synthetic-manta-v1` con cinco capas, calendario, origen aleatorio/contexto/nodo y `ORIGIN_EMPTY`.
- Motor SEIR con conservación, transiciones simultáneas, R absorbente, eventos causales y frontera T.
- Políticas pareadas `none/random/targeted`; una dosis por persona; solo S; dosis fallida consumida; eficacia por nodo/día.
- Agregación con media, mediana, P05/P95, diferencias pareadas, bootstrap R≥30 y representativa determinista.
- Exportación JSON reproducible, ZIP/CSV con once archivos, `experimentHash` y reproducción CLI.
- API local con health/config/preview/compare, gzip, validación de `expectedGraphHash`, límites y errores.
- Pruebas de contrato, motor, políticas, agregación, exportación y API.

Evidencia principal: [auditoría PRO](evidencia/auditoria-pro-2026-10-27.md), [revisión base](evidencia/revision-base.md) y los informes `docs/evidencia/backend-*.md`.

### 5.2 Interfaz

- Identidad **Noche Cero**, navegación Explorar red / Comparación / PRO / Ayuda.
- Health/config reales, formulario, validación y defaults publicados.
- Preview real con grafo, casos iniciales, filtros e inspector.
- Comparación real con curvas, bandas empíricas, tabla, dosis y recomendación del backend.
- Reproducción de una réplica representativa con día, política, pausa, velocidad y reinicio.
- Explicación de selección de vacunas: score, rank, elegibilidad, contextos, desempate y resultado.
- Agrupación visual por barrio/hogar/colegio/bus/mercado y vista circular.
- Mapa OSM de Manta con polígonos versionados y posiciones sintéticas deterministas.
- Exportación JSON y ZIP/CSV desde resultados vigentes; sin resultado, solo borrador etiquetado.

Evidencia: [estado del frontend PRO](estado-frontend-pro-2026-10-27.md), [integración local](evidencia/integracion-local.md) y [validación del flujo local](evidencia/validacion-flujo-local.md).

### 5.3 PRO ya disponible

- **P-01:** calendario de llegadas, inventario inicial, capacidad diaria, acumulación, costos educativos y exportación. Verificado localmente; no cierra todo PRO-1/2.
- **P-09:** mapa geográfico y capa de agentes como presentación. No cambia modelo, contratos ni hashes.
- **PRO-1/2 parcial:** vacunas, cierre de capa, brigadas, presupuesto y costos educativos; falta aceptación integral y límites visibles.
- **P-02 backend y UI local:** `adaptive-v1`, reglas, anillo, motivos, exportación, reproducción, editor, variante e historial diario verificados; falta aceptación humana T-13..T-16.
- **P-03 local (no durable):** `/v1/jobs`, cola, token, idempotencia, cancelación, resultado reproducible y pantalla PRO conectada a la API real; falta P-04 (AWS) y durabilidad.
- **P-05:** `manabi-dengue-weekly-v1`, 94 semanas reales de dengue de Manabí (2025 S1–53, 2026 S1–41) con importador reproducible, geometría versionada, procedencia y controles de totales. Provincial, preliminar y **sin** conexión al motor SEIR.
- **P-06 local, no validado:** `manabi-dengue-2025-v1` ajusta el SEIR de mezcla homogénea a P-05 con ventanas fijadas antes de mirar, bootstrap 120, perfil condicional y puente al motor. La validación pierde frente a persistencia en ambos años; el panel de la UI lo muestra y permite volver al modo ficticio.
- **P-07 parcial:** reproducción y mapa sincronizados; faltan aceptación, transiciones, rendimiento y accesibilidad.

---

## 6. Qué falta exactamente

### 6.1 T-22 — componente científico ejecutado

**Estado: APROBADO**, intento `.tools/t22-v1-attempt-02`, fuente `0e90ff4`. [Informe](evidencia/t22-v1-ejecucion.md), [resumen completo](evidencia/t22-v1-ejecucion.json) y [auditoría con observaciones pareadas](evidencia/t22-v1-auditoria.json).

- Protocolo v1 congelado y sin modificaciones: 5 raíces primarias × 30 pares, 5 contrastes × 30 y 5 controles × 30; 450 pares totales.
- Quince JSON/ZIP completos; controles 5/5 PASA, 17 reproducciones correctas en procesos nuevos (base-root-0 tres veces).
- Medias primarias none/random/targeted: 713,6067 / 575,1067 / 359,2067. Sumas D_none=53.160 y D_random=32.385, ambas estrictamente positivas.
- Frente a random: 112 victorias, 33 empates y 5 pérdidas. No se afirma victoria universal.
- IC bootstrap por raíz conservados; no hay bootstrap global que trate los 150 pares como redes independientes.
- Targeted deja más infecciosos al día 90 en las cinco raíces: no demuestra menor duración del brote; censura explícita.
- `market-origin` es redundante: los 1.000 nodos son candidatos de mercado y produce las mismas réplicas que base-root-0. No aporta evidencia independiente sobre sensibilidad al origen. Cualquier cambio semántico exige v2, conservando v1.
- T-23, semilla externa, tiempos humanos, aceptación UI, rendimiento consistente y AWS siguen pendientes.

Los artefactos crudos de intento 01 citados históricamente no están en este checkout. El intento 02 se ejecutó desde cero y conserva JSON/ZIP/logs/entorno/hardware localmente bajo `.tools/`. No sobrescribirlo. El informe y los resúmenes están versionados; los JSON grandes no se suben a Git.

Comando realmente ejecutado:

```powershell
backend/.venv/Scripts/python.exe -X utf8 scripts/run_t22.py --attempt .tools/t22-v1-attempt-02 --group all
```

Para repetir toda la matriz usar un directorio nuevo; para comprobar una fila existente, ejecutar `scripts/reproduce.py` sobre su JSON con el entorno fijado por backend/uv.lock. Leer el protocolo antes de cualquier nueva evaluación. El lote tardó aproximadamente 14 minutos incluyendo validación, exportación y reproducciones; no es un benchmark de API/AWS.

### 6.2 Base pendiente T-13..T-23

| Tarea | Falta para cerrar |
|---|---|
| T-13 | Matriz de aceptación de formulario/preview, teclado/foco, errores que conservan entradas, invalidez de resultados. |
| T-14 | Casos UI de éxito, empate, pérdida, error, parcial y respuesta obsoleta. |
| T-15 | Prueba humana de casos manuales del jurado, exportación real, diff base/sorpresa (DEBERÍA). |
| T-16 | E2E de navegador, teclado, contraste AA, tabla equivalente y prueba moderada ≤3 min. |
| T-17 | Viabilidad real de cuenta/región/permisos/Budget; resolver o reportar bloqueo de correos. |
| T-18 | Terraform base, CORS, roles, logs/alarmas, Amplify; sin desplegar. |
| T-19 | Staging autorizado, smoke y benchmark AWS N1000/T90/R30; medir ≤25 s backend y p95 ≤60 s total. |
| T-20 | URL pública, health desde sesión limpia y semilla nueva. |
| T-21 | Arquitectura SVG + fuente, costos fechados, README/runbook, Budget verificable. |
| T-22 | Cerrado científicamente y APROBADO; evidencia y límites arriba. |
| T-23 | Escenarios variables, semilla externa, reproducibilidad operativa y explicación. |

**No reordenar:** T-22 y rendimiento antes de P-04. La semilla externa no se agrega retrospectivamente a las 150 unidades primarias.

### 6.3 PRO pendiente P-02..P-08

| ID | Estado | Qué implementar | Aceptación mínima |
|---|---|---|---|
| P-02 | Backend/UI local | Backend `adaptive-v1` (observaciones, umbrales, prioridades, desempates, recursos, costo, motivos, exportación) y editor/historial visual verificados localmente. | Falta aceptación humana T-13..T-16: escenarios ascendente/descendente, saldo agotado, sin elegibles, cambio de prioridad, sin futuro, independencia de orden y comparación justa. |
| P-03 | Local, no durable | `/v1/jobs`, manifiesto, progreso, cancelación, idempotencia, agregado completo y pantalla PRO conectada a la API real. | Cumplido en local: mismo agregado en distinto orden, reintentos sin duplicar, cancelación trazable y reproducción secuencial. Reiniciar el servidor pierde los trabajos; eso es P-04. |
| P-04 | No iniciado | Step Functions Distributed Map, Lambda por réplica, S3, IAM mínimo, cuotas, concurrencia, costos. | Terraform válido, prueba pequeña, 100 y ≥1.000 réplicas con integridad/costo; sin 10.000 sin autorización. |
| P-05 | Cerrado en local | Hecho: `manabi-dengue-weekly-v1`, 94 semanas (2025 S1–53, 2026 S1–41), 18 259 casos, desde las gacetas ETV SE 53/2025 y SE 41/2026 del MSP. | Cumplido: importador `download`/`extract`/`build`/`verify`/`render`, geometría versionada, procedencia con hash, control directo 2026 (11 946) e indirecto por tasas 2025 (6 313). Límites: provincial, preliminar, 2026 incompleto. |
| P-06 | Cerrado en local, **no validado** | Hecho: `manabi-dengue-2025-v1` sobre `manabi-dengue-weekly-v1`; SEIR de mezcla homogénea con `σ`/`γ` del motor, `N` fijo, NB semanal, ventanas 2025 S1–S35/S36–S53 y 2026 S1–S27/S28–S41, bootstrap 120, perfil de `β` y puente `β_motor = R₀·γ/w̄`. | Cumplido: `scripts/p06_calibrate.py verify` reproduce el preset; panel en la UI con etiqueta y límites. Resultado: pierde frente a persistencia (29,53 vs 14,22 y 268,62 vs 48,86), `N`–`ρ` confundidos y ventana de 371 días fuera del motor. No re-tunear. |
| P-07 | Parcial | Sincronización mapa/red/curva/tabla, pausa/seek/velocidad/reinicio, foco, movimiento reducido, rendimiento. | Sin divergencias; frames coherentes con hash/réplica/día; accesibilidad y rendimiento aceptados; no inventar contagios ni trayectos. |
| P-08 | Verificado localmente: PDF/API/CLI y descarga; [evidencia](evidencia/p08-informe-2026-10-27.md) | Informe determinista para alcaldía, preferible PDF, desde experimento validado. | Cifras coinciden con JSON; fuentes, hash, costos, incertidumbre y límites; PDF revisado y reproducible; no ocultar pérdidas. |

Detalle completo: [specs/pro-roadmap.md](../specs/pro-roadmap.md) y [specs/pro-workstreams.md](../specs/pro-workstreams.md).

### 6.4 AWS y entrega

- `infra/` solo contiene `.gitkeep`; no hay Terraform ni pipeline.
- Región decidida: `us-east-2`.
- Budget `SpookyThon2026-PRO`: USD 20/mes, umbrales 25/50/75/100 % real y 100 % previsto; **0/2 destinatarios verificados**. Una alerta no detiene el gasto.
- No hay URL pública, smoke desde sesión limpia, benchmark AWS ni costos medidos.
- Faltan arquitectura SVG + fuente editable, runbook, costos fechados, pitch PDF/PPT y ensayo.
- No desplegar, publicar, crear PR ni ejecutar lotes grandes sin autorización explícita.

---

## 7. Checklist de funcionalidades y entregables

### 7.1 Base

- [x] Configuración, contratos, semillas, grafo, SEIR, políticas, agregación, exportación, API y frontend inicial (T-02..T-12).
- [ ] Formulario/preview con aceptación integral (T-13).
- [ ] Comparación y estados de éxito/empate/pérdida/error/parcial (T-14).
- [ ] Sorpresa manual, exportación y representativa (T-15).
- [ ] E2E, accesibilidad y prueba moderada (T-16).
- [ ] Viabilidad AWS (T-17).
- [ ] Terraform base (T-18).
- [ ] Staging y benchmark AWS (T-19).
- [ ] Frontend público (T-20).
- [ ] Arquitectura, costos y documentación de entrega (T-21).
- [x] T-22 científico completo y APROBADO; 15 experimentos y 17 reproducciones.
- [ ] T-23 escenarios variables y semilla externa.

### 7.2 PRO

- [x] P-01 inventario diario, verificado localmente.
- [ ] P-02 backend y UI locales; falta aceptación humana.
- [ ] P-03 local no durable; falta P-04.
- [ ] P-04 AWS Distributed Map, no iniciado.
- [x] P-05 datos reales de dengue/Manabí, verificado localmente (94 semanas, 2025–2026).
- [x] P-06 calibración y preset `manabi-dengue-2025-v1`, cerrado en local pero `fitted-not-validated` (pierde frente a persistencia).
- [ ] P-07 mapa/animación, parcial.
- [ ] P-08 informe para alcaldía, no iniciado.
- [x] P-09 mapa geográfico, verificado localmente como presentación.

### 7.3 Entregables de cierre

- [x] T-22 con informe y gate científico APROBADO explícito.
- [ ] Suite E2E de navegador con éxito, empate, pérdida, error y obsolescencia.
- [ ] Prueba cronometrada con semilla externa y Brote Sorpresa <5 min.
- [ ] `docs/arquitectura.svg` y fuente editable.
- [ ] `docs/costos.md` con tarifas, fórmula, estimación y gasto real.
- [ ] Budget con destinatarios verificados.
- [ ] URL pública y health desde sesión limpia.
- [ ] README con despliegue, pruebas, límites y comandos.
- [ ] Pitch PDF/PPT ≤20 MB y ensayo de 5 minutos.
- [ ] Revisión final de secretos, accesibilidad, reproducibilidad y enlaces.

---

## 8. Backlog priorizado para agentes

### Prioridad 0 — no romper la base

Antes de tocar código:

```sh
git status
git log --oneline -5
cd backend && .venv/bin/python -m pytest -q
.venv/bin/python -m ruff check src tests
.venv/bin/python -m mypy
cd ../frontend && npm test -- --run && npm run typecheck && npm run build
```

No cambiar hashes, defaults, fórmulas, contratos ni semillas sin actualizar pruebas, PRD/TRD y evidencia.

### Prioridad 1 — cerrar I-01

1. Revisar `scripts/run_t22.py`; agregar pruebas o al menos ejecutar `--group control` con un intento nuevo si se duda.
2. Ejecutar la matriz completa con `--resume --group all`.
3. Reproducir cada JSON y `base-root-0` tres veces.
4. Validar invariantes y controles.
5. Escribir informe en `docs/evidencia/` con decisión y límites.
6. No editar `specs/validation/t22-v1`.
7. Commit pequeño del runner y del informe (si el usuario lo autoriza).

### Prioridad 2 — P-02 UI

- El backend `adaptive-v1`, reglas, motivos, exportación y reproducción ya están verificados.
- Falta editor/historial visual, aceptación UI y prueba con escenarios nuevos.
- No redefinir `targeted` en silencio.

### Prioridad 3 — P-05 y P-06

- [x] P-05 cerrado en local: fuente oficial, procedencia, hash, normalización, controles de totales y límites declarados.
- La fuente es **provincial** y **preliminar**: no hay Manta ni datos cantonales; 2026 llega a la SE 41.
- El dataset **no alimenta el motor SEIR** (`wired_into_simulator = false`). Importar datos no es calibrar.
- [x] P-06 cerrado en local con resultado desfavorable: `manabi-dengue-2025-v1` (`fitted-not-validated`), ventanas fijadas antes de mirar, bootstrap, perfil condicional y puente al motor. Evidencia: [p06-dengue-manabi-2026-10-27](evidencia/p06-dengue-manabi-2026-10-27.md).
- No re-tunear ventanas, semillas ni parámetros para mejorar la validación. `N`–`ρ` siguen confundidos y el motor no admite la ventana de 371 días.
- No inventar datos ni repartir casos provinciales sin metodología.

### Prioridad 4 — P-04 (AWS)

- P-03 está cerrada en local: la pantalla PRO usa la API real, con credenciales de sesión, sondeo, cancelación y reintento.
- P-04 solo con autorización de gasto y presupuesto de prueba; requiere durabilidad, cuotas y Distributed Map.

### Prioridad 5 — P-08 y P-07

- P-08 desde un experimento validado; cifras exactas del JSON.
- P-07 cerrar sincronización, accesibilidad y rendimiento; no inventar animaciones.

### Prioridad 6 — AWS y cierre

- T-17 viabilidad, T-18 Terraform, T-19 staging/benchmark, T-20 URL, T-21 documentación.
- T-23 semilla externa y flujo sorpresa.
- I-09 cierre integral.

---

## 9. Comandos, entorno y evidencia

### 9.1 Backend

Desde `backend/`:

```sh
.venv/bin/python -m pytest -q
.venv/bin/python -m ruff check src tests
.venv/bin/python -m ruff format --check src tests
.venv/bin/python -m mypy
```

### 9.2 Frontend

Desde `frontend/`:

```sh
npm test -- --run
npm run typecheck
npm run build
```

### 9.3 Servidores locales

Desde la raíz:

```sh
backend/.venv/bin/python scripts/serve_api.py
cd frontend && npm run dev -- --host 127.0.0.1 --port 5174
```

Abrir `http://127.0.0.1:5174/`. El proxy Vite envía `/v1` al backend local.

### 9.4 Exportación/reproducción

```sh
backend/.venv/bin/python scripts/export_experiment.py \
  specs/validation/t22-v1/inputs/base-root-0.json /tmp/base-root-0.json \
  --no-frames --build-commit "$(git rev-parse HEAD)"
backend/.venv/bin/python scripts/reproduce.py /tmp/base-root-0.json
```

### 9.5 Evidencia

- Informes: `docs/evidencia/`.
- JSON/ZIP grandes: `.tools/` (ignorado en Git).
- Contratos: `schemas/`.
- T-22: `specs/validation/t22-v1/`.
- Plan vivo: `docs/plan-pro-iteraciones.md`.

No guardar credenciales, correos, tokens ni datos personales en evidencia.

---

## 10. Estado de pruebas y mediciones

| Frente | Último estado auditado |
|---|---|
| Backend | 391 pruebas, Ruff y mypy correctos (24 archivos fuente). |
| Frontend | 135 pruebas, typecheck y build correctos. |
| Benchmark local | Windows N1000/T90/R30: 13,80 s de motor (control anterior 13,60 s, resultados idénticos); Linux histórico 44,3 s. [Carga/exportación optimizadas](evidencia/rendimiento-validacion-2026-10-27.md); no certifica latencia HTTP total ni AWS. |
| T-22 controles | 5/5 PASA; matriz completa y componente científico APROBADO. |
| T-22 exportación | 15 JSON/ZIP completos, 17 reproducciones correctas; intento 02 conservado localmente. |
| AWS | No desplegado; sin benchmark ni URL pública. |
| E2E | No hay suite automatizada completa; flujos manuales documentados. |

Las cifras anteriores son evidencia local, no promesas de rendimiento en AWS ni aceptación humana.

---

## 11. Riesgos y trampas

1. **Confundir preparación con aprobación.** T-22 con protocolo y controles no es gate aprobado.
2. **Confundir benchmark con exportación.** Validar/zipear/reproducir un JSON grande cuesta minutos.
3. **Confundir fixture con API.** La pantalla de jobs PRO no llama a `/v1/jobs`; no presentar sus cifras como reales.
4. **Confundir mapa con epidemiología.** OSM y posiciones sintéticas no son datos de riesgo.
5. **Confundir `supported` con victoria universal.** Es una recomendación descriptiva del backend.
6. **Ocultar pérdidas.** Las derrotas por réplica y los empates deben quedar visibles.
7. **Cambiar semillas después de ver resultados.** Prohibido; conservar y reportar.
8. **Editar el protocolo T-22.** Prohibido; crear v2 si hay cambio semántico.
9. **Duplicar ciencia en frontend.** El frontend presenta; no recalcula SEIR, métricas, costos ni decisiones.
10. **Declarar AWS o costos sin evidencia.** `infra/` vacío, Budget 0/2, sin URL.
11. **Medir tiempos humanos con scripts.** CA-12/RNF-05/06 requieren persona y acceso.
12. **Agregar la semilla del jurado a la matriz primaria.** Es aceptación separada.

---

## 12. Protocolo de trabajo y definición de terminado

### 12.1 Git

- Rama de integración: `feat/pro`.
- Cada agente crea rama corta desde `feat/pro`; no compartir rama de implementación.
- Commits pequeños en español: `feat(pro-p02): ...`, `fix(...)`, `docs(pro): ...`, `test(motor): ... (CA-...)`.
- No commitear secretos, `.tools/`, `node_modules/`, `dist/`, `.venv/` ni estados Terraform.
- Hacer push al terminar la iteración, aunque sea parcial; decirlo.

### 12.2 Terminado

Una tarea se cierra solo si:

- la aceptación está escrita y cubierta;
- pruebas nuevas y existentes pasan;
- lint, tipos y build pasan cuando aplique;
- hay evidencia ejecutada, no solo mock;
- documentación y bitácora actualizadas;
- sin secretos ni datos personales;
- commit/push existen;
- límites y resultados desfavorables visibles.

No marcar `[x]` por código, mock, spec o ejecución parcial.

---

## 13. Plantillas para asignar trabajo

### 13.1 Revisión de T-22 ya cerrado

```text
Lee AGENTS.md y docs/evidencia/t22-v1-ejecucion.md. T-22 v1 ya está ejecutado
con componente científico APROBADO. No edites el protocolo ni sobrescribas
.tools/t22-v1-attempt-02. Revisa primero la auditoría y sus límites: pérdidas,
empates, censura y contraste de mercado redundante. Si cambia la semántica
del motor, registra una evaluación v2 conservando todos los resultados v1.
No confundas este resultado con T-23, aceptación humana ni despliegue AWS.
```

### 13.2 P-02

```text
Lee AGENTS.md, specs/pro-roadmap.md y specs/pro-workstreams.md. Trabaja solo
en P-02. Escribe primero contrato y aceptación de adaptive-v1; no redefinas
targeted. Define observaciones permitidas, umbrales, prioridades, desempates,
costos, motivos y acciones omitidas. Agrega pruebas de no-futuro, orden de
políticas, recursos equivalentes y exportación. Conecta UI solo después del
contrato. No inventes resultados ni despliegues.
```

### 13.3 P-03

```text
Lee AGENTS.md y specs/pro-roadmap.md. Trabaja solo en P-03. Diseña /v1/jobs
con manifiesto fijo, estados, progreso real, cancelación, idempotencia,
expiración y agregado solo completo. Implementa ejecución local antes de AWS.
Reemplaza fixtures de frontend/src/pro/ por contrato real. No presentes
repetitions síncronas como jobs. Documenta evidencia y límites.
```

### 13.4 P-08 (P-06 cerrado en local, no validado)

```text
Lee AGENTS.md, docs/plan-pro-iteraciones.md y
docs/evidencia/p06-dengue-manabi-2026-10-27.md. Trabaja solo en P-08. Construye
un informe determinista para la alcaldía desde un experimento completo, con
cifras exactas del JSON, costos, incertidumbre, fuentes, hash y límites. Si usas
el preset manabi-dengue-2025-v1, cítalo como fitted-not-validated y no lo
presentes como calibración validada: su validación pierde frente a persistencia.
No rellenes cifras ausentes ni ocultes pérdidas o empates. Prefiere PDF
reproducible y revisa el resultado visualmente.
```

### 13.5 AWS/T-17..T-21

```text
Lee AGENTS.md y docs/plan-pro-iteraciones.md. Trabaja solo en T-17..T-21.
No despliegues ni ejecutes lotes grandes sin autorización explícita de gasto.
Primero viabilidad y Terraform válido; después staging autorizado, smoke,
benchmark y URL. Registra costos, cuotas, región, IAM, CORS y límites. No
inventes URL, gasto ni resultados de AWS.
```

---

## 14. Enlaces de referencia

- [PRD](../PRD.md) y [TRD](../TRD.md).
- [Requisitos](../specs/requirements.md), [diseño](../specs/design.md), [tareas](../specs/tasks.md).
- [Acuerdos técnicos](../specs/agreements.md).
- [Hoja de ruta PRO](../specs/pro-roadmap.md) y [frentes](../specs/pro-workstreams.md).
- [Plan de iteraciones](plan-pro-iteraciones.md).
- [Protocolo T-22](../specs/validation/t22-v1/README.md).
- [Estado del frontend PRO](estado-frontend-pro-2026-10-27.md).
- [Auditoría PRO](evidencia/auditoria-pro-2026-10-27.md).
- [Revisión base](evidencia/revision-base.md).
- [Validación del flujo local](evidencia/validacion-flujo-local.md).
- [Costos](costos.md).
- [Mapa geográfico](manta-geography.md) y [P-09](../specs/p09-geographic-map.md).

Actualización de rendimiento API (2026-10-27): 478 pruebas backend, Ruff/mypy correctos. [Evidencia HTTP completa](evidencia/api-performance-2026-10-27.md). Compare reutiliza bytes JSON validados; no cambia hashes. ≤25 s consistente y staging siguen pendientes; T-22 científico fue ejecutado y aprobado después de esa medición.

Rendimiento actualizado 2026-10-28: comparación HTTP N1000/T90/R30 con medianas 18,46/19,56 s sin/con frames (6 muestras <25 s), PDF 4,94 s, ZIP backend local 4,36 s. Tres jobs R9 con dos workers completaron; N1000/T90/R30 sigue excediendo el límite local de 50 millones de arista-día-réplicas. No aumentar el límite para ocultarlo. [Todas las muestras, carga y límites](evidencia/rendimiento-backend-2026-10-28.md). No certifica staging/AWS ni latencia universal.

Última integración de frontend (2026-10-28): [merge de codex/parametros-comprensibles](evidencia/merge-parametros-comprensibles-2026-10-28.md), 150 pruebas frontend, tipos/build y 510 pruebas backend/Ruff/mypy correctos. Parámetros comprensibles y flujo plegable incorporados sin tocar backend ni contratos. Se conserva editor adaptativo, step-back y configuración de vacunación. Leaflet clearRect y favicon 404 observados en navegador; aceptación integral sigue pendiente.
