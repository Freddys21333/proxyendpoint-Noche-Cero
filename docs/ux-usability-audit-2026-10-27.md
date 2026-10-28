> Documento histórico importado de codex/parametros-comprensibles. Sus recuentos y pendientes describen aquella revisión. Para el estado posterior al merge (150 pruebas frontend, 510 backend, trabajos reales e informe PDF/HTML existentes), ver [evidencia actual](evidencia/merge-parametros-comprensibles-2026-10-28.md).

# Auditoría de UX y usabilidad — Noche Cero

Fecha: 27 de octubre de 2026. Contexto: aplicación web educativa, población sintética de Manta; evaluación de un usuario que configura y compara un escenario por primera vez. Esta audiencia es una hipótesis de trabajo.

Se revisaron escenario, red, mapa, reproducción, comparación vacía y con resultados, intervenciones, ayuda, exportación y PRO. Métodos: `ux-heuristics-audit`, `cognitive-walkthrough` y `web-design-guidelines`; observación del navegador y lectura del código. No se entrevistó a usuarios y no se estiman porcentajes de éxito sin datos.

## Hallazgos críticos

No se reprodujo un bloqueo permanente de las tareas evaluadas ni pérdida de datos. Esto no equivale a una certificación de accesibilidad ni demuestra ausencia de problemas fuera de las rutas revisadas.

## Hallazgos mayores

| ID | Evidencia y costo para el usuario | Heurística | Corrección y estado |
| --- | --- | --- | --- |
| U1 | Después de consultar, las opciones de reproducción deshabilitadas, explicaciones y herramientas aparecían antes del escenario. La búsqueda de un parámetro se repetía en cada edición. | #6 Reconocimiento; #8 Minimalismo | **Aplicado:** escenario primero; vacunación en un grupo propio; herramientas, reproducción y registro en desplegables con nombres de tarea. El reproductor aparece cuando hay trayectoria. `PreviewNetwork.tsx:206`, `App.tsx:339`. |
| U2 | Consultar y Comparar intercambiaban posiciones tras cargar la red. La razón del botón inactivo dependía de pasar el puntero sobre él. | #1 Estado; #4 Consistencia; #6 Reconocimiento | **Aplicado:** posiciones estables y mensaje visible del siguiente paso, relacionado con ambos botones mediante `aria-describedby`. Se conserva la prioridad visual de la acción disponible. `App.tsx:399`. |
| U3 | En 320 px la cabecera provocaba desplazamiento horizontal. Algunos controles heredaban un estilo claro con texto verde y los bordes de campos tenían poca separación del fondo oscuro. | #4 Consistencia; #7 Eficiencia, con impacto de accesibilidad | **Aplicado:** navegación y estado en filas adaptadas; tema de reproducción coherente; bordes de entradas reforzados. Repetida la comprobación: documento de 308 px dentro del espacio útil de 308 px, sin desbordamiento de campos. `noche-cero.css:464`. |
| U4 | El borrador local de PRO anuncia 1.000–10.000 repeticiones distribuidas y AWS; el formulario posterior indica demostración local y máximo de 1.000. Hay que reconciliar dos descripciones incompatibles antes de iniciar. | #1 Estado; #2 Lenguaje del mundo real; #4 Consistencia | **Pendiente en borrador ajeno a este cambio:** titular «Demostración de trabajos masivos», límite visible de 1.000 y separación explícita de las funciones conectadas. Evidencia: `ProWorkspace.tsx:122`, `:125`; formulario observado en el navegador. |
| U5 | El informe local anuncia una estrategia ganadora y después presenta instrucciones fijas de priorización por conectividad; en el caso observado ganó Aleatoria. También se anuncia «costo por vida salvada» sin mostrar ese cálculo en el flujo revisado. El lector puede interpretar la presentación como una conclusión calculada. | #2 Correspondencia; #4 Consistencia; #5 Prevención de interpretaciones erróneas | **Pendiente en borrador ajeno a este cambio:** retirar instrucciones que no deriven del resultado, utilizar «Comparación del escenario educativo» y publicar únicamente métricas respaldadas por datos. `MayorReport.tsx:90`, `:157`; `ProWorkspace.tsx:68`. No se modificaron recomendaciones ni cálculos del borrador. |

Las severidades consideran frecuencia, impacto y persistencia: U1–U3 aparecen repetidamente al configurar o navegar; U4–U5 afectan la confianza e interpretación al entrar en PRO o leer el resultado. No son simples preferencias estéticas.

## Hallazgos menores

