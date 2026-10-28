# Elegir el origen del brote viendo a la persona

Solicitud: mover Número de persona debajo de Origen del brote y dar sentido a la selección mostrando dónde está la persona.

Aceptación: el número aparece inmediatamente después del selector; se puede elegir una persona visible en mapa o red; elegirla actualiza origen y número juntos, invalida los resultados anteriores y pide consultar de nuevo. La consulta posterior centra y selecciona esa persona, también cuando se escribe su número manualmente. No se describe como único caso inicial si hay más casos configurados.

Implementación: se reutiliza `applyScenario`, se registran las ediciones de `origin` y `node` y se mantienen validación, cancelación e invalidación existentes. La ficha del mapa usa un botón DOM con `textContent`; una referencia al manejador actual evita reconstruir los marcadores al cambiar su identidad. No se automatizan consultas ni se modifican motor, semillas, contratos o posiciones.

Prueba en navegador `:5174`, con 60 personas, 7 días y 10 dosis:

- Antes: orden Origen → Facilidad de contagio → Número de persona. Después: Origen → Número de persona → Facilidad de contagio.
- Número manual 7: la consulta centra el mapa y abre Persona 7 como zombie inicial.
- Pulsación sobre un punto visible, sin buscar un ID: se abrió Persona 27; Elegir como origen actualizó el campo a 27 y deshabilitó la comparación. Tras consultar, la ficha mostró Persona 27 como zombie inicial. Se conservaron población, duración y dosis.
- Número manual 0: Origen 0 en el estado y ficha visible Persona 0, Zombie. Se contempla explícitamente cero, sin comprobarlo por veracidad.
- Inspector de Red: elegir otra persona y activar el botón con Enter actualizó ambos campos. Desde Origen aleatorio, la acción cambió a Persona específica con número 2; la consulta mostró Persona 2 como zombie inicial.
- Número 60 en población 60: error local y foco en el campo; el valor no se recorta silenciosamente.
- A 320 px CSS: documento y espacio útil de 308 px; campo de 275 px, sin desbordamiento horizontal.

Verificación: `npm test` con 151 aprobadas; `npm run build` con TypeScript y producción correctos. Sin runner de componentes: evidencia RED/GREEN en navegador, sin añadir pruebas que solo repitan el marcado.

Risk: none.
