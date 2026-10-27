# PRD — Comité de Contención de Manta

**Versión:** 1.0
**Fecha:** 26 de octubre de 2026
**Estado:** especificación lista para implementación
**Documento complementario:** `TRD.md`

**Acuerdos técnicos:** [specs/agreements.md](specs/agreements.md) concreta calendario, generación sintética, sorteos, extinción (E+I=0), formatos de API/exportación e integración Terraform. Estos son supuestos versionados de implementación, no evidencia de funcionamiento. El registro del día d incluye la intervención de ese día, antes de los contactos [d,d+1); no hay transmisión después de T. Los requisitos de producto y sus identificadores se conservan.

La validación de entrada rechaza claves JSON duplicadas y números no finitos. Omitir configuración permite defaults; null explícito se considera inválido. Los detalles ejecutables están en el normalizador de T-04 y sus pruebas; esto no demuestra motor ni despliegue.

## 1. Propósito y autoridad del documento

Este producto permite simular, día a día, una plaga tipo zombie sobre una población sintética inspirada en Manta y recomendar dónde y cuándo usar recursos limitados para minimizar los contagios. Debe demostrar con números cuántas personas se salvan frente a dos líneas base: no intervenir e intervenir al azar con exactamente los mismos recursos.

El enunciado oficial del reto es la fuente normativa. Este PRD convierte ese enunciado en requisitos de producto, criterios de aceptación y evidencias de entrega. `TRD.md` define la implementación. Ninguno de los dos documentos, por sí solo, prueba que el software esté implementado, desplegado o que una estrategia gane: esas afirmaciones requieren resultados registrados.

Las palabras **DEBE**, **DEBERÍA** y **PUEDE** conservan el significado del reto:

- **DEBE:** obligatorio; si falta, el criterio correspondiente no se declara cumplido.
- **DEBERÍA:** esperado; su ausencia debe justificarse.
- **PUEDE:** opcional y solo se presenta como completado cuando exista evidencia.

## 2. Problema, usuarios y decisiones

### 2.1 Problema

Una plaga comienza con un caso y se propaga por contactos cotidianos: hogares, colegios, buses, mercados y barrios. La ciudad no puede vacunar a todos ni cerrarlo todo. El Comité de Contención necesita comparar decisiones bajo incertidumbre, recursos limitados y poco tiempo.

El escenario es educativo. No predice un brote real ni reemplaza decisiones epidemiológicas. Los nombres de lugares describen tipos de contacto; no se atribuyen riesgos reales a barrios o instituciones de Manta.

### 2.2 Usuarios

| Usuario | Necesidad | Decisión que toma |
|---|---|---|
| Comité de Contención | Comparar políticas con recursos equivalentes | A quién intervenir, cuándo y con cuántos recursos |
| Alcaldía/jurado | Entender impacto, incertidumbre, costo y limitaciones | Qué política recomendar bajo el escenario actual |
| Operador de demo | Cambiar un brote en menos de cinco minutos | Ajustar contagio, vacunas, origen o eficacia y volver a ejecutar |
| Equipo técnico | Repetir y explicar cualquier resultado | Verificar semilla, versión, parámetros y evidencia |

### 2.3 Objetivos

- **O1 — Simulación:** representar estados SEIR y propagación diaria sobre una red de contactos.
- **O2 — Decisión justa:** comparar una estrategia inteligente con `none` y `random` usando la misma población, brote y presupuesto.
- **O3 — Evidencia:** ejecutar múltiples réplicas, reportar promedios y rangos y evitar seleccionar una semilla favorable.
- **O4 — Reproducibilidad:** repetir resultados con igual configuración, semilla y versión del motor.
- **O5 — Respuesta rápida:** permitir el Brote Sorpresa completo dentro de los cinco minutos otorgados.
- **O6 — Entrega operativa:** mantener una aplicación pública desplegada en AWS hasta el pitch, con costos y seguridad básica documentados.

