# AGENTS.md — traspaso operativo del proyecto

Este archivo es la entrada obligatoria para cualquier agente que trabaje en este repositorio. El contexto ampliado, la trazabilidad y el backlog detallado están en [docs/traspaso-agentes.md](docs/traspaso-agentes.md). Las fuentes de producto y técnica siguen siendo [PRD.md](PRD.md), [TRD.md](TRD.md), [specs/requirements.md](specs/requirements.md), [specs/tasks.md](specs/tasks.md) y [specs/pro-roadmap.md](specs/pro-roadmap.md).

## 1. Contexto del problema

El producto es **Comité de Contención de Manta**, una aplicación web educativa que simula un brote ficticio de zombis sobre una población sintética inspirada en Manta. El usuario configura un escenario SEIR (`S`, `E`, `I`, `R`), consulta una red de contactos multicapa y compara tres políticas con los mismos recursos:

- `none`: no intervenir.
- `random`: vacunar al azar entre susceptibles.
- `targeted`: vacunar con una heurística explicable que prioriza contactos de riesgo.

La pregunta científica es si `targeted` reduce los infectados acumulados frente a `none` y `random`, sin ocultar empates, pérdidas ni incertidumbre. El producto no predice brotes reales, no usa datos personales y no debe presentar la geografía OSM como riesgo epidemiológico real.

Usuarios principales: comité de contención, jurado/alcaldía que evalúa impacto y limitaciones, operador de una demo de brote sorpresa de menos de cinco minutos, y equipo técnico que reproduce resultados. El idioma de la interfaz y de la documentación es español. La identidad visual es **Noche Cero**.

## 2. Estado real al 2026-10-27

Rama de trabajo: `feat/backend-contratos`. Último incremento: rendimiento de validación (`git log --grep=rendimiento`); P-07 backend y P-08 locales verificados; conserva P-06 ajustado, no validado. Estado verificado y pendientes: [post-merge 2026-10-27](docs/evidencia/estado-post-merge-2026-10-27.md).

| Área | Estado comprobable | Qué falta |
|---|---|---|
| Base backend T-02..T-12 + PRO local | Suite actual: **443 pruebas backend**, Ruff, mypy, contratos, motor, exportación, reproducción, P-02/P-03/P-05/P-06. | Integración E2E completa y aceptación de UI. |
| Frontend base | **137 pruebas**, typecheck y build correctos; API real para health/config, preview, comparación, reproducción, vacunación, jobs (pantalla PRO), ZIP/JSON, mapa y panel P-06. | T-13..T-16 abiertas por aceptación, no por falta total de código. |
| Rendimiento | Motor `N=1000/T=90/R=30` en Windows: **13,80 s**, control anterior 13,60 s, mismos resultados. Referencia Linux histórica 44,3 s. Carga JSON grande optimizada a ~6 s. [Evidencia](docs/evidencia/rendimiento-validacion-2026-10-27.md). | No acredita p95, tiempo HTTP total ni AWS. T-22 sigue pendiente. |
| T-22 | Protocolo v1 congelado. **Controles técnicos ejecutados y PASA** (5 controles, R30, reproducción). `base-root-0` exportado, pero sin metadatos/reproducción completa para el gate. | Matriz primaria (5 raíces × 30) y 5 contrastes pendientes; el gate científico **no** está aprobado. |
| PRO-1/2 y P-01 | P-01 verificado localmente: llegadas, inventario, capacidad, costos educativos y exportación. | Aceptación integral de intervenciones combinadas y límites visibles. |
| P-02 | Backend, cliente y UI verificados localmente: `adaptive-v1`, reglas, anillo, motivos, editor, historial diario, exportación y reproducción. | Aceptación humana integral (T-13..T-16) y repetir en UI saldo agotado/sin elegibles. |
| P-03 | Backend, cliente y pantalla PRO verificados localmente: `/v1/jobs`, cola, token, idempotencia, cancelación, resultado reproducible, credenciales en `sessionStorage`, sondeo, reintento e historial. | P-04 AWS (miles de réplicas, durabilidad, cuotas y costos). |
| P-04 | No iniciado. | Distributed Map, S3, IAM, cuotas, costos y evidencia de miles de réplicas. |
| P-05 | Verificado localmente: `manabi-dengue-weekly-v1` con 94 semanas (2025 S1–53, 2026 S1–41), importador reproducible, geometría versionada, procedencia y controles de totales. | Nada pendiente en P-05; la granularidad provincial y los datos preliminares quedan como límites declarados. |
| P-06 | Cerrado en local con resultado **desfavorable**: `manabi-dengue-2025-v1` (`fitted-not-validated`), ventanas fijadas antes de mirar, bootstrap 120, perfil condicional, puente al motor y panel en la UI. | La validación pierde frente a persistencia (29,53 vs 14,22 y 268,62 vs 48,86); no hay versión validada y P-08 debe citar la etiqueta. |
| P-07 | Backend temporal verificado: identidad, frames/eventos, transiciones y conteos; reproducción/mapa existentes. [Evidencia](docs/evidencia/p07-backend-2026-10-27.md). | Aceptación UI de controles, sincronización, rendimiento, accesibilidad y movimiento reducido. |
| P-08 | Verificado localmente: informe PDF determinista desde experimento ficticio completo, API/CLI y descarga en comparación/trabajos. | T-22 y aceptación humana integral siguen independientes. [Evidencia](docs/evidencia/p08-informe-2026-10-27.md). |
| P-09 | Verificado localmente como presentación. | Mantener separación entre OSM, posiciones sintéticas y riesgo real. |
| AWS/entrega | No desplegado. `infra/` vacío. Región decidida: `us-east-2`. | T-17..T-21: IaC, staging, URL pública, benchmark, costos, Budget, arquitectura SVG y pitch. |

