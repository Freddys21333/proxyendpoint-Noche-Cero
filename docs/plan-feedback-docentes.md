# Plan de mejoras a partir del feedback docente

Fecha de revisión: 28 de octubre de 2026. Fuente: `zoom-feedback.docx`, facilitado por el equipo. Base de código inspeccionada: rama `front`, commit `32b78ff`; `origin/main` estaba en `a2d52bc`. Referencia adicional de infraestructura: `origin/feat/aws-infra`, commit `d8f18d1`.

El objetivo es cerrar las observaciones de los docentes aprovechando lo que ya existe, sin sustituir el motor, perder reproducibilidad ni rehacer la interfaz. Este documento es un plan: su publicación no ejecuta las tareas, instala dependencias ni autoriza desplegar recursos. La revisión fue documental y de código; no se ejecutaron suites, pruebas humanas ni consultas a AWS en este turno.

**Primero: estabilizar el entorno y las descargas; después: aceptar la comparación y el recorrido completo. En paralelo, revisar la infraestructura ya construida y los entregables.** La aplicación tiene muchas funciones implementadas; el principal trabajo pendiente es demostrar que funcionan juntas en la versión que se entregará y que una persona externa las entiende.

## 1. Cómo interpretar el estado

- **Implementado:** existe código que cubre la observación; no significa aceptación integral.
- **Verificado con evidencia previa:** hay un registro de pruebas de otra ejecución o commit; no se atribuye a una ejecución nueva.
- **Pendiente de aceptación:** falta comprobar el recorrido actual, su comprensión o su comportamiento en los estados exigidos.
- **Bloqueo observado:** hubo un fallo concreto documentado que todavía no tiene cierre verificable.
- **Propuesta:** requiere especificación o decisión antes de construir; no se convierte en requisito por aparecer en la conversación docente.

Las fuentes de alcance siguen siendo [PRD](../PRD.md), [TRD](../TRD.md), [requisitos](../specs/requirements.md), [tareas](../specs/tasks.md), [acuerdos](../specs/agreements.md) y [plan PRO](plan-pro-iteraciones.md). Este plan los complementa y debe reconciliar sus estados antiguos, no borrar sus evidencias. El backlog [UX-01 a UX-08](../specs/mejoras-sistema-ux.md) contiene propuestas que ahora están parcialmente implementadas; su estado inicial no describe por sí solo el código actual.

## 2. Feedback y situación actual

Las referencias P corresponden a los párrafos del cuerpo del DOCX, en orden de lectura de `word/document.xml`. Se resumen las observaciones relevantes; no se publica la transcripción completa ni se convierten las conversaciones sobre premios, viajes o inscripción en tareas de software.

| Observación | Situación actual comprobable | Trabajo que corresponde |
|---|---|---|
| Francisco: explicar probabilidades, decimales y por qué elegir esos valores (P16–23). | Porcentajes legibles, precisión conservada al editar y parámetros avanzados ya existen en `App.tsx` y `parameter-input.ts`. | Justificar defaults y supuestos, probar comprensión; no rehacer controles. |
| Francisco: configurar desde pocos datos entendibles (P23–25). | La interfaz separa básicos y avanzados. | Mejorar la guía. Cualquier conversión duración/probabilidad requiere demostrar compatibilidad con el modelo antes de adoptarla. |
| Confusión entre semilla, escenarios y réplicas (P24). | Los campos ya distinguen semilla de repeticiones. | Comprobar que usuarios distinguen también población, escenarios y repeticiones. |
| Francisco: cumplir especificaciones y verificar cálculos (P13, P26–29). | Motor, contratos y pruebas implementados; evidencia científica T-22 aprobada y suite backend histórica. | Matriz de trazabilidad y regresión del candidato final; no volver a escribir el motor. |
| Isabelita: KPIs estratégicos y analítica (P31–40). | Cuatro indicadores por estrategia, unidades, horizonte, barras y curvas en comparación. | Aceptar lectura, recursos e incertidumbre con resultados reales y usuarios externos. |
| Cristy: explicar qué estrategias se comparan (P46–55). | Explicaciones antes de ejecutar y selector de estrategia visualizada diferenciados. | Verificar que el usuario entiende comparar las tres frente a reproducir una. |
| Cristy: decir cuál conviene y por qué (P56–60). | `recommendation` del backend, confianza, motivos, límites y objetivo visible. | Aceptar ventaja, empate, pérdida y pocas repeticiones; no fijar Dirigida como ganadora. |
| Reporte comprensible para decidir (P57–60). | PDF, HTML, impresión, JSON y ZIP/CSV tienen implementación y accesos visibles. | **Bloqueo operativo:** PDF y apertura de todos los formatos no tienen aceptación integral del entorno actual. |
| Más datos: sugerencia de pasar de veinte a unos trescientos (P45). | Comparación síncrona limitada a 2–30 repeticiones; jobs locales con otros límites publicados. | Aclarar qué se cuenta; definir un experimento de precisión/costo antes de ampliar capacidad. |
| Moderación: UX y usabilidad (P118–119). | Parámetros, flujo, mapa, reproducción y textos han recibido cambios. `32b78ff` agrupa reproducción y mejora movimiento/intervenciones. | Prueba integral, accesibilidad y evaluación humana; no darlo por aceptado solo por tener CSS. |
| Isabelita: revisar arquitectura y calidad (P110–115). | Separación frontend/backend, contratos y documentación existentes. | Alinear diagrama, código, límites y evidencias de la versión final. |
| Cristy/equipo: AWS público, README, costos y arquitectura (P44–45, P78–79). | En `front`, `infra/` solo contiene `.gitkeep`. Otra rama contiene IaC y evidencia de staging, **posteriormente retirado por petición del usuario**. | Revisar e integrar selectivamente ese trabajo; publicar de nuevo solo con autorización y aceptación actuales. |
| Moderación: CMI, CMMI y riesgos (P123–131). | Hay impacto, recursos, decisiones, registros y límites del modelo. | Organizar esos elementos y registrar riesgos; no construir una pantalla o certificación CMMI. |
| Moderación: todos deben conocer el producto y coordinar el pitch (P1–12, P29). | No hay evidencia en esta revisión que permita acreditar preparación de los integrantes. | Ensayo conjunto, reparto, preguntas técnicas y demo reproducible. |

