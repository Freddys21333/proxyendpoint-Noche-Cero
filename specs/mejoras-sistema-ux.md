# Mejoras del sistema y experiencia de usuario

Fecha: 2026-10-27. Estado: **backlog acordado para preparar implementación; ninguna mejora se declara verificada aquí**.

Fuente: `Mejoras_SpookyThon_2026.md`, revisión del 27 de octubre, proporcionado por el equipo. Se incorporan sus recomendaciones de producto y calidad técnica; sus ejemplos y figuras son ficticios y no se incorporan como resultados. Este análisis documental no sustituye una auditoría visual completa ni una prueba humana.

## Alcance y relación con el plan existente

Se busca que una persona pueda configurar → ejecutar → explorar → comparar → entender la decisión y sus recursos. Se incluyen interfaz, organización de funcionalidades, ayuda, métricas, accesibilidad, estados e integración con el backend.

Quedan fuera de este backlog: pitch, diapositivas, ensayo, reparto por personas, despliegue, Terraform, servicios AWS, facturación y Budget de infraestructura. Esos trabajos conservan su planificación separada. **El presupuesto educativo de las intervenciones sí forma parte del sistema y de estas mejoras.** El informe PDF permanece en P-08; aquí solo se contempla facilitar las exportaciones existentes.

Este anexo complementa [requisitos](requirements.md), [diseño](design.md), [tareas](tasks.md) y [plan PRO](../docs/plan-pro-iteraciones.md). Las prioridades de UX siguientes ordenan este frente, no cambian las dependencias científicas ni habilitan P-04. Antes de implementar cada ficha se actualizarán requisitos, diseño y tareas afectados, con aceptación y prueba del comportamiento ausente. No se modifican T-22 v1, semillas, hashes, fórmulas ni defaults por esta planificación.

## Qué se reutiliza y qué se debe mejorar

| Propuesta del documento | Situación de partida revisada | Tratamiento |
|---|---|---|
| Recomendación explicable (§7) | `backend/src/simulation/experiments.py` ya devuelve ganador por media, confianza, motivos y límites; `ComparisonResults.tsx` los presenta. | Mejorar jerarquía, lenguaje e incertidumbre; no crear otro recomendador en React. |
| Curvas, percentiles y estadística (§3, §8, §10) | `ComparisonChart.tsx` y `ComparisonResults.tsx` ya muestran medias, P05–P95 y diferencias pareadas con bootstrap cuando corresponde. | Contextualizar y simplificar la lectura; añadir solo métricas que falten mediante contrato backend. |
| Presupuesto y recursos (§7–8) | `CombinedCostResults.tsx`, motor combinado y P-01 ya registran gasto, saldo e inventario. | Hacer visibles sus diferencias y explicar los cálculos y supuestos educativos. |
| Reproducción y mapa (§5) | P-07/P-09 tienen mapa, red, selección temporal y políticas; aceptación integral pendiente. | Pulir organización, sincronización, accesibilidad y densidad; no reconstruirlos. |
| Configuración básica y avanzada (§6) | Hay formulario y parámetros avanzados; cambios invalidan resultados según evidencia de integración local. | Reorganizar ayudas y validar el recorrido, conservando contratos. |
| Verificación del motor (§9) | Existe suite backend e integración local; T-22 completo sigue pendiente. | Revisar cobertura y añadir regresiones faltantes, sin presentar este backlog como validación científica. |
| Paleta propuesta (§4) | El producto usa Noche Cero y recibió correcciones locales de fondos/campos/reproducción. | Mantener identidad y semántica SEIR; medir contraste y añadir apoyos no cromáticos. No añadir modo claro por esta propuesta. |