La evidencia de partida está en [docs/evidencia/auditoria-pro-2026-10-27.md](docs/evidencia/auditoria-pro-2026-10-27.md), [docs/evidencia/revision-base.md](docs/evidencia/revision-base.md) y [docs/plan-pro-iteraciones.md](docs/plan-pro-iteraciones.md). El estado posterior al merge P-02/P-03 y el checklist completo de pendientes están en [docs/evidencia/estado-post-merge-2026-10-27.md](docs/evidencia/estado-post-merge-2026-10-27.md).

## 3. Reglas no negociables

1. **No inventar resultados.** Un mock, fixture, captura o diseño no es evidencia de una simulación, despliegue, costo o benchmark.
2. **No duplicar ciencia en el frontend.** Validación, SEIR, métricas, agregados, costos y decisiones viven en backend; el frontend presenta y valida contrato.
3. **No cambiar semillas ni escenarios para ocultar un resultado.** T-22 v1 es un registro congelado; si hay un cambio semántico, crear v2 y conservar v1.
4. **No editar `specs/validation/t22-v1` después de observar resultados.** Los resultados van en un informe nuevo; el protocolo no se reescribe.
5. **No afirmar que `targeted` gana siempre.** Reportar medias, empates, pérdidas, intervalos y límites por raíz.
6. **No declarar PRO listo por tener UI o fixtures.** P-02..P-08 requieren contrato, backend, pruebas, estados reales y evidencia.
7. **No desplegar, publicar, crear PR, ejecutar lotes AWS grandes ni usar credenciales sin autorización explícita.**
8. **No introducir secretos** en código, logs, capturas, variables Vite, Terraform ni documentación.
9. **No romper hashes.** Cualquier cambio del motor debe conservar las fixtures existentes o versionar el modelo y explicar el impacto.
10. **Documentar en español** y dejar comandos, resultados, límites y enlaces verificables.

## 4. Orden de trabajo

El orden oficial está en [docs/plan-pro-iteraciones.md](docs/plan-pro-iteraciones.md). No se salta una dependencia sin registrar la decisión.

1. **I-01 — cerrar rendimiento y T-22.** Los controles ya pasan; falta ejecutar primaria y contrastes, reproducir, analizar y publicar el gate. No iniciar P-04 antes de cerrar esto.
2. **I-02 — P-02.** Política adaptativa versionada, explicable y observable; no redefinir silenciosamente `targeted`.
3. **I-03 — P-05.** Fuente real de dengue en Manabí con procedencia, hash, normalización y límites. Sin datos inventados.
4. **I-04 — P-03.** Jobs Monte Carlo locales, manifiesto, progreso, cancelación, idempotencia y agregado reproducible.
5. **I-05 — P-06.** Modelo/preset calibrado y validación fuera de muestra.
6. **I-06 — P-08.** Informe para alcaldía desde un experimento validado.
7. **I-07 — P-07.** Cierre de mapa/animación, sincronización, rendimiento y accesibilidad.
8. **I-08 — P-04.** AWS, Distributed Map, despliegue, cuotas, costos y URL pública.
9. **I-09 — cierre integral.** T-22 final, E2E, semilla externa, tiempos humanos, costos, arquitectura, pitch y aceptación.

## 5. Checklist base resumido