### Evidencia que ya se debe conservar

- [Comparación y descargas](evidencia/comparacion-descargas-2026-10-28.md): conclusión, indicadores y accesos recientes; documenta el fallo PDF y el entorno incompleto. No acredita descarga integral.
- [Visibilidad y distribución del mapa](evidencia/mapa-visibilidad-2026-10-28.md) y [color y zoom](evidencia/mapa-color-zoom-2026-10-28.md): mejoras locales; cobertura de 22 polígonos residenciales, no todos los barrios de Manta.
- [T-22 v1](evidencia/t22-v1-ejecucion.md): 15 experimentos, 450 pares y 17 reproducciones. En los 150 pares primarios frente a aleatoria hubo 112 victorias, 33 empates y 5 pérdidas; no demuestra victoria universal ni aceptación completa del producto.
- [P-06](evidencia/p06-dengue-manabi-2026-10-27.md): resultado fuera de muestra desfavorable. Mantener `fitted-not-validated`; no presentarlo como predictor validado.
- [Rendimiento backend](evidencia/rendimiento-backend-2026-10-28.md): mediciones locales y 510 pruebas registradas entonces. La comparación reciente registró 152 pruebas frontend. Son antecedentes, no pruebas ejecutadas para publicar este plan.
- Infraestructura: en `origin/feat/aws-infra`, leer `docs/evidencia/aws-base-2026-10-28.md` y `infra/CICLO-DESPLIEGUE.md`. Hay evidencia histórica de publicación y retirada de 44 recursos de aplicación, conservando bootstrap/estado y Budget. No se comprobaron esos recursos en vivo en esta revisión ni se deben reutilizar las URLs como activas.

## 3. Secuencia de implementación

No es necesario terminar todas las extensiones para cerrar las observaciones principales. El orden evita añadir funciones sobre un entorno que aún falla.

| Orden | Unidad | Prioridad | Dependencia | Resultado de salida |
|---|---|---|---|---|
| 1 | F0.1 Línea base y trazabilidad | P0 | Ninguna | Commit candidato, estados y regresiones identificados. |
| 2 | F0.2 Entorno y exportaciones | P0 | F0.1 | Un mismo experimento descargado, abierto y reproducido. |
| 3 | F1.1 Comparación y F1.2 recursos | P0/P1 | F0.2 | Conclusión y cifras entendibles, sin alterar el motor. |
| 4 | F1.3 Parámetros y F1.4 espera | P1 | F0.1 | Entradas y estados de ejecución comprensibles. |
| 5 | F2.1 Reproducción y F2.2 accesibilidad | P1 | F1 | Flujo coherente en mapa/red, teclado y pantallas estrechas. |
| 6 | F2.3 Prueba con usuarios | P1 | F2.1–2 | Evidencia de comprensión y correcciones concretas. |
| Paralelo | F3.1 Regresión científica y F4.1 revisión de infraestructura | P0 | F0.1 | Base técnica y arquitectura de entrega reconciliadas. |
| 7 | F3.2 Escala y precisión | P1 | F3.1 y pregunta definida | Protocolo acotado; ampliación solo si está justificada. |
| 8 | F4.2 Publicación y operación | P0 de entrega | Estabilidad local, F4.1 y autorización | URL vigente con flujo real, costos y alertas comprobables. |
| 9 | F5 Riesgos, documentación y pitch | P1 | Avance continuo; cierre tras F4.2 | Entrega y exposición corresponden al mismo commit. |
| Después | F6 Extensiones | P2 | Aceptación principal cerrada | Mejoras adicionales sin comprometer la demo. |

