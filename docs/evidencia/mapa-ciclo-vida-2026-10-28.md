# Corrección de ciclo de vida del mapa — 2026-10-28

## Resultado

Corregido `Cannot read properties of undefined (reading 'clearRect')` al actualizar la población o desmontar el mapa. Backend, contratos, posiciones sintéticas, estados SEIR y protocolo T-22 permanecen intactos.

## Causa y cambio

Leaflet 1.9.4 puede ejecutar `_redraw` directamente al reajustar límites, poniendo `_redrawRequest` a null cuando otro callback RAF anterior sigue pendiente. Al retirar el renderer, su limpieza no tiene ya ese handle para cancelarlo; el callback tardío entra en `_clear` con el contexto canvas destruido. Se observó en navegador un `_redraw` posterior a `_destroyContainer`, sin contexto ni mapa.

La capa de agentes envuelve el punto de entrada de redibujado antes de registrar marcadores. Mientras existe, delega al método original conservando su contexto; después de destroy, el callback resulta inocuo. Se mantiene la retirada normal de capas/renderer/listeners y la idempotencia. No se capturan ni ocultan excepciones globales ni se modifica node_modules.

El acceso interno de Leaflet queda acotado a `_redraw`, detectado antes de envolverlo. Debe repetirse la regresión real al actualizar Leaflet; no se sustituye por acceso a `_ctx` ni manipulación de handles RAF privados.

## TDD y verificación

- Rojo: `node --experimental-strip-types --test frontend/src/lib/geographic-agents-layer.test.ts`: 1 fallo y 1 éxito. El callback encolado después de destroy intentaba dibujar un renderer retirado.
- Verde: mismo comando, 2 éxitos. Se conserva dibujo normal antes del cierre, eliminación idempotente y protección de clics pendientes.
- `npm test -- --run`: **150 pruebas pasan**.
- `npm run typecheck` y `npm run build`: correctos.
- Navegador real Edge, API :18012 y Vite :5188: previo al cambio se reprodujo clearRect al consultar red y navegar PRO/red. Después, partiendo de recarga limpia (sin instrumentación de depuración), se consultaron poblaciones 60/61/62, se alternó mapa/red y PRO/exploración, se ejecutó comparación real con 7 días y 30 réplicas, se avanzó y retrocedió un día y se redimensionó a 390×844 y 1280×900. **pageErrors=[]**, cuatro ciclos de navegación. No se interceptó ni simuló la respuesta backend.

Script local de navegador: `.tools/verify-map-lifecycle.js`, ejecutado con `npx --yes @playwright/cli -s=merge-params run-code --filename=.tools/verify-map-lifecycle.js`. La evidencia del fallo previo está también en el [informe del merge](merge-parametros-comprensibles-2026-10-28.md); se conserva como registro histórico.

## Límites

Esta corrección cierra el error de canvas registrado durante el merge. No cierra aceptación humana/táctil, accesibilidad integral ni rendimiento visual de P-07. No se ejecutó AWS ni se reinició la API compartida. Las pruebas backend no se repitieron: no hay cambios en backend/esquemas/datos y la última suite verificada es de 510 pruebas.