## 3. Escenario acordado

### 3.1 Plaga y estados

La plaga es ficticia, inspirada en enfermedades de transmisión por contacto. El modelo base es SEIR sobre grafo:

- 🟢 **Sano (`S`)**: susceptible a infección y elegible para vacuna.
- 🟡 **Mordido (`E`)**: expuesto, todavía no contagia y no es elegible para vacuna.
- 🔴 **Zombie (`I`)**: infeccioso y no es elegible para vacuna.
- 🔵 **Exorcizado (`R`)**: recuperado o inmunizado y no vuelve a ser susceptible durante el horizonte.

La muerte, reinfección, nacimientos, movilidad geográfica exacta y capacidad hospitalaria quedan fuera del alcance base.

### 3.2 Población

La población es una red sintética reproducible con capas de contacto para hogar, colegio, bus, mercado y barrio. No utiliza datos personales. La interfaz debe decir “población sintética inspirada en Manta”.

| Parámetro base | Valor inicial | Origen/justificación |
|---|---:|---|
| Población `N` | 1.000 personas | Supuesto del equipo: suficiente variedad y ejecución rápida |
| Horizonte `T` | 90 días | Supuesto del equipo para observar inicio, pico y descenso |
| Casos iniciales `I0` | 1 | Enunciado: el brote empieza con un solo caso |
| Réplicas `R` | 30 | Mínimo operativo para reportar dispersión sin impedir la demo |
| Vacunas `K` | 100 | Supuesto del equipo: 10 % de la población |
| Día de intervención | 0 | Supuesto base; editable para estudiar retrasos |
| Eficacia | 100 % | Simplificación base; el preset sorpresa usa cobertura parcial |
| Incubación media | 3 días | Parámetro del escenario, no afirmación clínica |
| Duración infecciosa media | 7 días | Parámetro del escenario, no afirmación clínica |
| Semilla documentada | 20261026 | Valor reproducible para README y demo; el jurado puede reemplazarlo |

Todos los números deben aparecer en el README con su categoría: `reto oficial`, `supuesto del equipo`, `dato abierto`, `medición del sistema` o `tarifa consultada`. Si se calibra con dengue u otra enfermedad, se crea un preset separado y se citan fuente, período, lugar, transformación y limitaciones; no se reemplazan silenciosamente los valores base.

### 3.3 Intervención base y estrategia

La intervención base es vacunación profiláctica con `K` dosis. Solo un nodo en estado `S` es elegible. Vacunar a un nodo `E`, `I` o `R` está prohibido por validación y pruebas.

Las tres políticas son:

1. **`none`:** no utiliza vacunas.
2. **`random`:** elige uniformemente sin reemplazo hasta `K` susceptibles usando una subsemilla documentada.
3. **`targeted`:** ordena susceptibles por grado ponderado hacia vecinos susceptibles en la red activa; aplica desempate por identificador estable y elige hasta `K`.

`random` y `targeted` reciben las mismas dosis, eficacia, fecha y conjunto inicial de elegibles. Si hay menos de `K` susceptibles, ambas consumen el mismo `min(K, elegibles)`. `none` es la referencia epidemiológica, no una política con presupuesto equivalente.

La hipótesis es que `targeted` reduce en promedio los infectados acumulados al proteger nodos muy conectados. No es una garantía matemática. Una ejecución donde pierda debe mostrarse, no ocultarse.

## 4. Alcance

### 4.1 Alcance obligatorio — versión base

- Modelo SEIR diario sobre red de contactos.
- Generación reproducible de la población sintética.
- Una intervención limitada por `K` vacunas.
- Comparación pareada de `none`, `random` y `targeted`.
- Múltiples réplicas con media, mediana, P05 y P95.
- Curvas diarias `S/E/I/R`, pico, infectados acumulados y personas salvadas.
- Interfaz para modificar al menos contagio, vacunas, punto de inicio, semilla y horizonte.
- Exportación de configuración, semillas, versiones, curvas y métricas.
- Aplicación pública en AWS y evidencia de despliegue.
- README con supuestos, fuentes, instrucciones, semilla y parámetros base.