Referencias de partida: [integración real](../docs/evidencia/integracion-revisada-2026-10-27.md), [campos y preset oculto](../docs/evidencia/ajuste-campos-preset-2026-10-27.md), [colores](../docs/evidencia/colores-reproduccion-vacunacion-2026-10-27.md), [presupuesto combinado](../docs/intervenciones-combinadas.md), [inventario](p01-resource-schedule.md) y [estado general](../docs/evidencia/estado-post-merge-2026-10-27.md).

## Backlog priorizado

Avance técnico 2026-10-27: [datos para UX-02/03/04/05](decision-summary.md) verificados localmente: porcentajes, diferencia con siguiente alternativa, agregados financieros y motivos registrados; la UI deja de calcular gasto/cocientes. [Evidencia](../docs/evidencia/resumen-decision-2026-10-27.md). No cierra las fichas completas ni la aceptación humana.

Todas las fichas están pendientes de implementación o de aceptación del cambio concreto. Prioridad alta no significa ausencia total de funcionalidad.

### UX-01 · Alta · Ordenar el recorrido y las acciones

Fuente: §6, §8, §12. Vinculación: T-13..T-16.

- Organizar el recorrido con pasos y acciones claras: configurar, consultar red, comparar y revisar resultados. Mantener accesos a configuración y red sin perder el escenario.
- En resultados, colocar primero contexto del experimento y conclusión, después 3–4 indicadores principales; curvas, recursos y detalle estadístico a continuación. Revisar que el bloque de costos actualmente situado antes del encabezado no desplace la conclusión.
- Ubicar opciones especializadas y trabajos por lotes en un área avanzada con propósito y límites explicados. Evitar que «PRO» sea la única explicación de lo que hace una pantalla.
- Mantener exportación cerca de los resultados completos, sin ocultar el acceso al JSON/ZIP.

Aceptación: una persona identifica el siguiente paso en cada pantalla; puede volver, corregir y ejecutar de nuevo; las acciones imposibles explican qué falta. Probar teclado, pantalla estrecha y conservación del escenario. No convertir una ejecución parcial en resultado final.

### UX-02 · Alta · Hacer inequívoca la recomendación

Fuente: §7, §8. Vinculación: T-14 y comparación backend.

- Encabezar la conclusión con el criterio vigente: menor media de infectados acumulados; separar «menor media» de «ventaja respaldada».
- Con confianza descriptiva o no concluyente, indicar que no hay evidencia suficiente para recomendar una única opción; conservar visible el orden descriptivo y sus cifras.
- Presentar diferencia frente a no intervenir y frente a la alternativa siguiente, recursos usados y límites. Reutilizar campos existentes; si falta una comparación, definirla y calcularla en backend antes de mostrarla.
- Conservar empate y pérdida, sin predeterminar que Dirigida gana. No añadir un selector de optimización económica: cambiar el objetivo exigiría otra especificación de reglas y contrato.

Aceptación: escenarios reales de ventaja respaldada, empate, pérdida y pocas réplicas producen textos coherentes con `recommendation`. No se deduce confianza con un umbral inventado en frontend. La conclusión se basa en el agregado completo, nunca en el día o réplica animados.

### UX-03 · Alta · Dar contexto a indicadores y gráficos

Fuente: §3, §8, §10. Vinculación: T-14.

- Priorizar infectados acumulados, diferencia frente a la referencia, pico infeccioso y dosis utilizadas; al activar intervenciones, agrupar gasto/saldo en recursos sin multiplicar tarjetas.
- Cada indicador declara unidad, población base, horizonte o día y si representa media o réplica. Diferenciar infecciosos actuales de personas infectadas alguna vez.
- Añadir comparación horizontal de infectados por estrategia, misma escala y origen cero, etiquetas directas y tabla equivalente. Curvas temporales conservan sus controles y bandas explicadas.
- Mostrar diferencia absoluta y reducción relativa cuando el backend las publique. Con referencia cero, mostrar «No aplica» para el porcentaje; una diferencia negativa se presenta como aumento.
- Marcar el pico en la curva apropiada sin confundir el pico de una curva media con la media de los picos individuales.
- Sustituir expresiones ambiguas como «salvados» por «contagios evitados frente a…», con definición accesible y sin cambiar la métrica almacenada.

