# Comité de Contención de Manta

Simulador de propagación y comparación de estrategias de contención sobre una población sintética.

Simulará una plaga SEIR sobre una población sintética inspirada en Manta y comparará vacunación estratégica con no intervenir y vacunar al azar, usando recursos limitados y experimentos reproducibles. Escenario educativo con parámetros del equipo.

**Estado:** especificaciones, entorno backend, contratos, normalizador de configuración, primitivas de reproducibilidad y experimentos SEIR con exportación y reproducción verificados localmente. El backend ejecuta y resume none/random/targeted, exporta JSON/CSV y reproduce el hash en otro proceso. Los cuatro handlers API están integrados y verificados localmente; la interfaz muestra preview, comparación y curvas reales y descarga el experimento JSON. La animación de una réplica representativa ya usa estados diarios reales y permite alternar estrategias. El inspector explica las selecciones de vacunas y muestra dosis efectivas/fallidas de la réplica. La red permite agrupación visual por barrio, hogar, colegio, bus o mercado y distribución circular. La vista **Mapa** (feature P-09) sitúa a las personas sintéticas sobre polígonos residenciales OSM versionados sin alterar el modelo ni los hashes. ZIP con CSV disponible para experimentos vigentes; despliegue pendiente. Se conserva además el [prototipo local exploratorio](prototype/README.md) con simulación y visualización.

## Documentación

- [Traspaso operativo para agentes](AGENTS.md) y [contexto detallado](docs/traspaso-agentes.md).
- [PRD: alcance y aceptación](PRD.md).
- [TRD: arquitectura, contratos y metodología](TRD.md).
- [Especificaciones compartidas](specs/README.md): [requisitos](specs/requirements.md), [diseño](specs/design.md) y [tareas](specs/tasks.md).
- [Protocolo científico T-22](specs/validation/t22-v1/README.md): congelado; controles técnicos ejecutados y PASA; matriz primaria pendiente.
- [Validación funcional del flujo local](docs/evidencia/validacion-flujo-local.md).
- [Revisión de cumplimiento de la base](docs/evidencia/revision-base.md).
- [Auditoría PRO de partida](docs/evidencia/auditoria-pro-2026-10-27.md).
- [Estado y pendientes después del merge P-02/P-03](docs/evidencia/estado-post-merge-2026-10-27.md).
- [Plan de iteraciones PRO](docs/plan-pro-iteraciones.md): orden, aceptación, commits y contexto para agentes.
- [Costos y evidencia pendiente](docs/costos.md).
- [Instalación y verificación del backend](backend/README.md).
- [Contratos de API y ejemplos para frontend/backend](schemas/README.md).
- [Hoja de ruta PRO y frentes](specs/pro-roadmap.md): P-01..P-09 con estado, dependencias y aceptación; división backend/frontend en [pro-workstreams.md](specs/pro-workstreams.md).
- [P-09: mapa geográfico](specs/p09-geographic-map.md): mapa OSM, polígonos versionados, posiciones deterministas y aceptación.
- [Procedencia geográfica y reproducción](docs/manta-geography.md).
- [Laboratorio local ejecutable](prototype/README.md): grafo sintético, comparación SEIR y exploración inicial de cierre de capa y animación.
- [Guía para leer el grafo y evolución PRO](docs/lectura-y-pro.md).

## Estructura

- `backend/src/`: dominio, simulación, estrategias y adaptadores HTTP.
- `backend/tests/`: pruebas del motor y contratos.
- `frontend/src/`: interfaz React/TypeScript con API, grafo, resultados y exportación reales.
- `schemas/`: contratos OpenAPI/JSON Schema y ejemplos mock.
- `infra/`: futura infraestructura AWS con Terraform.
- `scripts/`: reproducción/exportación, servidor API local y utilidades de entorno.
- `specs/`: especificaciones incrementales antes de implementar.
- `docs/evidencia/`: verificaciones locales y resultados observados.

Se adopta la separación backend/frontend del TRD. La carpeta local vacía `src/` no tiene contenido que versionar y no forma parte de la estructura acordada.

## Trabajo y siguiente incremento

Commits pequeños con mensajes en español y referencia RF/CA cuando corresponda. El comportamiento se desarrolla con TDD: prueba que falla, implementación mínima y refactorización; las verificaciones disponibles deben pasar antes de publicar.

