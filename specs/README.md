# Especificaciones compartidas

Las specs detallan el [PRD](../PRD.md) y el [TRD](../TRD.md) para coordinar la versión base antes de dividir la implementación.

| Documento | Contenido | Estado |
|---|---|---|
| [requirements.md](requirements.md) | Alcance, requisitos RF/CA, parámetros y aceptación | Borrador para revisión del equipo |
| [design.md](design.md) | Módulos, contratos, motor, UI, AWS y acuerdos D-01..D-08 | Diseño adoptado; verificación AWS pendiente |
| [tasks.md](tasks.md) | Tareas T-01..T-23, frentes técnicos, dependencias y evidencia de terminado | T-02..T-12 verificadas localmente; integración frontend parcial y validación/AWS pendientes |
| [Protocolo T-22 v1](validation/t22-v1/README.md) | Matriz científica, semillas, criterios y archivos de ejecución | Preparado y congelado; experimentos no ejecutados |
| [agreements.md](agreements.md) | Decisiones D-01..D-08, contrato detallado y ejemplos de aceptación | Diseño adoptado; comprobaciones AWS pendientes |
| [Hoja de ruta PRO](pro-roadmap.md) | P-01..P-09: recursos, adaptación, AWS Monte Carlo, datos reales/calibración, animación, PDF y mapa geográfico; ideas opcionales | Planificación 2026-10-27; estados y aceptación separados de la base |
| [Frentes de trabajo PRO](pro-workstreams.md) | División backend/frontend para P-01..P-09, contratos, trabajo paralelo, integración incremental y trazabilidad a código/pruebas | Guía de coordinación; respeta el alcance y estado de la hoja de ruta |
| [P-01: inventario diario](p01-resource-schedule.md) | Entregas, recepción/consumo, capacidad, conservación y compatibilidad | Verificado localmente; no implica P-02 ni despliegue AWS |
| [P-02: política adaptativa](p02-adaptive-policy.md) | Umbrales, anillo, decisiones, motivos, exportación y contrato frontend | Backend verificado localmente; editor e historial visual pendientes |
| [P-09: mapa geográfico](p09-geographic-map.md) | Mapa OSM, polígonos versionados, posiciones deterministas, capa de agentes y aceptación | Verificado localmente como presentación; no cambia modelo, contratos ni hashes |

Leer requisitos, diseño y acuerdos antes de tomar una tarea. [Los contratos ejecutables y ejemplos](../schemas/README.md) ya están verificados como artefactos estáticos de T-03, sin confundir mocks con resultados reales. Backend, frontend e infraestructura tienen definidos sus límites e interfaces para avanzar; T-17 conserva las verificaciones externas de AWS.

Se adopta esta organización de tres documentos en lugar del listado anterior de specs numeradas. El detalle de cada incremento se mantiene en sus secciones/tareas y solo se añaden anexos cuando haga falta. Estados de avance: borrador, lista, en implementación, verificada; verificar documentación no implica verificar el software.

Contrato PRO de ejecución: [P-03, trabajos Monte Carlo locales](p03-monte-carlo-jobs.md), backend verificado; interfaz visual y P-04 AWS pendientes.