### F0.1 Establecer una línea base y una matriz de aceptación

**Responsable sugerido:** integración, con frontend y backend.

1. Registrar rama, commit, estado de trabajo, versiones e intérpretes; conservar cualquier cambio ajeno. La referencia de este documento incluye el pulido `32b78ff`, que al iniciar la revisión aún no estaba en `origin/main`.
2. Relacionar cada observación y requisito con código, prueba, evidencia y pendiente. Actualizar estados de T-13..T-16 y T-23 sin marcarlos completos por tener implementación.
3. Capturar una comparación pequeña real y sus exportaciones como referencia de revisión, fuera de fixtures científicas congeladas. Para la demostración principal conservar también el escenario que el equipo quiera defender.
4. Ejecutar los checks del apartado 6; separar fallos previos de regresiones del cambio. No actualizar hashes ni expectativas para esconder diferencias.

**Aceptación:** cualquiera del equipo identifica qué funciona, qué falló, con qué commit se probó y qué sigue abierto. Hay evidencia antes de modificar comportamiento. No se requiere desplegar ni repetir todo T-22 para preparar esta línea base.

### F0.2 Cerrar el entorno local y las descargas

**Responsable sugerido:** backend/integración; apoyo frontend. **Archivos:** `backend/pyproject.toml`, `backend/uv.lock`, `scripts/serve_api.py`, `frontend/src/lib/mayor-report.ts`, `MayorReportDownload.tsx` y guía local.

**Problema observado:** la API anterior respondió «Ruta no encontrada» al PDF. Tras revisar el arranque, `backend/.venv` carecía de `reportlab`; el runtime general tenía esa biblioteca pero carecía de `jsonschema`. La existencia del endpoint en el código no resuelve un proceso antiguo o un entorno incompleto.

- Crear o sincronizar un entorno del proyecto con Python 3.12 y el lockfile existente; comprobar todas las dependencias juntas. No instalar paquetes en el runtime administrado de Codex ni degradar versiones para hacer desaparecer el error.
- Confirmar qué intérprete inicia la API y detener/reiniciar únicamente el proceso local identificado, conservando parámetros y archivos. No mezclar manifiestos producidos con versiones incompatibles.
- Probar `/v1/health`, preview, comparación y `/v1/reports/mayor` con el código candidato. Revisar las correcciones de compresión y límites de la rama AWS antes de portar soluciones duplicadas.
- Desde comparación y Exportar, descargar PDF, HTML, JSON y ZIP. Abrir PDF y HTML, revisar todas las páginas del PDF y comprobar texto/tablas, firma y tipo de archivo. Abrir ZIP, verificar CRC y CSV. Reproducir el JSON en proceso nuevo con las versiones de su manifiesto.
- Probar error y reintento, cancelación de generación y cambio de escenario. No dejar botones ocupados ni ofrecer resultados anteriores como vigentes. La impresión puede depender del navegador; la descarga HTML sigue disponible.

**Aceptación:** los cuatro formatos proceden del mismo experimento; sus cifras y hash coinciden donde se incluyen. PDF e informe abierto tienen evidencia, no solo un botón visible. Un entorno fallido queda como bloqueo de entrega, no se oculta con resultados de ejemplo.

### F1.1 Aceptar la comparación para una persona no técnica

**Responsable sugerido:** frontend con revisión de backend. **Archivos:** `ComparisonResults.tsx`, `DecisionSummaryResults.tsx`, `ComparisonChart.tsx`, `comparison.ts` y contratos de resumen.

Ya existen conclusión, confianza, cuatro indicadores, barras comunes, curva acumulada inicial y detalle plegado. Se debe mejorar solo lo que falle en estas comprobaciones:

- El usuario distingue menor media de ventaja respaldada y puede identificar el objetivo vigente: minimizar infectados acumulados medios. No existe aún un optimizador multicriterio que pueda anunciarse como disponible.
- Mostrar escenarios reales de ventaja, empate, resultado desfavorable y pocas repeticiones. No elegir semillas solo para exhibir una victoria ni llamar fracaso técnico a una derrota de Dirigida.
- Contrastar infectados, evitados, pico y dosis con el JSON. Mostrar unidad, población y horizonte; explicar que fracciones son promedios. Una diferencia negativa significa más contagios frente a la referencia; el porcentaje con referencia cero no aplica.
- Aceptar respuestas con y sin `decisionSummary`, sin recalcular agregados o confianza en React. Usar los campos existentes; si falta una nueva métrica, especificarla primero en backend/contrato.
- Mantener medias, percentiles y bootstrap disponibles. P05–P95 no es IC; la trayectoria que se reproduce es una repetición, no la curva promedio.