### 4.2 Alcance PRO — implementar después de aprobar la base

- **PRO-1:** varias intervenciones combinadas: vacunas, cierre temporal de una capa y brigadas de fumigación simuladas.
- **PRO-2:** costos unitarios, presupuesto total, inventario y recursos que llegan por día.
- **PRO-3:** estrategia adaptativa que recalcula prioridades con el estado observado.
- **PRO-4:** 1.000 o más réplicas paralelas mediante AWS Step Functions Distributed Map.
- **PRO-5:** preset calibrado con datos abiertos reales y metodología reproducible.
- **PRO-6:** mapa o grafo animado del avance, identificado como una réplica concreta.
- **PRO-7:** informe para el alcalde en lenguaje simple, generado mediante plantilla determinista; un LLM es opcional.

PRO no puede retrasar la entrega base. Cada elemento se etiqueta `no iniciado`, `en progreso`, `verificado` o `descartado`; nunca se presenta una aspiración como funcionalidad disponible.

### 4.3 Fuera de alcance base

- Predicción epidemiológica real o recomendaciones médicas.
- Geolocalización de personas, datos personales o mapas de domicilios.
- Garantizar que una heurística gane para toda semilla posible.
- Aprendizaje por refuerzo, SageMaker o Bedrock como dependencia obligatoria.
- Miles de nodos animados simultáneamente en el navegador.

## 5. Requisitos funcionales

### 5.1 Configuración y simulación

- **RF-01 (DEBE):** crear o cargar un escenario con semilla visible, versión del modelo y configuración normalizada.
- **RF-02 (DEBE):** permitir editar `N`, `T`, `beta`, incubación, recuperación, `I0`, contexto o nodo inicial, `K`, día de intervención, eficacia, réplicas y semilla.
- **RF-03 (DEBE):** ofrecer selección explícita del punto de inicio por `aleatorio`, `hogar`, `colegio`, `bus`, `mercado`, `barrio` o identificador de nodo.
- **RF-04 (DEBE):** simular los estados de cada nodo y los totales `S/E/I/R` para cada día, incluida la condición del día 0.
- **RF-05 (DEBE):** ejecutar las tres políticas sobre condiciones pareadas y bloquear cualquier diferencia no atribuible a la intervención.
- **RF-06 (DEBE):** impedir vacunación de nodos `E`, `I` o `R` y mostrar dosis asignadas, efectivas y no usadas.
- **RF-07 (DEBE):** repetir el experimento `R` veces y mostrar progreso, éxito, fallos y total válido.

### 5.2 Resultados y decisión

- **RF-08 (DEBE):** mostrar curvas diarias por política y una tabla con pico infeccioso, día del pico, infectados acumulados, infectados finales, dosis usadas y costo si aplica.
- **RF-09 (DEBE):** mostrar media, mediana, P05 y P95 por política y el número de réplicas. P05–P95 se etiqueta como rango empírico, no como intervalo de confianza.
- **RF-10 (DEBE):** calcular `salvados_vs_none = infectados_none − infectados_política` y `mejora_vs_random = infectados_random − infectados_targeted`, tanto por réplica como agregados.
- **RF-11 (DEBE):** explicar la recomendación en lenguaje simple, incluyendo si `targeted` gana, empata o pierde y la incertidumbre observada.
- **RF-12 (DEBE):** explicar por qué se seleccionó cada nodo: puntuación, posición, estado elegible y regla de desempate.
- **RF-13 (DEBE):** exportar JSON y CSV con parámetros, versiones, grafo, semillas, resultados por réplica, estadísticas y hashes.
- **RF-14 (DEBERÍA):** animar una réplica representativa y mostrar permanentemente su semilla; no mezclarla con el promedio Monte Carlo.

