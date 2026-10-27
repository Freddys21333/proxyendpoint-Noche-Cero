# Ajuste visual de formularios y preset — 2026-10-27

Solicitud: ocultar temporalmente el preset de dengue y unificar el diseño de las cajas de entrada.

El panel DenguePresetPanel se renderiza solo si SHOW_DENGUE_PRESET está activo; actualmente es false. Se conservan dataset, preset, lógica y pruebas. No se alteran parámetros, motor ni hashes.

Los campos numéricos de CombinedInterventions y ResourceScheduleEditor ahora usan `.input-wrap`, igual que los parámetros base y el editor adaptativo. Los campos PRO comparten altura mínima, tipografía, fondo, radio de borde y foco del tema Noche Cero; se mantiene el borde de error para aria-invalid.

Verificación ejecutada: `npm test` (135 aprobadas) y `npm run build` (typecheck/build correctos). En Edge con playwright-cli, se comprobó que no existe el botón «Cargar preset de dengue» y se habilitaron presupuesto, inventario y política adaptativa. Los estilos calculados de los 18 campos numéricos visibles del panel coinciden: altura mínima 44 px, fondo rgb(23,22,32), radio 5 px y fuente 14 px. Los campos avanzados comparten la misma clase Field de los parámetros principales; las filas de entregas usan el mismo helper del inventario.

Cambio exclusivamente visual, sin agregar pruebas que repliquen selectores CSS ni tocar la validación de valores. No acredita aceptación integral de accesibilidad o dispositivos móviles.