**Aceptación:** una persona puede decir qué alternativa tuvo menos contagios, frente a cuál, con qué variación y qué no permite concluir el experimento. Los estados de empate y pérdida conservan sus cifras y explicaciones.

### F1.2 Hacer comprensibles presupuesto, inventario y costo

**Responsable sugerido:** frontend/backend. **Archivos:** `CombinedInterventions.tsx`, `AdaptiveStrategyEditor.tsx`, `ResourceScheduleEditor.tsx`, `CombinedCostResults.tsx` y contratos P-01/P-02.

Los textos de cierre, brigadas y política adaptativa ya fueron simplificados en `32b78ff`; revisarlos con usuarios antes de reescribirlos otra vez.

- Separar dinero, dosis/insumos, capacidad diaria y entregas. Explicar con ayuda breve que recibir recursos no aumenta el presupuesto y que una dosis fallida también se consume.
- Verificar la prioridad de acciones y las omisiones que publica el motor: sin presupuesto, existencias, capacidad o personas elegibles. No atribuir causas que el registro no contiene.
- Revisar presupuesto cero, saldo agotado con inventario, dinero sin existencias, entrega futura, costo cero y dosis fallidas.
- Mantener los importes en centavos del backend. Diferenciar costo por contagio evitado, gasto y saldo; si la mejora no es positiva, no presentar un cociente como beneficio.

**Aceptación:** controles, historial, resumen e informe coinciden. Los costos educativos del simulador no se confunden con la factura de AWS ni con precios de salud reales.

### F1.3 Justificar parámetros sin cambiar las matemáticas

**Responsable sugerido:** backend documenta; frontend presenta; los tres integrantes lo explican.

- Conservar campos porcentuales, precisión técnica y división básico/avanzado. Añadir una ayuda corta junto al campo y una explicación ampliada de los defaults, sus fuentes y su carácter de supuesto educativo cuando corresponda.
- Explicar β según el contrato real de transmisión y pesos de contacto; no presentarlo como porcentaje final de población contagiada.
- Explicar σ como probabilidad diaria de E→I y γ de I→R. Son transiciones de estados distintos, **no probabilidades complementarias**: 0,5 y 0,5 no significa que la mitad nunca se recupera.
- Distinguir población, repeticiones, escenarios y semilla con un ejemplo del propio recorrido. La semilla identifica sorteos y ayuda a repetir; no es cantidad de casos ni gravedad.
- Si se quiere introducir días medios, abrir una especificación aparte: justificar la espera geométrica y comprobar la relación con el tiempo discreto. No enlazar β, σ y γ ni recalcularlos arbitrariamente a partir de uno o dos campos.

**Aceptación:** usuario y equipo pueden explicar cada entrada sin una derivación inventada; mostrar un valor redondeado no modifica silenciosamente el valor almacenado.

### F1.4 Mejorar la experiencia durante la espera

**Responsable sugerido:** frontend/integración. **Situación:** la comparación aún muestra un mensaje genérico, sin tiempo transcurrido.

- Mostrar desde el inicio tiempo transcurrido y resumen de configuración enviada: población, días y repeticiones. Usar la petición en curso, no campos editados después.
- Incorporar fases o avance solo cuando el backend los publique. No crear porcentajes ni una cuenta atrás que prometa una duración no medida.
- Diferenciar comparar por HTTP de un trabajo PRO. Cancelar una petición síncrona puede dejar cálculo en el servidor; no prometer que libera cómputo. Los jobs tienen su propio contrato de cancelación.
- Probar éxito, error, reintento, navegación y cancelación; impedir que una respuesta antigua reemplace el escenario nuevo.

**Aceptación:** siempre se entiende qué se está ejecutando y qué acción se puede tomar. No hay progreso ficticio ni resultados parciales presentados como finales.

### F2.1 Aceptar mapa, red y reproducción juntos

**Responsable sugerido:** frontend; backend ayuda a contrastar frames.

- Verificar día 0, intermedio y final; las tres estrategias; reproducir, pausar, reiniciar, avanzar/retroceder y velocidad. Comparar conteos, estados, vacunas e inspector con el frame de la réplica visualizada.
- Alternar mapa/red, filtrar contactos, buscar/seleccionar persona, elegir origen, centrar y usar rueda/botones de zoom. El filtro no debe aparentar borrar personas ni cambiar el experimento.
- Medir el comportamiento con 50, 1000 y 2000 personas cuando el contrato/capacidad del entorno lo permita; separar fluidez visual de latencia del motor. Verificar el pulido de movimiento de `32b78ff`, incluyendo movimiento reducido.
- Conservar identidad y coordenadas durante la reproducción. Los cambios de color recientes son una preferencia aceptada; no sustituirlos de nuevo por escala de grises sin motivo.
- Mantener aviso de geografía y personas sintéticas, atribución OSM y alternativa Red si fallan las teselas.