Aceptación: cifras y etiquetas se contrastan con el JSON; no hay NaN, infinito ni beneficio fabricado. Diferencias, porcentajes y denominadores tienen definición backend documentada. P05–P95 se describe como rango empírico; IC bootstrap es otro concepto y sigue requiriendo ≥30 réplicas.

### UX-04 · Alta · Explicar presupuesto, costo, gasto e inventario

Fuente: §6–8 y observación del equipo sobre cálculo económico. Vinculación: P-01/P-02 y T-13..T-15.

- Agrupar controles en «Recursos y presupuesto», separando dinero, existencias, capacidad diaria y entregas. Mostrar costos unitarios junto a sus unidades: USD/dosis, USD/día de cierre, USD/atención por día.
- Incorporar ayuda breve: gasto = acciones ejecutadas × costo unitario; saldo = presupuesto − gasto acumulado; cargos calculados en Python con centavos enteros.
- Explicar prioridad vacunas → cierre → brigadas, cobro de dosis fallidas, ausencia de reserva para días futuros y que recibir insumos no añade financiación.
- En resultados, distinguir presupuesto inicial, gasto y saldo, con rótulo de agregado o réplica/día. Explicar costo por contagio evitado como cociente de medias; «No aplica» si no hay mejora positiva.
- Mostrar motivos reales de omisión: saldo insuficiente, falta de existencias, capacidad o personas elegibles. Reutilizar el registro del motor.

Aceptación: los montos coinciden con registros diarios y exportaciones; se prueban presupuesto cero, saldo agotado con inventario, dinero sin existencias, entregas futuras y dosis fallidas. Los valores se identifican como supuestos educativos editables; no como precios reales ni gasto AWS.

### UX-05 · Alta · Simplificar parámetros y ayuda contextual

Fuente: §6, §10. Vinculación: T-13.

- Mantener pocos controles básicos con unidades, explicación corta y rangos del contrato; agrupar transmisión, evolución, recursos y opciones reproducibles en avanzado.
- Explicar semilla, población y número de réplicas como conceptos distintos. Mostrar límites reales de comparación síncrona (2..30) y trabajos locales (2..100), sin ofrecer 300 como capacidad existente.
- Documentar la definición implementada de β, σ y γ y el origen educativo de defaults. No convertir automáticamente β a porcentaje ni σ/γ a duración sin verificar las ecuaciones y acordar una transformación exacta.
- Mostrar errores junto al campo, conservar los valores editados y hacer visible que editar requiere nueva ejecución. El preset dengue permanece oculto; este plan no lo reactiva ni altera su etiqueta `fitted-not-validated`.

Aceptación: la persona distingue dosis, dinero y réplicas; comprende cada unidad sin leer código. Ida y vuelta de controles conserva la configuración canónica; inválidos bloquean la petición y los resultados anteriores no se presentan como actuales.

### UX-06 · Media · Unificar mapa, red y reproducción

Fuente: §5, §12. Vinculación: P-07/P-09 y T-15..T-16.

- Agrupar estrategia, día, velocidad y reproducción en una barra consistente; mantener día actual y «réplica representativa» visibles, sin confundirlos con el promedio.
- Mantener leyenda S/E/I/R accesible, selección de agente sintético y capas opcionales. Evitar mostrar todos los vínculos por defecto si dificulta la lectura.
- Conservar día, política, selección y cámara al cambiar entre mapa y red cuando corresponda; sincronizar conteos y detalles con la misma respuesta. Las curvas agregadas deben conservar su etiqueta de promedio.
- Evaluar agrupación visual a bajo zoom y tamaño mínimo de nodos; si se incorpora agrupación, mostrar su conteo y no modificar posiciones ni estados científicos.
- Mantener rótulo de geografía de referencia y posiciones sintéticas. Dos mapas simultáneos quedan como extensión opcional posterior a medir rendimiento y utilidad.

