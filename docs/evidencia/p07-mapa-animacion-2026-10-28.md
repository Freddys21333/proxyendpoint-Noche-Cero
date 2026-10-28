# Cierre P-07: mapa temporal, animación y accesibilidad

Fecha: 2026-10-28.
Alcance: cierre de visualización temporal sincronizada entre red de contactos y mapa geográfico de Manta; navegación paso a paso bidireccional, soporte estricto de movimiento reducido (`prefers-reduced-motion`) y atajos de teclado accesibles.

## 1. Implementación

1. **Navegación temporal bidireccional y controles de transporte:**
   - Se añadió la acción `step-back` en [`frontend/src/lib/simulation-playback.ts`](../../frontend/src/lib/simulation-playback.ts) para retroceder un día sin necesidad de recurrir al control deslizante (`seek`) o reiniciar desde el día cero.
   - Botón `Retroceder un día` (`StepBack`) con límites estrictos en día 0, pausando de inmediato si la reproducción automática estaba en curso.
   - Sincronización continua de la persona seleccionada (`selectedPersonId`) y los conteos SEIR entre la vista de Red (`Cytoscape`) y el Mapa geográfico OSM (`Leaflet`).

2. **Accesibilidad y preferencia de movimiento reducido:**
   - Detección automática de la media query `(prefers-reduced-motion: reduce)` en [`SimulationWorkspace.tsx`](../../frontend/src/components/SimulationWorkspace.tsx) sincronizada con el estado del reproductor.
   - Botón manual de alternancia `Movimiento reducido` en la fila de accesibilidad para permitir al operador forzar el modo sin transiciones.
   - Reglas CSS dedicadas en [`ContactNetwork.css`](../../frontend/src/components/ContactNetwork.css) y [`GeographicMap.css`](../../frontend/src/components/GeographicMap.css) para anular duraciones de animación y transiciones (`0.01ms !important`) cuando el modo reducido está activo.

3. **Atajos de teclado accesibles:**
   - Escucha de eventos de teclado en la ventana (desactivada automáticamente cuando el foco está en campos de texto, inputs o selects):
     - `Espacio` o `k`: alternar Reproducir / Pausar.
     - `ArrowRight` (→) o `l`: avanzar un día (`step`).
     - `ArrowLeft` (←) o `j`: retroceder un día (`step-back`).
     - `Home` (Inicio): reiniciar al día 0 (`reset`).
     - `End` (Fin): saltar al último día del horizonte simulado.

4. **Integridad del motor y determinismo:**
   - Ninguna animación o evento visual inventa desplazamientos de personas, contagios ni trayectorias ficticias: los agentes permanecen en sus sectores residenciales deterministas de Manta y solo cambian de estado SEIR conforme a las matrices exportadas por la réplica representativa del motor.
   - Los hashes de reproducción, semillas y resultados del backend no son alterados por la visualización.

## 2. Comandos y evidencia de verificación

| Verificación | Comando | Resultado |
|---|---|---|
| Pruebas frontend | `cd frontend && npm test -- --run` | **138 pruebas aprobadas** (incluyendo retroceso temporal, alternancia de movimiento reducido y límites de navegación). |
| Tipos TypeScript | `cd frontend && npm run typecheck` | Aprobado con 0 errores. |
| Build frontend | `cd frontend && npm run build` | Aprobado. Bundle base: 122.67 KB gzip; chunks diferidos correctos. |
| Calidad backend | `cd backend && .venv/bin/python -m ruff check src tests && .venv/bin/python -m mypy` | Aprobado sin alertas en 21 archivos fuente. |

## 3. Estado de aceptación de P-07

- [x] Sin divergencias entre mapa, red, curva y tabla: mismo día, política, conteos SEIR e identidad de persona seleccionada.
- [x] Pausa, avance paso a paso, retroceso de día, seek y reinicio estables.
- [x] Bloqueo de estados inconsistentes y retención del estado inicial cuando no hay frames (`no-frames`).
- [x] Soporte estricto de preferencia de movimiento reducido (`prefers-reduced-motion`) y atajos de teclado accesibles.
- [x] Ninguna trayectoria o contagio inventado; transiciones limitadas a estados causales del motor.
- [x] La visualización no altera RNG, semillas ni hashes del experimento.