**Aceptación:** no hay desincronización ni errores de canvas durante el recorrido; el usuario reconoce día, estrategia y tipo de dato. El mapa no se interpreta como ubicación real de pacientes.

### F2.2 Accesibilidad y pantallas estrechas

**Responsable sugerido:** frontend/UX.

- Probar anchos CSS 320, 390 y 768 px y escritorio, tanto en configuración como comparación, PRO y Exportar. Es una matriz propuesta de aceptación, no un cumplimiento WCAG ya demostrado.
- Recorrer solo con teclado: orden de foco, selects, acordeones, diálogo y devolución de foco. Verificar nombres accesibles, errores asociados a campos y anuncios de estado sin ruido repetitivo.
- Medir contraste de texto normal, texto grande y controles; comprobar que no se depende solo del color para identificar estados/estrategias. Mantener tablas equivalentes de gráficos.
- Revisar acciones sin recorte, indicadores apilados, scroll de tablas y legibilidad del inspector. Corregir fallos puntuales, sin rediseño general ni nuevos paneles decorativos.

**Aceptación:** las acciones principales son accesibles sin mouse y no hay información imprescindible oculta por el ancho. Registrar medidas y capturas de los tamaños revisados.

### F2.3 Prueba moderada de comprensión

**Responsable sugerido:** una persona del equipo modera; otra registra.

Invitar al menos a dos personas ajenas al código como evaluación formativa, no como muestra estadística. Pedirles, sin guiarlas: configurar un escenario, comparar, explicar la conclusión y su incertidumbre, identificar dosis/costo, reproducir un día y descargar el informe.

Registrar dudas, acciones equivocadas, ayudas necesarias y tiempo humano. Corregir los bloqueos de mayor impacto y repetir las tareas afectadas. El objetivo de recorrido breve de T-16 se debe contrastar con su criterio vigente; el tiempo de un script no sustituye la prueba humana.

**Aceptación:** se entiende comparar frente a visualizar, promedio frente a réplica y simulación frente a predicción real. Guardar resultados y pendientes; no marcar aceptación solo porque el evaluador logró terminar con ayuda.

### F3.1 Cerrar trazabilidad y regresión científica

**Responsable sugerido:** backend/análisis, con revisión independiente si se modifica un elemento de alto riesgo.

- Relacionar requisitos con pruebas existentes antes de añadir más. Revisar conservación S+E+I+R, R absorbente, simultaneidad, β=0, γ=0, eficacia 0/1, vacunas cero, consumo de dosis y presupuesto. Confirmar el comportamiento exacto de cada caso contra el contrato.
- Reproducir un JSON con las versiones declaradas y comparar hashes en otro proceso. Probar que orden de políticas/réplicas no altera lo que debe ser invariante.
- Mantener T-22 v1 congelado. Una mejora visual no exige repetir su matriz completa; un cambio semántico del motor sí requiere versión y protocolo nuevos, conservando v1 y sus pérdidas/empates.
- Mantener separados verificación funcional, evidencia científica sintética y validación de un modelo real. P-06 continúa `fitted-not-validated`; no relabelar por mejorar la interfaz.

**Aceptación:** checks del candidato aprobados o fallos explicados y bloqueados. No se editan expectativas, manifiestos ni hashes para simular compatibilidad.

### F3.2 Resolver la observación de los “300 casos”

**Responsable sugerido:** equipo/backend, antes de ejecutar lotes grandes.

1. Acordar si se quiere ampliar población, repeticiones del mismo escenario o cantidad de escenarios/redes independientes. La transcripción no lo resuelve.
2. Escribir la pregunta, inputs, límites, precisión a evaluar y presupuesto antes de observar resultados. Para incertidumbre de estrategias, no tratar muchas repeticiones de una red como muchas redes independientes.
3. Respetar límites publicados: la ruta síncrona actual admite 2–30; jobs locales admiten hasta 100 sujetos a capacidad. Confirmar límites efectivos en `/v1/config`. R=300 no se habilita cambiando solo el máximo de un campo.
4. Si hace falta R=300, diseñar y aprobar una ruta por lotes con controles de carga, fallos, reintento, cancelación y agregado íntegro; si se necesita AWS durable, depende de P-04.
5. Medir tiempo y variación con inputs fijados, informar pérdidas y límites. Más repeticiones reducen ruido Monte Carlo, no convierten una red sintética en una predicción real.

**Aceptación:** decisión de escala defendible con evidencia y costo; el número 300 no se impone como requisito confirmado ni como nuevo default de la demo.

### F4.1 Reconciliar la arquitectura y la rama de infraestructura

**Responsable sugerido:** infraestructura/integración, con frontend/backend en las intersecciones.

