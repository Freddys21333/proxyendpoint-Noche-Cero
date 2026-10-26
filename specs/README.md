# Especificaciones compartidas

Las specs detallan el [PRD](../PRD.md) y el [TRD](../TRD.md) para coordinar la versión base antes de dividir la implementación.

| Documento | Contenido | Estado |
|---|---|---|
| [requirements.md](requirements.md) | Alcance, requisitos RF/CA, parámetros y aceptación | Borrador para revisión del equipo |
| [design.md](design.md) | Módulos, contratos, motor, UI, AWS y decisiones abiertas D-01..D-08 | Borrador para revisión del equipo |
| [tasks.md](tasks.md) | Tareas T-01..T-23, frentes técnicos, dependencias y evidencia de terminado | Planificación; implementación pendiente |
| [agreements.md](agreements.md) | Decisiones D-01..D-08, contrato detallado y ejemplos de aceptación | Diseño adoptado; comprobaciones AWS pendientes |

Leer requisitos, diseño y acuerdos antes de tomar una tarea. Los esquemas ejecutables y fixtures aún no existen: se crean en T-03 a partir del contrato adoptado, sin confundir ejemplos documentales con resultados reales. Backend, frontend e infraestructura ya tienen definidos sus límites e interfaces para avanzar; T-17 conserva las verificaciones externas de AWS.

Se adopta esta organización de tres documentos en lugar del listado anterior de specs numeradas. El detalle de cada incremento se mantiene en sus secciones/tareas y solo se añaden anexos cuando haga falta. Estados de avance: borrador, lista, en implementación, verificada; verificar documentación no implica verificar el software.
