# P-07 · Integridad backend de reproducción temporal

Estado: **backend verificado localmente**, P-07 integral sigue abierto. [Evidencia ejecutada](../docs/evidencia/p07-backend-2026-10-27.md). Alcance autorizado: solo backend de P-07. Referencias: RF-12/13/19, P-07, [plan PRO](../docs/plan-pro-iteraciones.md). Se registra la decisión de trabajar este frente local mientras T-22 sigue pendiente; no se modifica el protocolo ni se habilita AWS.

## Brecha y aceptación

Frames y eventos opcionales no participan en `experimentHash`; el consumidor no debe confundir un hash correcto con una trayectoria válida. Se conserva el contrato actual, sin endpoint, campos, coordenadas ni cambios del motor. Una validación compartida se incorpora a exportación/carga/ZIP (y, por reutilización del exportador, compare/jobs e informe).

Antes de entregar o aceptar el documento:

- Identidad de réplica representativa coherente con la regla vigente (mediana de infectados de Dirigida, desempate por índice), semilla, grafo y orden de nodos/IDs. No escoger otra trayectoria por apariencia.
- Series diarias completas 0..T, conservación SEIR y progreso completo.
- Frames presentes: T+1, N estados en orden de nodeId, conteos diarios y estado inicial tras vacunación; transiciones válidas, vacunación efectiva y acumulado coherentes. Buscar también intercambios de personas que conserven conteos.
- Eventos presentes: orden canónico, día/IDs válidos, una transición por persona/día, origen inicial, transición desde el snapshot previo, contactos con arista/vecino infeccioso del intervalo anterior y vacunación coherente con selección. Reconstrucción exacta de frames y filas diarias cuando ambos existen.
- Mantener `frames=null` y eventos opcionales `null`: sin ambos no se inventa trayectoria; con frames sin eventos comprobar lo observable, sin afirmar causalidad de contactos. Los eventos presentes se verifican también sin frames.
- Hashes existentes y bytes del modelo preservados; no consumir RNG ni simular de nuevo. Medir el costo del validador sobre un tamaño declarado, sin sustituir el benchmark científico.

TDD: primero rechazar un frame con personas intercambiadas y conteos intactos, evento omitido/inválido, calendario incompleto o réplica incoherente; después aceptar trazas reales base, vacunación en 0/T, entregas/adaptación y ausencia de frames/eventos. Ejecutar suite completa, Ruff/mypy y evidencia local. Pausa, seek, velocidad, foco, cámara, movimiento reducido y aceptación visual permanecen en frontend; no cerrar P-07 integral por este incremento.
