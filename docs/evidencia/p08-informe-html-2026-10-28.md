# Entrega parcial P-08: informe imprimible para alcaldía

Fecha: 2026-10-28. Alcance: escenario ficticio; respuesta de comparación validada en el frontend. Sin datos de dengue ni AWS.

## Implementación

- En la sección de resultados está disponible **Descargar informe sencillo para alcaldía**.
- Descarga un HTML autocontenido en español con opción de imprimir/guardar desde el navegador como PDF.
- Incluye resumen ejecutivo descriptivo, medias/medianas/P05–P95 de infectados acumulados, diferencias pareadas, tamaño de muestra, costos y presupuesto educativo cuando están configurados, parámetros, semilla, versiones, hash y límites.
- Conserva diferencias negativas y empates; distingue media observada de garantía/recomendación. Declara que la población es sintética y la plaga ficticia, no dengue.
- Los valores dinámicos se escapan antes de construir el HTML. No se modifica el JSON ni el hash del experimento.

## Verificación

- `npm test -- --run`: suite frontend aprobada después de agregar los casos de lenguaje ficticio, pérdida negativa, escape HTML, determinismo y costos.
- `npm run typecheck`: aprobado.
- `npm run build`: aprobado.
- El generador se carga al pulsar el botón; el build registra el chunk del informe en 3,19 KB gzip. El bundle JS inicial quedó en 122,42 KB gzip frente a 125,12 KB cuando el generador se importaba de forma eager durante esta iteración.
- Pruebas: [mayor-report.test.ts](../../frontend/src/lib/mayor-report.test.ts).

## Pendiente para cerrar P-08

- La salida actual es HTML imprimible; no genera un PDF directamente ni garantiza la paginación entre navegadores.
- Falta revisión visual con un experimento real en navegador y contraste del informe contra su JSON exportado.
- No hay dataset/cifras calibradas de dengue. Este informe solo representa el modelo ficticio.