### 5.3 Brote Sorpresa

- **RF-15 (DEBE):** incluir presets de un clic: `double_beta`, `half_vaccines`, `market_origin` y `partial_efficacy_50`.
- **RF-16 (DEBE):** permitir cambios manuales equivalentes sin editar código y volver a obtener recomendación en menos de cinco minutos de operación total.
- **RF-17 (DEBE):** aceptar cualquier semilla válida elegida por el jurado y no utilizar resultados precalculados como si fueran una ejecución nueva.
- **RF-18 (DEBERÍA):** conservar lado a lado la configuración base y la sorpresa para explicar qué cambió y por qué cambió la recomendación.

### 5.4 Evidencia y operación

- **RF-19 (DEBE):** mostrar `engineVersion`, `schemaVersion`, commit/build, región AWS y marca de tiempo fuera del hash reproducible.
- **RF-20 (DEBE):** exponer una URL pública funcional hasta el día del pitch y una comprobación de salud del backend.
- **RF-21 (DEBE):** incluir en el README raíz instrucciones verificadas para ejecutar, probar, desplegar y reproducir el escenario base.
- **RF-22 (DEBE):** enlazar desde el README arquitectura, costos, captura de AWS Budget y limitaciones.

## 6. Requisitos no funcionales

| ID | Requisito | Criterio medible |
|---|---|---|
| RNF-01 Reproducibilidad | Misma versión, configuración y semilla producen igual resultado no volátil. | Tres ejecuciones separadas generan el mismo hash y JSON canónico. |
| RNF-02 Corrección | Se conservan población y estados. | `S+E+I+R=N` cada día; ningún conteo negativo; un estado por nodo. |
| RNF-03 Comparabilidad | Las políticas comparten condiciones externas. | Grafo, caso inicial y sorteos de transmisión tienen hashes iguales por réplica. |
| RNF-04 Rendimiento | La demo cabe en el tiempo del reto. | Preset base `N=1000, R=30, T=90` completa en ≤60 s p95 en AWS; sorpresa completa en <5 min humanos. |
| RNF-05 Usabilidad | Una persona puede usarla sin explicación previa. | Prueba moderada: configurar, ejecutar e interpretar la recomendación en ≤3 min. |
| RNF-06 Accesibilidad | No depender solo del color. | Etiquetas, tabla equivalente, foco visible, teclado y contraste WCAG AA en controles clave. |
| RNF-07 Seguridad | Sin secretos ni permisos amplios. | Escaneo de repositorio sin credenciales; IAM por función; buckets privados; CORS limitado al frontend. |
| RNF-08 Costos | Costo visible y coherente con cuenta. | Estimación mensual con fórmula y tarifas fechadas; gasto real capturado al cierre. |
| RNF-09 Resiliencia | Los fallos no se presentan como éxito. | Estado explícito; reintentos acotados; resultados parciales etiquetados o descartados. |
| RNF-10 Explicabilidad | El equipo puede explicar código y modelo. | README y pitch cubren reglas, supuestos, estrategia, límites y prueba de una semilla. |

## 7. Métricas y protocolo experimental

### 7.1 Unidad experimental

Una réplica contiene un grafo, caso inicial, calendario de contactos, parámetros y flujo de aleatoriedad. Dentro de la réplica, las tres políticas usan la misma realización externa. Las réplicas cambian la subsemilla de transmisión y, según el experimento, pueden conservar o regenerar el grafo; esta decisión debe quedar en el manifiesto.

### 7.2 Métricas primarias

- Infectados acumulados: número de nodos que alguna vez entraron a `E` o iniciaron en `I`.
- Personas salvadas frente a `none`.
- Mejora incremental frente a `random`.
- Pico de `I` y día del pico.
- Proporción de réplicas en que `targeted` supera a `random` y a `none`.