Aceptación: pausa, reinicio, avance, seek y velocidad no producen divergencias ni eventos inventados. Probar día 0/T, cambio rápido de estrategia y configuración obsoleta. Agrupaciones conservan totales; movimiento reducido funciona y el rendimiento se mide con tamaño y entorno declarados.

### UX-07 · Media · Contraste, consistencia y accesibilidad

Fuente: §4–5, §12. Vinculación: T-16/P-07.

- Consolidar tokens Noche Cero para superficies, texto, controles y estados; revisar estilos heredados que introducen fondos blancos u opacidad en contenedores completos.
- Mantener colores SEIR consistentes entre mapa, red, curvas, tablas y leyendas. Reforzar con texto, símbolo, borde o patrón adecuado al componente.
- Medir contraste mínimo 4,5:1 para texto normal y 3:1 para texto grande y componentes esenciales; ajustar tokens con evidencia, sin sustituir toda la paleta por los colores ilustrativos del documento.
- Verificar foco visible, nombres accesibles, navegación de diálogos, mensajes anunciados, tablas equivalentes y distribución sin pérdida de acciones en móvil.

Aceptación: informe de contraste con pares evaluados, recorrido completo con teclado, revisión de tablas y prueba con movimiento reducido. La identificación de estados y acciones no depende exclusivamente del color. Una captura por sí sola no cierra accesibilidad.

### UX-08 · Alta · Cerrar estados, regresiones y aceptación humana

Fuente: §9–10, §12, §15. Vinculación: T-13..T-16 y P-07.

- Revisar carga, vacío, éxito, error, reintento, cancelación, respuesta parcial y resultado invalidado; progreso real en trabajos, sin porcentajes inventados.
- Auditar pruebas existentes antes de añadir casos: conservación SEIR, reproducibilidad, β=0, γ=0 si el contrato los admite, saldo y divisiones por cero. Dosis cero solo implica equivalencia entre políticas si tampoco hay otras intervenciones activas.
- Añadir E2E sobre API real para el recorrido reordenado, recomendaciones, exportación y sincronización. Registrar pruebas faltantes antes de implementar; no duplicar la suite científica en React.
- Prueba humana sin guiar: ejecutar un escenario, explicar la conclusión y localizar gasto y dosis. Registrar tiempo, errores y dudas; corregir y repetir con otra persona. Conservar el objetivo existente de aceptación ≤3 minutos donde corresponda; el tiempo de un script no lo demuestra.

Aceptación: evidencia con versión, configuración, comandos y resultados observados; checklist por estado y prueba humana. Las pruebas de software no se declaran validación epidemiológica ni cierran T-22.

## Secuencia de trabajo y cierre

1. Revisar brechas en las pantallas actuales y fijar la aceptación específica de UX-01..UX-05 con ejemplos reales. Capturar el antes sin datos personales.
2. Resolver claridad de conclusión, indicadores y presupuesto (UX-01..UX-05) en incrementos pequeños; ejecutar UX-08 para cada cambio.
3. Completar mapa y accesibilidad (UX-06/UX-07) coordinados con P-07 y sus dependencias; repetir la aceptación del recorrido completo.
4. Registrar evidencia y pendientes en `docs/evidencia/`, enlazarla desde las fichas y actualizar solo los checks realmente cumplidos de T-13..T-16/P-07.

Terminado por ficha: aceptación satisfecha, pruebas pertinentes, tipos/build cuando se toca frontend, evidencia ejecutada, límites visibles, documentación y commit pequeño en español. No se marca nada completado por esta incorporación documental. Las ampliaciones del contrato necesitan backend, validación cliente, exportación/reproducción y compatibilidad de hashes según su impacto.