- Revisar `origin/feat/aws-infra` antes de construir IaC nueva. Contiene Terraform, empaquetado, publicación y retirada, evidencia y ajustes de API/compresión/perfil. No mezclarla a ciegas: también modifica `App.tsx`, informes y contratos.
- Comparar contra el candidato actual, incorporar los cambios necesarios en una rama de integración y resolver conflictos conservando el trabajo UX. Probar el conjunto; no inferir compatibilidad porque dos ramas compilan por separado.
- Distinguir en el diagrama arquitectura local, AWS históricamente probada, recursos retirados y servicios aún propuestos. El staging histórico no incluía persistencia durable de resultados ni cerraba P-04.
- Revisar límites de API y tamaño de PDF/experimento, paquetes Linux, versiones del manifiesto y capacidad del perfil de demostración. No usar un perfil de staging como cambio silencioso de las hipótesis científicas.
- Preparar responsable, región decidida `us-east-2`, permisos mínimos, cuotas, costos y plan de reversión. No utilizar credenciales o consultar una cuenta por estar disponibles.

**Aceptación:** código y diagrama de la integración coinciden; las diferencias con local y los pendientes están explícitos. Los comandos de publicación se toman de la versión integrada y revisada, no de una URL o estado histórico.

### F4.2 Publicar y demostrar operación, solo tras autorización

**Responsable sugerido:** infraestructura; equipo acepta el recorrido público.

La publicación anterior fue retirada expresamente. Antes de recrear recursos se necesita autorización vigente para destino, operación y sesión de AWS. El plan no la concede ni contiene instrucciones de aplicar/destruir automáticamente.

- Revisar el plan IaC y el estado existente antes de cambiar recursos; preservar bootstrap/estado y evitar duplicarlos. Publicar un staging acotado antes de ampliar capacidad.
- Abrir desde sesión limpia y red externa: salud, configuración, preview, comparación, reproducción y descargas. Comprobar CORS, compresión, límites y versión visible. Los mocks no cierran este criterio.
- Registrar latencia, errores y carga de una muestra definida. Diferenciar un smoke funcional de un benchmark/p95 de aceptación.
- Comprobar logs y alertas útiles, retención y costos de todos los servicios. Verificar destinatarios y recepción del Budget; no reenviar mensajes sin autorización. Una alerta no detiene el gasto.
- Tratar jobs durables/P-04 como incremento separado: cola, estado, idempotencia, almacenamiento, cancelación y cuotas deben probarse antes de miles de repeticiones.

**Aceptación:** URL actual y flujo completo del commit entregado con evidencia externa; presupuesto y operación documentados. Si permanece retirado, declararlo y mantener la entrega AWS abierta.

### F5 CMI, riesgos, documentación y pitch

**Responsable sugerido:** todo el equipo; asignar un responsable real por entregable.

**CMI sin sobredimensionar.** Organizar los indicadores existentes en impacto (infectados/evitados/pico), recursos (dosis/gasto/saldo), proceso (entregas/capacidad/omisiones/tiempo de ejecución) y calidad de decisión (variación/repeticiones/confianza/reproducibilidad). No inventar KPIs de pacientes, mortalidad, hospitalizaciones o satisfacción que el modelo no mida. CMMI se puede reflejar en trazabilidad, revisiones y gestión de cambios; no es una función del simulador ni una certificación obtenida.

**Registro de riesgos mínimo.** Para cada riesgo: evidencia, impacto, señal de detección, mitigación, responsable y condición de cierre.

| Riesgo | Mitigación y prueba de cierre |
|---|---|
| Confundir simulación con consejo sanitario | Avisos y límites en UI/informe; usuarios pueden explicarlos. |
| Presentar P-06 como validado | Conservar etiqueta y resultado desfavorable en todas las salidas. |
| Recomendar una victoria por azar o sesgo de demo | Confianza, empates y pérdidas visibles; semilla externa y protocolo previo. |
| Interpretar posiciones como pacientes reales | Etiquetado sintético y alcance OSM, sin riesgo real por barrio. |
| Cambiar resultados al tocar UI/paquetes | Versiones, contratos, reproducción y hashes comprobados. |
| Entorno incompleto o API antigua | Arranque reproducible y verificación de rutas/dependencias del proceso. |
| Confundir dinero con existencias o costos reales | Casos límite y lectura de recursos; separar AWS de costos educativos. |
| Demo lenta, caída de red o teselas | Límites de carga comprobados y alternativa Red; ensayo de recuperación. |
| Gastos/permisos AWS inesperados | Alcance autorizado, IaC revisada, cuotas y alertas operativas; plan de retirada. |
| README/diagrama y código de ramas diferentes | Cierre documental sobre un solo commit candidato. |

**Entregables.** Reconciliar README, guía de inicio, arquitectura SVG con fuente editable, costos, límites, evidencia de pruebas y enlaces públicos vigentes. Hay estados antiguos en README, `backend/README.md`, specs y plan PRO; corregirlos con referencias, sin borrar historia. Separar estimación de costo, gasto observado y crédito disponible; no convertir una estimación de Lambda en total mensual del sistema.