Detalle, dependencias y evidencia en [specs/tasks.md](specs/tasks.md).

- [x] T-02..T-12: entorno, contratos, configuración, semillas, grafo, SEIR, vacunación, agregación, exportación, API base y frontend inicial verificados localmente.
- [ ] T-13: formulario/preview/aceptación UI integral. Hay implementación; falta matriz de aceptación.
- [ ] T-14: comparación y estados éxito/empate/pérdida/error/parcial. Hay implementación; falta aceptación.
- [ ] T-15: sorpresa manual, exportación y representativa. Hay exportación/animación; falta prueba humana y diff base/sorpresa.
- [ ] T-16: E2E real, teclado, contraste, tabla equivalente y prueba moderada ≤3 min. Pendiente.
- [ ] T-17: viabilidad de cuenta/región/permisos/Budget. Pendiente.
- [ ] T-18: Terraform base y pipeline. Pendiente.
- [ ] T-19: staging, smoke y benchmark AWS. Pendiente; sin autorización de gasto.
- [ ] T-20: frontend público y health desde sesión limpia. Pendiente.
- [ ] T-21: arquitectura SVG, costos, README, runbook y Budget verificable. Pendiente.
- [ ] T-22: matriz científica. Protocolo congelado, controles PASA, primaria/contrastes pendientes.
- [ ] T-23: escenarios variables, semilla externa y reproducibilidad operativa. Pendiente.

## 6. Checklist PRO resumido

Detalle y aceptación en [specs/pro-roadmap.md](specs/pro-roadmap.md) y reparto en [specs/pro-workstreams.md](specs/pro-workstreams.md).

- [x] P-01: llegadas diarias e inventario, verificado localmente.
- [ ] P-02: backend, cliente y UI locales verificados; falta aceptación humana integral (T-13..T-16) y repetir en UI saldo agotado/sin elegibles.
- [ ] P-03: backend, cliente y pantalla PRO locales verificados; falta P-04 (AWS, miles de réplicas).
- [ ] P-04: miles de réplicas en AWS; no iniciado.
- [x] P-05: datos reales de dengue en Manabí; verificado localmente (94 semanas, 2025–2026).
- [x] P-06: calibración y preset versionado; cerrado en local con `manabi-dengue-2025-v1`, etiquetado `fitted-not-validated` porque la validación pierde frente a persistencia.
- [ ] P-07: backend de integridad temporal verificado; mapa/animación parcial, falta aceptación UI.
- [x] P-08: informe PDF para alcaldía verificado localmente, modo ficticio; contrato, API/CLI, descarga y evidencia. No aprueba T-22.
- [x] P-09: mapa geográfico y capa de agentes; verificado localmente como presentación.

## 7. Funcionalidades que ya existen

- Configuración canónica, defaults, límites y errores saneados.
- Generación de red `synthetic-manta-v1` con hogares, colegios, buses, mercados y barrios; calendario semanal; origen aleatorio/contexto/nodo.
- Motor SEIR diario con conservación, transiciones simultáneas, R absorbente y eventos causales.
- Políticas `none`, `random`, `targeted` pareadas; una dosis por persona; solo S elegible; dosis fallida consumida; eficacia por nodo/día.
- Agregación con media, mediana, P05/P95, diferencias pareadas, bootstrap R≥30 y réplica representativa.
- Exportación JSON reproducible, ZIP/CSV, `experimentHash` y reproducción CLI en proceso nuevo.
- API Lambda local con health/config/preview/compare, gzip, validación de hash, límites y errores.
- Interfaz Noche Cero: preview real, red, filtros, comparación, curvas, tabla, dosis, explicación de selección, reproducción, mapa OSM y exportaciones.
- P-01: calendario de llegadas, inventario, capacidad, costos educativos y exportación.
- P-02: política adaptativa completa en local (`adaptive-v1`): decisiones, motivos, exportación, reproducción, editor de la variante e historial diario de decisiones.
- P-03: trabajos Monte Carlo locales con `/v1/jobs`, cola, token, idempotencia, cancelación y resultado reproducible, conectados a la pantalla PRO (creación con la vista previa, credenciales de sesión, sondeo, reintento e historial).
- P-05: serie semanal real de dengue de Manabí (2025 S1–53 y 2026 S1–41) desde las gacetas ETV del MSP, con importador reproducible, geometría versionada, procedencia, controles de totales y límites. No alimenta el motor SEIR.
- P-06: calibración del SEIR de mezcla homogénea a la serie de P-05 (`manabi-dengue-2025-v1`): ventanas fijadas antes de mirar, bootstrap 120, perfil de verosimilitud condicional, puente declarado al motor y panel en la UI con la etiqueta «Ajustado, no validado». El resultado de validación es desfavorable y se conserva.
- P-09: mapa de Manta con polígonos OSM versionados y posiciones sintéticas deterministas.