| ID | Problema observado | Heurística | Corrección y estado |
| --- | --- | --- | --- |
| U6 | La confirmación de consulta abría una ventana aunque la red ya estaba disponible y no había una decisión que proteger. | #3 Control y libertad; #7 Eficiencia | **Aplicado:** aviso con cantidad de personas/contactos, foco en Consultar red y comparación disponible sin cerrar una ventana. |
| U7 | «Horizonte», «Tasa de transmisión» y «Réplicas» en errores no coincidían con los campos; ayuda y exportación mezclaban tratamientos y términos técnicos. | #2 Lenguaje; #4 Consistencia; #9 Recuperación | **Aplicado en escenario, ayuda y etiquetas de errores:** Duración, Facilidad de contagio, Día de vacunación y Repeticiones. El límite sanitario y la precisión del modelo se conservan. Los textos propios de PRO siguen siendo un pendiente editorial. `ApiErrorPanel.tsx:5`, `App.tsx:472`. |
| U8 | Los títulos «La noche comienza en la red» y «Las decisiones necesitan evidencia» no indicaban la tarea; la pantalla repetía la secuencia en cajas decorativas. La lista de ayuda anunciaba cada número dos veces. | #8 Minimalismo; #10 Ayuda | **Aplicado:** títulos que indican preparar o comparar, una explicación breve, lista ordenada nativa y eliminación de órbitas, rótulo y pasos decorativos del estado vacío. `ContactNetwork.tsx:14`, `App.tsx:448`. |
| U9 | No había enlace para saltar la navegación. Algunos campos numéricos carecían de `name` y sugerencia de teclado numérico/decimal. | #7 Eficiencia, con impacto de accesibilidad | **Aplicado:** enlace al contenido, destino enfocable y metadatos de entrada en escenario, presupuesto e inventario. Ayuda y exportación conservan Escape y devolución del foco. `App.tsx:410`, `ResourceScheduleEditor.tsx:8`. |
| U10 | En el mapa aparecen los controles de Leaflet «Zoom in / Zoom out», mientras el resto de acciones usa español. | #4 Consistencia; #10 Ayuda | **Pendiente menor:** localizar los nombres accesibles al configurar Leaflet. No impidió cambiar entre mapa y red ni consultar personas. |

## Cobertura de las diez heurísticas

| Heurística | Resultado de la revisión |
| --- | --- |
| 1. Visibilidad del estado | Carga y disponibilidad del servidor, red lista, comparación y descarga tienen feedback. Se añadió el siguiente paso junto a las acciones. PRO requiere resolver U4. |
| 2. Correspondencia con el mundo real | Se priorizan personas, dosis, días y estrategias. «Réplicas» se explica como repeticiones en la ayuda. U5 sigue requiriendo edición del informe. |
| 3. Control y libertad | Se mantienen cancelar comparación, restablecer y cerrar diálogos. Se eliminó la interrupción automática al consultar. |
| 4. Consistencia | Acciones estables, campos alineados y términos comunes en el flujo principal; U4, U5 y U10 quedan identificados. |
| 5. Prevención de errores | Se conservan límites y validación antes de consultar. Editar invalida la comparación y señala que hay que volver a consultar. No se recortan silenciosamente los valores del usuario. |
| 6. Reconocimiento antes que recuerdo | Grupos visibles de escenario y vacunación; herramientas nombradas por tarea; prerrequisito de comparación visible. |
| 7. Flexibilidad y eficiencia | Campo numérico y slider para contagio, navegación por días, teclado y acceso directo al contenido. No se añaden atajos ni preferencias sin evidencia de necesidad. |
| 8. Estética y minimalismo | Identidad nocturna conservada; contenido decorativo y duplicaciones retirados; detalles secundarios contraídos. |
| 9. Reconocer y recuperarse de errores | Error de población junto al campo, valor conservado y foco al primer inválido. Panel de API conserva recuperación y detalles técnicos desplegables. |
| 10. Ayuda y documentación | Guía por tareas, estados explicados y distinción entre JSON reproducible y ZIP para análisis; ayudas breves dentro del formulario. |

## Recorrido cognitivo: primera comparación

Q1 = entender el objetivo; Q2 = encontrar la acción; Q3 = asociar acción y resultado; Q4 = reconocer progreso. «Claro» expresa una evaluación predictiva, no un resultado de investigación con personas.