### 7.3 Métricas secundarias

- Infecciosos al final, duración hasta `I=0`, dosis usadas/efectivas, costo por persona salvada, tiempo de cómputo y memoria.
- Media, mediana, P05 y P95 por política.
- Diferencias pareadas y, cuando `R≥30`, intervalo bootstrap del 95 % con método y número de remuestras documentados.

### 7.4 Regla contra resultados afortunados

No se acepta una única ejecución como prueba de impacto. La presentación puede animar una réplica, pero la recomendación se basa en el agregado. También se conservan semillas donde la estrategia empata o pierde. No se afirma “siempre gana”.

### 7.5 Gate de preparación para el pitch

El producto no se declara listo para la prueba de fuego hasta que, con la matriz fija de semillas de validación:

1. `targeted` tenga menor media de infectados acumulados que `none` y `random` en el escenario base;
2. la diferencia media pareada frente a `random` sea positiva;
3. los cuatro presets sorpresa ejecuten sin cambios de código;
4. ninguna política exceda recursos ni vacune estados no elegibles;
5. una semilla nueva elegida externamente pueda ejecutarse y exportarse.

Si el gate falla, se reporta el resultado real y se ajusta la estrategia o el escenario con justificación; no se cambia la semilla para ocultarlo.

## 8. Criterios de aceptación

- **CA-01:** la simulación incluye día 0 y `T` días, y cumple RNF-02.
- **CA-02:** `random` y `targeted` parten del mismo conjunto elegible y usan el mismo máximo de dosis, día y eficacia.
- **CA-03:** ningún `E`, `I` o `R` recibe vacuna; la prueba cubre los tres estados.
- **CA-04:** `beta=0` produce cero exposiciones por contacto; un grafo sin aristas también.
- **CA-05:** `K=0` hace que las tres curvas sean idénticas bajo la misma réplica.
- **CA-06:** repetir configuración, versión y semilla tres veces produce el mismo hash.
- **CA-07:** invertir el orden de ejecución de políticas y réplicas no cambia resultados.
- **CA-08:** la UI cambia contagio, vacunas, origen y semilla y conserva valores ante error de validación.
- **CA-09:** la tabla coincide con métricas recalculadas desde las series y eventos.
- **CA-10:** cada resumen muestra `R`, media, mediana y P05/P95 y etiqueta correctamente el rango.
- **CA-11:** el JSON exportado permite reproducir el experimento en un proceso nuevo.
- **CA-12:** los cuatro presets sorpresa concluyen, muestran diferencias y caben en el flujo de cinco minutos.
- **CA-13:** la URL pública, `/v1/health` y el escenario base responden desde una sesión limpia.
- **CA-14:** README, arquitectura, costos, Budget, pitch y parámetros base están presentes y enlazados.
- **CA-15:** la revisión del repositorio no encuentra secretos; los permisos desplegados cumplen mínimo privilegio.

## 9. Trazabilidad con el reto

| Requisito oficial | Especificación | Evidencia mínima |
|---|---|---|
| DEBE 1: día a día | RF-04, CA-01 | Curvas y prueba de conservación |
| DEBE 2: intervención limitada | RF-05/RF-06, CA-02/CA-03 | `K` dosis y registro de elegibilidad |
| DEBE 3: dos líneas base | RF-05, RF-08 | Resultado de `none`, `random`, `targeted` |
| DEBE 4: repeticiones, promedios y rangos | RF-07/RF-09, CA-10 | Resumen de 30+ réplicas |
| DEBE 5: interfaz parametrizable | RF-02/RF-03, CA-08 | Demo sin editar código |
| DEBE 6: reproducible | RF-13/RF-19, CA-06/CA-11 | Hash y exportación repetida |
| DEBE 7: AWS | RF-20, CA-13 | URL pública y registro de despliegue |
| DEBE 8: supuestos y fuentes | RF-21/RF-22, CA-14 | README con tabla de procedencia |
| Nivel base | Secciones 3–8 | Gate completo y curva de contagios |
| Nivel PRO | Sección 4.2 | Evidencia separada por PRO-1…PRO-7 |
| Prueba de fuego | RF-15…RF-18 | Semilla del jurado y sorpresa <5 min |
| Calidad técnica 25 % | RNF-01…RNF-09 | Pruebas, arquitectura, IAM y revisión |
| Producto 15 % | RNF-05/RNF-06 | Prueba de uso y accesibilidad |
| Costos 10 % | RNF-08 | Estimación y gasto real |
| Presentación 10 % | Sección 11.1 | Archivo de presentación entregado |