## 8. Funcionalidades pendientes que otros agentes deben implementar

Prioridad inmediata:

1. **Terminar T-22.** Ejecutar las cinco raíces primarias y los cinco contrastes; conservar JSON/ZIP/logs; reproducir cada JSON y `base-root-0` tres veces; validar controles y generar informe. No editar el protocolo.
2. **P-02, cierre de aceptación.** El editor, la etiqueta de variante y el historial diario ya funcionan contra el motor real ([evidencia](docs/evidencia/p02-ui-2026-10-27.md)). Falta la aceptación humana T-13..T-16 y repetir en UI los escenarios de saldo agotado y sin elegibles.
3. **P-03 cerrada en local / P-04.** Rutas `/v1/jobs`, cliente y pantalla PRO verificados localmente ([evidencia](docs/evidencia/p03-ui-2026-10-27.md)). Queda P-04 AWS.
4. **P-06 cerrada en local, resultado desfavorable.** El preset `manabi-dengue-2025-v1` existe y se reproduce (`scripts/p06_calibrate.py verify`), pero la validación pierde frente a persistencia ([evidencia](docs/evidencia/p06-dengue-manabi-2026-10-27.md)). No se re-tunea: P-08 debe citar la etiqueta `fitted-not-validated`.
5. **P-08 cerrada localmente.** Informe PDF con cifras del JSON, costos, incertidumbre, fuentes, hash y límites; no reimplementar. [Contrato](specs/p08-report.md) y [evidencia](docs/evidencia/p08-informe-2026-10-27.md).
6. **P-07, frente UI pendiente.** Backend de integridad temporal verificado; no reimplementar. Cerrar sincronización mapa/red/curva/tabla, pausa/seek/velocidad, foco, movimiento reducido y rendimiento. [Contrato backend](specs/p07-backend-playback.md).
7. **P-04/T-17..T-21.** Terraform, staging, Distributed Map, URL pública, benchmark, costos, Budget, arquitectura y documentación de entrega.

## 9. Comandos de verificación

Backend, desde `backend/`:

```sh
.venv/bin/python -m pytest -q
.venv/bin/python -m ruff check src tests
.venv/bin/python -m ruff format --check src tests
.venv/bin/python -m mypy
```

Frontend, desde `frontend/`:

```sh
npm test -- --run
npm run typecheck
npm run build
```

Servidores locales, desde la raíz:

```sh
backend/.venv/bin/python scripts/serve_api.py
cd frontend && npm run dev -- --host 127.0.0.1 --port 5174
```

T-22, desde la raíz:

```sh
backend/.venv/bin/python scripts/check_validation_protocol.py
backend/.venv/bin/python scripts/run_t22.py --help
```

Los controles ya se ejecutaron en `.tools/t22-v1-attempt-01`. Para continuar la matriz con reanudación:

```sh
backend/.venv/bin/python scripts/run_t22.py \
  --attempt .tools/t22-v1-attempt-01 --resume --group all
```

Antes de ejecutar, leer [specs/validation/t22-v1/README.md](specs/validation/t22-v1/README.md). El intento y los JSON grandes están bajo `.tools/` y no se versionan.

Pruebas PRO locales, desde la raíz. `verify_jobs_flow.mjs` requiere la API de `scripts/serve_api.py` en `:8000`; `verify_adaptive_integration.mjs` usa `:18002` por defecto y acepta `API_BASE`. Para el navegador hace falta Vite en `:5174`.

```sh
node --experimental-strip-types scripts/verify_adaptive_integration.mjs
node --experimental-strip-types scripts/verify_jobs_flow.mjs
```

Datos de P-05, desde la raíz (sin red ni PDF):

```sh
backend/.venv/bin/python scripts/p05_import_dengue.py verify
```

Calibración de P-06, desde la raíz (sin red):

```sh
backend/.venv/bin/python scripts/p06_calibrate.py verify
backend/.venv/bin/python scripts/p06_calibrate.py summary
```

Comandos, pasos y resultados esperados de cada funcionalidad PRO ya cerrada están en [docs/plan-pruebas-local.md](docs/plan-pruebas-local.md). Ese documento crece solo cuando la funcionalidad existe y está verificada.

## 10. Evidencia, Git y commits