**Pitch.** Todos deben poder explicar problema, SEIR y parámetros, comparación justa, criterio/variación, recursos, arquitectura, costos y límites. Repartir relato, demo y preguntas sin que solo una persona conozca el sistema. Ensayar una ejecución completa y una pregunta con semilla externa, incluyendo qué responder cuando hay empate o derrota. Preparar respaldo permitido por el evento, identificado como grabación si lo es; no prometer que sustituye la aceptación pública.

**Aceptación:** los materiales y la demo corresponden al mismo commit; las tres personas pueden defender cifras y límites sin atribuir conocimiento a Codex. La revisión docente de arquitectura y cualquier valoración epidemiológica son actividades humanas pendientes, no avales que se puedan afirmar ahora.

### F6 Extensiones después de estabilizar lo principal

- Más cobertura de Manta: incorporar polígonos OSM reales y versionados, preservar determinismo, hogares y pruebas interiores; no dispersar puntos sobre una caja que incluya mar o terreno no verificado.
- Comparación espacial o dos vistas sincronizadas: definir pregunta y rendimiento antes de añadirlas.
- Nuevo criterio económico o multicriterio: especificar reglas, pesos, unidades y validación en backend. No agregar un selector visual que prometa una optimización inexistente.
- Validación epidemiológica o un modelo nuevo: proyecto metodológico aparte con fuentes y evaluación fuera de muestra. No se obtiene aumentando réplicas ni cambiando etiquetas.

Estas extensiones no bloquean el cierre de las mejoras de comprensión ya solicitadas, salvo que un requisito oficial lo establezca.

## 4. Forma de trabajar con Codex sin perder la base

1. **Una unidad de comportamiento por cambio.** Elegir un ID de este plan, leer su implementación actual y fijar aceptación antes de escribir. Evitar prompts como “mejora toda la app”.
2. **Inventario y rama primero.** Revisar `git status`, commits y diferencias respecto de la base acordada. No sobrescribir cambios ajenos ni asumir que `main`, `front` y la rama AWS están sincronizadas. Acordar rama de entrega; no integrar código remoto por el solo hecho de existir.
3. **Reutilizar contratos y funciones.** React presenta la ciencia y decisiones de Python. No duplicar métricas, costos, recomendaciones, RNG o normalización. No reemplazar llamadas reales por mocks en producción.
4. **Test proporcional.** Para una regla de comportamiento comprobable, observar una prueba que falla, implementar y verificarla. Para un ajuste puramente visual o documental, usar inspección y pruebas de interfaz pertinentes, sin crear tests que solo copien selectores CSS.
5. **Congelar lo protegido.** Conservar fixtures y protocolo T-22 v1, semillas, orden de sorteos, hashes y manifiestos. No modificar esas referencias para adaptar una prueba a un resultado nuevo. Cambios semánticos requieren especificación/versionado y revisión de impacto.
6. **Revisar el resultado visible.** Probar el flujo real, incluidos errores y pantallas estrechas; capturas apoyan, pero no sustituyen, la comprobación de datos y archivos.
7. **Commit pequeño y evidencia juntos.** Mensaje en español, objetivo claro y comandos/resultados/límites en `docs/evidencia/`. Revisar el diff para que no incluya instalaciones locales, datos personales, estados Terraform ni artefactos de prueba.
8. **Integrar sin forzar.** Tras checks, hacer push a la rama autorizada; integrar en `main` cuando esté autorizado y se revisen conflictos. No usar force-push para resolver divergencias. El candidato de entrega debe ser inequívoco.
9. **Reversión conservadora.** Para un fallo publicado, valorar `git revert` del commit concreto, con revisión de dependencias; no `reset --hard`, borrado de ramas ni limpieza del trabajo ajeno. No revertir snapshots científicos o destruir AWS como una consecuencia automática de un fallo UI.
10. **Cambios sensibles separados.** Contratos públicos, seguridad, persistencia, concurrencia, dependencias e infraestructura necesitan pruebas de regresión y revisión específica antes de integrarlos. La autorización para editar frontend no autoriza usar credenciales ni desplegar.

### Prompt reutilizable para una sesión

```text
Implementa únicamente [ID y título] de docs/plan-feedback-docentes.md.
Primero verifica el estado actual y qué parte ya existe. Conserva cambios ajenos.
Usa las funciones/contratos existentes; no cambies el modelo, semillas, hashes,
fixtures T-22 ni defaults salvo que esa unidad lo especifique y esté autorizado.
Indica archivos afectados, aceptación y pruebas antes de editar.
Para comportamiento comprobable, observa RED y luego GREEN; para UI comprueba
el recorrido real, teclado y ancho estrecho que aplique.
Detente ante una decisión de producto o incompatibilidad de contrato no resuelta.
Entrega evidencia observada, pendientes y riesgo; no declares completos checks
que no ejecutaste. Haz commit y push solo en la rama de entrega acordada.
No publiques ni uses AWS sin autorización explícita para esa operación.
```

