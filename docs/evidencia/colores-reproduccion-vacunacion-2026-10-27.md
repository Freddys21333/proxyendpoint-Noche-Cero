# Colores de reproducción y vacunación — 2026-10-27

Ajuste CSS limitado al tema Noche Cero: exploración de días con acento naranja, selectores de estrategia/velocidad con fondo oscuro y texto claro; panel de vacunación oscuro, inventario verde lima, encabezados claros, texto secundario legible, tabla y acciones con colores del tema. No cambia los colores SEIR ni los bordes violetas que codifican eficacia de dosis en la red.

Verificación: `npm run build` (typecheck/build correctos), `git diff --check` y recorrido Edge mediante playwright-cli con API real, N=60/T=7/K=12/R=2. Se ejecutó preview/comparación y se regresó a red. Estilos calculados: slider accent rgb(255,130,80); selector de velocidad background rgb(23,22,32), texto rgb(241,236,228); vacunación background rgb(36,33,45), encabezado rgb(241,236,228), párrafos rgb(196,184,198). La tabla de vacunación se inspeccionó seleccionando targeted.

Cambio visual sin modificar comportamiento, hashes ni contratos. No se añaden pruebas que repliquen selectores CSS. Esto no sustituye una auditoría completa de accesibilidad.