## 10. AWS, costos y seguridad de producto

- La región objetivo autorizada es **`us-east-2` (Ohio)**. La región se define una sola vez mediante configuración y todos los recursos regionales, evidencias y cálculos de costos deben usarla.
- El equipo DEBE crear un AWS Budget desde el primer día y guardar `docs/budget.png`. Se recomiendan alertas informativas de costo real al 25/50/75/100 % y una alerta prevista; el README debe reflejar la configuración real.
- Una alerta de Budget no es un corte de gasto. El operador revisa costos a diario y dispone de un procedimiento de apagado.
- El repositorio no contiene llaves, tokens, números de cuenta ni secretos. El despliegue usa credenciales temporales del entorno autorizado.
- La estimación mensual muestra unidades, volumen, tarifa consultada, fecha, subtotal y exclusiones. Al finalizar se registra el gasto real observado.

## 11. Entregables

### 11.1 Entregables obligatorios

1. Repositorio público con código completo e historial real de commits.
2. `README.md` raíz: propósito, demo, arquitectura, instalación, pruebas, despliegue, supuestos/fuentes, parámetros base, semilla, limitaciones, costos y captura Budget.
3. `docs/arquitectura.svg` o `.png`, enlazado desde README, más fuente editable cuando exista.
4. `docs/costos.md` con cálculo mensual y gasto real del evento.
5. `docs/budget.png` sin datos sensibles.
6. Aplicación AWS con URL pública funcional hasta el pitch.
7. Presentación PDF/PPT/PPTX de máximo 20 MB.
8. Video público opcional, claramente identificado como respaldo.

## 12. Riesgos y mitigaciones

| Riesgo | Consecuencia | Mitigación |
|---|---|---|
| `targeted` pierde con ciertas semillas | Falla de impacto | Comparación pareada, matriz adversa, transparencia y ajuste documentado de heurística |
| Modelo demasiado complejo | El equipo no lo explica | SEIR y centralidad simples; PRO separado |
| Diferencias entre políticas no justas | Resultado inválido | Aleatoriedad común, hashes e invariantes |
| Sorpresa excede cinco minutos | Falla de prueba | Presets de un clic, límites y ensayo cronometrado |
| Cuota o servicio no disponible en `us-east-2` | Sin despliegue o función degradada | Verificar disponibilidad y cuotas en la cuenta antes de provisionar; no cambiar de región sin actualizar PRD, TRD, costos y evidencias |
| Costos exceden presupuesto | Pérdida de puntos/cuenta | Budget, límites de admisión, concurrencia acotada y apagado |
| Dependencia de red durante pitch | Demo fallida | Resultado exportado de respaldo, sin presentarlo como ejecución en vivo |
| Parámetros parecen datos reales | Pérdida de rigor | Etiquetar procedencia y limitaciones en UI/README |

## 13. Preguntas que deben resolverse sin cambiar silenciosamente el alcance

- Monto real del Budget y destinatarios autorizados.
- Límite medido de `N` y `R` que cumple RNF-04 en la cuenta del evento.
- Datos abiertos y permiso de uso si se implementa calibración PRO.
- Qué funciones PRO pasan de “opcional” a compromiso antes del cierre del 27 de octubre.
