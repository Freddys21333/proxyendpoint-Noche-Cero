# Especificaciones compartidas

Las specs detallan el [PRD](../PRD.md) y el [TRD](../TRD.md) para coordinar la versión base antes de dividir la implementación.

| Documento | Contenido | Estado |
|---|---|---|
| [requirements.md](requirements.md) | Alcance, requisitos RF/CA, parámetros y aceptación | Borrador para revisión del equipo |
| [design.md](design.md) | Módulos, contratos, motor, UI, AWS y acuerdos D-01..D-08 | Diseño adoptado; verificación AWS pendiente |
| [tasks.md](tasks.md) | Tareas T-01..T-23, frentes técnicos, dependencias y evidencia de terminado | T-02..T-12 verificadas localmente; integración frontend parcial y validación/AWS pendientes |
| [Protocolo T-22 v1](validation/t22-v1/README.md) | Matriz científica, semillas, criterios y archivos de ejecución | Preparado y congelado; experimentos no ejecutados |
| [agreements.md](agreements.md) | Decisiones D-01..D-08, contrato detallado y ejemplos de aceptación | Diseño adoptado; comprobaciones AWS pendientes |
| [Hoja de ruta PRO](pro-roadmap.md) | P-01..P-08: recursos, adaptación, AWS Monte Carlo, datos reales/calibración, animación y PDF; ideas opcionales | Planificación 2026-10-27; estados y aceptación separados de la base |

Leer requisitos, diseño y acuerdos antes de tomar una tarea. [Los contratos ejecutables y ejemplos](../schemas/README.md) ya están verificados como artefactos estáticos de T-03, sin confundir mocks con resultados reales. Backend, frontend e infraestructura tienen definidos sus límites e interfaces para avanzar; T-17 conserva las verificaciones externas de AWS.

Se adopta esta organización de tres documentos en lugar del listado anterior de specs numeradas. El detalle de cada incremento se mantiene en sus secciones/tareas y solo se añaden anexos cuando haga falta. Estados de avance: borrador, lista, en implementación, verificada; verificar documentación no implica verificar el software.