## 5. Qué no se debe volver a construir

- No crear otro motor SEIR, normalizador, generador de red, exportador PDF o recomendador frontend.
- No rehacer el formulario, la explicación de estrategias, los cuatro indicadores o el reproductor antes de probar sus fallos actuales.
- No aplicar ciegamente una paleta propuesta por un informe por encima de la identidad Noche Cero y las preferencias ya aceptadas.
- No desarrollar IaC desde cero sin revisar la rama existente; tampoco declarar vigente su staging retirado.
- No elevar a 300 un límite ni crear un selector económico sin resolver su significado, contrato y capacidad.
- No repetir una validación desfavorable hasta conseguir un resultado que parezca favorable.

## 6. Verificación que usará cada implementación

Estos comandos son un plan para el futuro ejecutor; **no se ejecutaron al redactar este documento**. Primero F0.2 debe asegurar un intérprete y dependencias coherentes. El entorno uv local mencionado en documentos antiguos no estaba presente en `.tools/bin/uv.exe` al revisar; no asumir que ya está instalado ni ejecutar `--offline` sin caché disponible.

### Frontend

Desde `frontend/`:

```powershell
npm test
npm run build
```

El build incluye typecheck. Las suites existentes cubren comparación, resumen de decisión, informes, exportación, reproducción, mapa y geografía. Ejecutar pruebas focalizadas durante el cambio y la suite apropiada al cerrar; no repetir builds sin cambios o incertidumbres nuevas.

### Backend

Con el entorno sincronizado, desde `backend/`:

```powershell
.venv/Scripts/python.exe -m pytest -q
.venv/Scripts/python.exe -m ruff check src tests
.venv/Scripts/python.exe -m ruff format --check src tests
.venv/Scripts/python.exe -m mypy
```

El comando de formato es solo comprobación. La instalación reproducible está descrita en [backend/README.md](../backend/README.md); respetar `pyproject.toml` y `uv.lock`, sin editarlos a mano ni renovar versiones durante una mejora visual. La versión exacta de Python debe coincidir con el manifiesto al reproducir un experimento existente.

Si el cambio afecta esas áreas, desde la raíz y con el mismo entorno:

```powershell
backend/.venv/Scripts/python.exe scripts/check_validation_protocol.py
backend/.venv/Scripts/python.exe scripts/p05_import_dengue.py verify
backend/.venv/Scripts/python.exe scripts/p06_calibrate.py verify
```

Usar `verify`, no regenerar o recalibrar para conseguir una prueba verde. Las instrucciones de [T-22](../specs/validation/t22-v1/README.md), [P-08](../specs/p08-report.md) y [reproducción/exportación](../backend/README.md) rigen sus artefactos. Un fallo previo o de entorno debe quedar registrado y resuelto antes de proclamar el gate correspondiente.

### Recorrido integrado y cierre

Seguir [la guía local](probar-local.md) con configuración manual válida y API real. Incluir resultado respaldado cuando exista, descriptivo, empate/pérdida, error y recuperación; exportación; cambio de parámetros; navegación y reproducción. Para AWS se añade la prueba externa autorizada, no se sustituye por localhost.

La evidencia de cierre debe registrar: ID del plan/requisito, commit, versiones, configuración/semilla, comando o pasos humanos, resultado observado, archivos/capturas y limitaciones. Los artefactos grandes permanecen fuera de Git con una referencia/checksum apropiada; no guardar credenciales ni la transcripción íntegra por defecto.

## 7. Criterio para declarar atendido el feedback

- [ ] Defaults y transiciones son explicables; semilla, población y repeticiones se distinguen.
- [ ] Usuarios externos entienden la conclusión, referencia, recursos e incertidumbre.
- [ ] Comparación, frames, mapa/red e informes corresponden al mismo experimento.
- [ ] PDF, HTML, JSON y ZIP se descargan, abren y verifican; JSON se reproduce.
- [ ] Esperas, errores, cancelación y cambios de configuración tienen comportamiento comprobado.
- [ ] Aceptación de teclado, contraste y pantallas estrechas tiene evidencia.
- [ ] Matriz requisito/código/prueba/evidencia reconciliada; T-22 v1 y P-06 conservan sus límites.
- [ ] Decisión sobre escala documentada; no se confunde aumentar datos con validar el modelo.
- [ ] Arquitectura, costos y README corresponden al candidato de entrega.
- [ ] Si se exige entrega pública, AWS se republicó con autorización, URL vigente, flujo externo y alertas comprobadas; si no, sigue pendiente.
- [ ] Riesgos y responsabilidades están asignados y todos pueden defender el pitch.

No se cierran estos puntos por publicar el plan. Cada casilla requiere su evidencia de implementación o aceptación.