Las interfaces están fijadas en [los acuerdos técnicos](specs/agreements.md). T-02..T-12 están verificados localmente; T-13..T-16 tienen integración real documentada en I-01..I-08, pero faltan criterios de aceptación. I-09 corrige la validación de preview y el consumo de configuración publicada. Por aclaración del responsable (2026-10-27), los casos del jurado se configuran manualmente; no hay presets fijos obligatorios. El siguiente trabajo es cerrar T-22 (I-01) con la matriz primaria/contrastes y decidir el límite de rendimiento; después siguen la UI de P-02/P-03 y P-05. El protocolo T-22 v1 está preparado y congelado; sus cinco controles técnicos ya pasaron, pero la matriz primaria/contrastes y el resultado científico siguen pendientes, junto con infraestructura T-17/18 y despliegue T-19/20. Consulta la [revisión de base](docs/evidencia/revision-base.md) antes de declarar terminada una tarea. El orden de ejecución y la aceptación por iteración están en el [plan de iteraciones PRO](docs/plan-pro-iteraciones.md).

## Parámetros previstos

| Parámetro | Valor | Procedencia |
|---|---:|---|
| Población | 1.000 | Supuesto del equipo |
| Horizonte | 90 días | Supuesto del equipo |
| Casos iniciales | 1 | Reto oficial |
| Réplicas | 30 | Supuesto del equipo |
| Vacunas | 100 | Supuesto del equipo |
| Día de intervención | 0 | Supuesto del equipo |
| Eficacia | 100 % | Supuesto del equipo |
| Incubación media | 3 días | Supuesto del equipo |
| Duración infecciosa media | 7 días | Supuesto del equipo |
| Semilla | 20261026 | Supuesto del equipo |

La configuración completa y las fórmulas están en el TRD. Estos valores ya permiten ejecutar localmente experimentos y resúmenes Monte Carlo; el gate científico de T-22 y el benchmark AWS siguen pendientes. No se afirma que la estrategia supere las líneas base hasta medirlo.

## AWS y pendientes técnicos

Región elegida: `us-east-2` (Ohio). El enunciado permite elegir la región; no se requiere confirmar `us-east-1`. La decisión se documentará en el runbook de despliegue y en la evidencia de AWS.

El diagrama lógico está en la sección 2 del TRD. Falta exportar el diagrama de entrega a SVG y conservar su fuente editable. También están pendientes la URL pública, resultados, benchmark y estimación mensual.

### AWS Budget — evidencia provisional

Presupuesto `SpookyThon2026-PRO` configurado por **USD 20 mensuales**, con umbrales de costo real al **25/50/75/100 %** y de costo previsto al **100 %**.

**Pendiente:** la captura muestra `0/2` destinatarios verificados. El envío de verificación está bloqueado por permisos de `notifications-contacts` en la experiencia simplificada de AWS; al intentar modificar el rol, la consola solicita activar características avanzadas. La recepción de notificaciones aún no está confirmada y el requisito de alerta operativa no se declara completado.

Las siguientes capturas documentan la configuración observada, no una consulta en tiempo real ni el gasto final del evento. No muestran las direcciones de correo de los destinatarios; la barra superior conserva el nombre visible del titular.

![Detalle del AWS Budget: USD 20 mensuales y destinatarios pendientes de verificación](docs/budget.png)

![Cinco umbrales configurados para alertas de costo real y previsto](docs/budget2.png)

Una alerta de Budget no detiene automáticamente el gasto. Se actualizará la evidencia cuando se resuelva la verificación de destinatarios.

PRO tiene **P-01, P-05, P-06, P-08 y P-09 verificados localmente**, y **P-02/P-03 con backend y UI conectados a la API real**; **P-07 está parcial**; **P-04 sigue pendiente**. P-06 se publica como `fitted-not-validated`: la validación fuera de muestra pierde frente a persistencia. Se han ejecutado simulaciones y pruebas locales; la aplicación todavía no se ha desplegado en AWS. El laboratorio local permite probar conceptos de cierre de capa y animación, pero no acredita esos requisitos. El orden, la aceptación y el protocolo de commits están en el [plan de iteraciones PRO](docs/plan-pro-iteraciones.md).

Informe para alcaldía P-08: [contrato y comandos](specs/p08-report.md), [evidencia local](docs/evidencia/p08-informe-2026-10-27.md). Descarga PDF desde Comparación o el resultado completo de un trabajo PRO.

Rendimiento local: [mediciones de carga/exportación y equivalencia científica](docs/evidencia/rendimiento-validacion-2026-10-27.md). Optimización de validación; motor y hashes conservados.
