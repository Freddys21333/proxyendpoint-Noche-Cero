# Subtítulos uniformes del panel lateral

Solicitud: «En el menu lateral por favor que cada subtitulo este en negrita y todos con el mismo formato.»

Cambio en `frontend/src/noche-cero.css`: etiquetas de los campos con 13 px, peso 700, interlineado 1,45 y color `--ink`. Encabezados y desplegables del panel también usan peso 700, conservando su jerarquía de tamaños.

Antes, el navegador mostraba Origen del brote con peso 400, 12 px y otro color; Población y Duración usaban peso 500 y 13 px. Después se comprobaron las etiquetas básicas, persona específica, parámetros avanzados, presupuesto, cierres y brigadas: todas con peso 700, 13 px y `rgb(241, 236, 228)`.

Verificación ejecutada: `npm test`, 151 aprobadas y ninguna fallida; `npm run build`, TypeScript y producción correctos; lectura de estilos calculados y captura en navegador local `:5174`. Sin cambios en valores, validación, API ni comportamiento del formulario. No se añadieron pruebas que solo repitan CSS.

Risk: none.