- Rama de trabajo: `feat/backend-contratos`. Si se paraleliza, cada agente crea una rama corta desde ella y no comparte la misma rama de implementación.
- Commits pequeños, en español: `feat(pro-p02): ...`, `fix(pro-p02): ...`, `docs(pro): ...`, `test(motor): ... (CA-01)`.
- Cada tarea cerrada necesita: aceptación escrita, pruebas nuevas y existentes, lint/tipos/build, evidencia ejecutada, documentación, sin secretos, commit/push y límites visibles.
- La evidencia va en `docs/evidencia/`; no guardar credenciales ni datos personales. Los resultados crudos grandes van en `.tools/` y el informe resume hashes/rutas.
- No marcar `[x]` por código, mock o spec. Tampoco por una ejecución parcial.

## 11. Trampas conocidas

- **T-22 no está aprobado.** Los controles pasan, pero faltan primaria y contrastes. `base-root-0` no representa el gate.
- **El benchmark de 44 s no es el costo de exportar.** Exportar un JSON de 8,3 MB con validación/ZIP y reproducirlo tarda minutos; presupuestar la matriz completa por decenas de minutos.
- **`scripts/run_t22.py` no ha corrido la matriz completa.** Su compilación, Ruff y controles funcionaron; aun así, revisarlo antes de confiar en él para primaria/contrastes.
- **La API síncrona está limitada a 2..30 réplicas.** Los trabajos de 2..100 viven en `/v1/jobs`; no presentar `repetitions` del endpoint síncrono como jobs asíncronos.
- **P-03 es local y no durable.** La pantalla PRO usa la API real, pero reiniciar el servidor pierde los trabajos; la UI solo avisa. No es AWS ni evidencia de miles de réplicas.
- **Los datos de P-05 son provinciales y preliminares.** `manabi-dengue-weekly-v1` no tiene granularidad de Manta, 2026 llega hasta la SE 41 y el dataset no alimenta el simulador. No es calibración ni evidencia de riesgo local; el control de 2025 es indirecto (tasas), no una tabla de casos.
- **El preset de P-06 no está validado.** `manabi-dengue-2025-v1` pierde frente a persistencia en 2025 y 2026 (`fitted-not-validated`); su `β` es preciso solo condicionado al modelo y `N`–`ρ` siguen confundidos. No re-tunear ventanas ni semillas, y no presentarlo como calibración validada.
- **P-01/P-09 no cierran PRO.** P-02, P-03, P-06 y P-08 tienen implementación local verificada; P-04 sigue abierto, y T-13..T-16 por aceptación humana. P-08 no equivale a aprobar T-22.
- **El mapa no es evidencia epidemiológica.** OSM y posiciones sintéticas no prueban riesgo ni movilidad real.
- **El Budget no está operativo.** 0/2 destinatarios verificados; una alerta no detiene el gasto.
- **No hay URL pública ni AWS desplegado.** `infra/` está vacío.
- **La semilla del jurado es externa y sigue pendiente.** No agregarla retrospectivamente a las 150 unidades primarias.
- **La aceptación humana no se mide con el tiempo del script.** CA-12 y RNF-05/06 requieren una persona y acceso.

## 12. Primer día de un agente

1. Leer este archivo, [docs/traspaso-agentes.md](docs/traspaso-agentes.md), PRD §7, TRD §18 y [docs/plan-pro-iteraciones.md](docs/plan-pro-iteraciones.md).
2. Ejecutar `git status` y los checks del frente antes de tocar código.
3. Elegir la primera tarea de la cola que no tenga dependencia abierta; no reordenar por conveniencia.
4. Escribir o ajustar la aceptación y la prueba que falla antes de implementar.
5. Implementar lo mínimo, verificar, documentar evidencia y limitaciones.
6. Hacer commit pequeño y push al terminar la iteración, aunque sea parcial; decirlo claramente.
7. Si el resultado es desfavorable, conservarlo. No elegir semillas, escenarios ni métricas después de ver los resultados.

Plantilla de instrucción para otro agente:

```text
Lee AGENTS.md y docs/traspaso-agentes.md. Trabaja solo en la tarea [T-XX/P-XX].
Respeta el orden de docs/plan-pro-iteraciones.md y las reglas de AGENTS.md.
Antes de codificar, escribe la aceptación y la prueba que falla. No inventes
resultados, no cambies semillas ni protocolos congelados y no despliegues sin
autorización. Al terminar entrega archivos tocados, comando ejecutado,
resultado observado, evidencia, riesgos y pendientes.
```