| Paso y acción | Antes: Q1 / Q2 / Q3 / Q4 | Después y evidencia |
| --- | --- | --- |
| 1. Identificar por dónde empezar | Ambiguo / visible / ambiguo / no aplica | **Claro:** «Prepara tu primer escenario» nombra el panel y Consultar red. |
| 2. Ajustar población y duración | Claro / visible / claro / claro | **Claro:** entradas a la misma altura; rangos próximos. Población 49 muestra error; Consultar devuelve el foco al campo. |
| 3. Elegir origen y contagio | Claro / visible / claro / claro | **Claro:** grupo de contagio conserva campo, slider y escala; la precisión almacenada no se altera por redondear la presentación. |
| 4. Configurar dosis, eficacia y día | Claro / día escondido / ambiguo / claro | **Claro:** controles reunidos bajo Vacunación; el día ya no depende de descubrir opciones avanzadas. |
| 5. Consultar la red | Claro / visible / claro / interrupción | **Claro:** 50 personas y 368 contactos confirmados; sin diálogo; foco en la acción que lanzó la consulta. |
| 6. Comparar estrategias | Claro / posición cambiante / ambiguo antes de consultar / claro | **Claro:** posiciones constantes y prerrequisito visible; comparación de dos repeticiones terminada. |
| 7. Interpretar resultados | Claro / visible / conflicto en informe / claro | **Pendiente U5:** resultados calculados disponibles; no se certifica la interpretación del borrador ejecutivo. |
| 8. Volver y recorrer los días | Claro / opciones mezcladas / ambiguo / claro | **Claro:** reproductor disponible con trayectoria. Avanzar llevó a día 1; retroceder a día 0; cambio a Aleatoria conservó reproducción pausada. |
| 9. Cambiar red/mapa y filtrar | Claro / herramientas dispersas / ambiguo / claro | **Claro:** Vista y contactos / Vista del mapa; en mapa se explica por qué el filtro de red está deshabilitado. |
| 10. Exportar y cerrar ayuda | Claro / visible / formatos poco explicados / claro | **Claro:** JSON descargado con esquema 1.0, 50 personas, 7 días, dos repeticiones y las tres estrategias. Escape devolvió el foco a Ayuda. |

## Comprobaciones de accesibilidad y presentación

Referencia: [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) y [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Aplicación proporcional a estos flujos; no una declaración de conformidad de todo el producto.

| Área | Evidencia |
| --- | --- |
| Contraste de texto, 1.4.3 | En intervenciones: texto del presupuesto 15,24:1 sobre el campo; ayuda del checkbox 8,82:1 sobre el panel. Son mediciones de esos colores concretos, no de todos los elementos. |
| Límites de campos, 1.4.11 | Borde común `#82758a` sobre `#171620`: 4,15:1. Foco naranja único en campos compuestos. |
| Reflujo, 1.4.10 | Revisado a 1161, 390 y 320 px CSS. A 320 px: ancho útil y documento de 308 px, sin desbordamiento; una columna para campos. A 390 px caben los pares principales. |
| Teclado y foco, 2.1.1 / 2.4.1 / 2.4.7 | Saltar al contenido enfoca `main-content`; desplegables accionables con Enter; error de población enfocado; Escape cierra Ayuda y devuelve foco a su botón. |
| Foco no oculto, 2.4.11 | Campo de presupuesto visible al enfocarlo en 320 px; en escritorio el formulario tiene su área de desplazamiento y las acciones su propio pie. |
| Etiquetas, errores y estados, 3.3.1 / 3.3.2 / 4.1.3 | Etiquetas asociadas, errores en contexto y estados anunciables. Ningún contrato numérico del motor cambió. |
| Movimiento | Se conserva la regla existente `prefers-reduced-motion`; no se añade animación. La preferencia no se forzó en el navegador de prueba. |

No se realizó una sesión con NVDA/JAWS/VoiceOver, una auditoría automática de todo el DOM, contraste de cada gráfico ni validación cruzada de navegadores. Esas pruebas siguen siendo necesarias para declarar conformidad.

## Verificación y límites del cambio

- `npm test`: 116 aprobadas, ninguna fallida ni omitida. Son pruebas existentes de dominio/API/reproducción/exportación; no se presentan como cobertura de componentes.
- `npm run build`: TypeScript y producción aprobados, incluidos los ajustes finales de CSS.
- Sin runner de componentes instalado: evidencia RED/GREEN mediante reproducción del problema y observación antes/después; no se añadieron pruebas que solo repitan atributos o reglas CSS.
- Cierres y brigadas contraídos al activar el plan; expansión por teclado y campos visibles comprobados. Editar el plan deshabilita la comparación anterior.
- Cambios locales previos de backend, resultados, PRO e informe preservados y excluidos del commit. U4, U5 y U10 son pendientes explícitos, no correcciones declaradas como terminadas.

## Lo que funciona bien

- Límites y validaciones conservan valores y evitan consultas inválidas (#5 y #9).
- Cancelación y Escape proporcionan salidas claras (#3).
- La población incluye etiquetas de estado además del color (#6 y #10).
- JSON y CSV tienen finalidades diferenciadas; los resultados mantienen semilla y versiones (#1 y #6).

**Tres prioridades, en orden:** 1. Resolver las afirmaciones contradictorias de PRO y del informe (U4–U5). 2. Validar con usuarios el nuevo orden y la comprensión de escenario → red → comparación (U1–U2, cambios aplicados). 3. Completar lectura con lector de pantalla y localización de los controles del mapa (U10).
