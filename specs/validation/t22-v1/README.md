# Protocolo científico T-22 — v1

Fecha de registro: 2026-10-27 (America/Guayaquil). Estado al registrar: preparado; **no se han ejecutado los experimentos de esta matriz**. Fuentes: PRD §7.4/7.5, TRD §7/8 y specs/tasks.md T-22. No es una evaluación clínica ni un modelo espacial de Manta.

## 1. Congelación antes de resultados

La autoridad ejecutable es [protocol.json](protocol.json), con 15 configuraciones completas en inputs/. [SHA256SUMS](SHA256SUMS) identifica sus bytes. Los archivos se conservan con saltos LF mediante .gitattributes para verificar los mismos bytes en Windows/Linux. El commit que publique este protocolo fija también este documento. Conservar ese commit y la salida del verificador antes de ejecutar. No editar v1 para corregir un resultado desfavorable. Si hay un error o se cambia el motor/escenario, documentar el motivo, crear v2 y distinguir análisis exploratorio de una nueva evaluación; conservar todos los resultados v1.

El campo status de protocol.json describe el registro original. El estado de ejecución se lleva en un informe nuevo, sin modificar los archivos congelados. Las simulaciones pequeñas de I-01..09/validación local no pertenecen a esta matriz y no cuentan como resultados confirmatorios.

## 2. Pregunta y unidad experimental

Pregunta primaria: con la configuración base del proyecto, ¿targeted reduce los infectados acumulados medios frente a none y random?

Cada unidad es una réplica pareada con las tres políticas. Comparten red, inicialización, calendario y potenciales aleatorios según el motor verificado. networkMode=fixed dentro de cada semilla raíz; entre raíces se generan redes sintéticas distintas. No se interpretan como datos observados de una ciudad real.

Hay cinco raíces primarias y 30 réplicas por raíz (150 pares). Las raíces son bloques de red; las 30 réplicas de un bloque no son 30 redes independientes. Las políticas aleatoria/dirigida tienen la misma fecha, eficacia y máximo de dosis; no se exige igual cantidad efectiva ni mismo conjunto elegible después de trayectorias divergentes.

## 3. Semillas nuevas y derivación exacta

Para i=0..4: UTF-8 de zombie-management:T22:v1:validation-root:{i}; SHA-256; primeros cuatro bytes interpretados como entero uint32 little-endian sin signo. No usar hash() de Python ni sorteos sin registrar.

| Índice | Semilla raíz |
|---|---|
| 0 | 2085192491 |
| 1 | 144169776 |
| 2 | 2677345323 |
| 3 | 3856593946 |
| 4 | 2820136827 |

No se eligieron viendo resultados. No reutilizan las semillas de las comprobaciones funcionales anteriores. No son una semilla aportada por el jurado: esa aceptación permanece separada y pendiente. Las subsemillas por dominio/replicateIndex y bootstrap las deriva el motor existente; no se cambia su algoritmo.

## 4. Matriz fijada

Todas las filas usan R=30 y las tres políticas. Configuración base: N1000/T90, beta .08, sigma .333333, gamma .142857, I0=1, origen random, K100, intervención día0, eficacia1, red/pesos/calendario de los inputs normalizados. Se exporta sin frames para conservar resultados compactos; esto no elimina daily, selections, hashes ni eventos de la representativa. No se requiere animación para evaluar impacto.

| Grupo | Experimentos | Cambio respecto de base | Raíces |
|---|---|---|---|
| Primario | base-root-0..4 | Ninguno salvo raíz | Las cinco |
| Contraste descriptivo | higher-transmission | beta=.16 | Raíz0 |
| Contraste descriptivo | scarce-vaccines | K=50 | Raíz0 |
| Contraste descriptivo | partial-efficacy | eficacia=.5 | Raíz0 |
| Contraste descriptivo | market-origin | origen market | Raíz0 |
| Contraste descriptivo | delayed-intervention | intervención día7 | Raíz0 |
| Control técnico | control-zero-vaccines | N50/T10/K0 | Raíz1 |
| Control técnico | control-zero-transmission | N50/T10/beta0/K10 | Raíz1 |
| Control técnico | control-zero-efficacy | N50/T10/K10/eficacia0 | Raíz1 |
| Control técnico | control-full-coverage | N50/T10/K50/eficacia1/día0 | Raíz1 |
| Control técnico | control-terminal-intervention | N50/T10/K10/día10 | Raíz1 |

Total: 15 experimentos, 450 réplicas pareadas (150 primarias); cada unidad ejecuta tres políticas. El motor puede reejecutar su representativa. Los contrastes son ejemplos científicos fijados para esta evaluación, **no presets de UI ni una lista fija de casos que deba pedir el jurado**. No se mezclan sus métricas con el escenario primario para mejorar su promedio.

## 5. Métricas y decisión predefinida

Endpoint primario: cumulativeInfected (incluye iniciales I y excluye inmunidad por vacunas). Para cada raíz y réplica guardar C_none, C_random, C_targeted, D_none=C_none−C_targeted y D_random=C_random−C_targeted. Las diferencias negativas representan pérdidas y se conservan.

Las cinco raíces tienen 30 unidades cada una. Estimación primaria: media de las 150 observaciones de cada política, equivalente a dar igual peso a las cinco medias de raíz. No promediar escenarios distintos, omitir réplicas fallidas ni usar solo semillas ganadoras. Decidir sobre números sin redondeo visual.

**Componente científico de impacto aprobado** solo si las cinco ejecuciones primarias están completas y válidas, los controles técnicos pasan, sum(D_none)>0 y sum(D_random)>0 sobre los 150 pares. Esto exige menor media targeted que ambas referencias y ganancia pareada positiva frente a random (PRD §7.5). Un cero no satisface la mejora estricta. Una raíz que pierda no se oculta: se informa por separado aunque la estimación combinada sea positiva.

Estados del informe:

- **APROBADO:** condiciones anteriores satisfechas, con efectos e incertidumbre publicados.
- **NO APROBADO:** datos completos/válidos pero mejora estricta no satisfecha; conservar resultados, explicar y proponer ajustes transparentes.
- **INCOMPLETO/INVÁLIDO:** error, interrupción, archivo faltante, fallo de invariantes o entorno incompatible. No recomendar desde el subconjunto que sí terminó.

No se declara la aplicación lista para pitch solamente por aprobar este componente: faltan aceptación manual/jurado, evidencia AWS y demás criterios de base.

## 6. Incertidumbre y análisis secundarios

Por política/raíz: n, media, mediana, P05 y P95; P05–P95 es rango empírico, no IC. Por comparación pareada/raíz: valores completos, media/mediana/P05/P95, proporción de ganancias y bootstrap del backend (2000 remuestras, nivel95%, semilla reproducible). Reportar si intervalos incluyen cero, y recommendation/confidence del backend sin alterarlos para coincidir con el criterio global.

El criterio PRD usa efectos puntuales; no convertir automáticamente un punto positivo en evidencia concluyente. El soporte por IC es una conclusión distinta. **No producir un bootstrap global tratando los 150 pares como redes independientes.** El global preespecificado solo tiene estimaciones puntuales; la incertidumbre se presenta por bloque y con la variación de las cinco medias. Una inferencia jerárquica exigiría otro protocolo.

Métricas secundarias: pico I, primer día del pico, infecciosos finales, extinción E+I=0 con censura, dosis asignadas/efectivas/sin usar y win rates. No valorar como “duración cero” una extinción no observada (null). Contrastes descriptivos se informan todos, sin pruebas de significación múltiples ni buscar un escenario que sustituya al primario. No calcular costo por salvado sin modelo de costos; tiempos locales no son benchmark AWS.

## 7. Controles técnicos y calidad

- Todos: S+E+I+R=N cada día, valores no negativos, T+1 días, réplicas completas, sin dosis repetidas/exceso, stateAtDecision=S, políticas pareadas y hashes/versiones correctos. Respaldar elegibilidad/transiciones con las pruebas independientes de invariantes del backend; el campo registrado S por sí solo no es una prueba independiente del algoritmo.
- K0: daily exactamente idéntico entre las tres políticas por réplica.
- Beta0: cumulativeInfected=I0 todos los días.
- Eficacia0: cero dosis efectivas y daily idéntico por política, aunque las selecciones sean distintas.
- Cobertura completa en día0: con N50/I0=1, random/targeted asignan49 dosis efectivas, dejan1 sin usar y cumulativeInfected permanece1.
- Intervención en T: cumulativeInfected coincide por política; vacunas finales sí pueden cambiar S/R. No exigir igualdad de todas las columnas daily en este caso.
- JSON: validar y reproducir. Como mínimo reproducir cada archivo exportado una vez en un proceso nuevo; base-root-0 se reproduce tres veces en procesos separados y se compara hash/contenido no volátil. ZIP es auxiliar y no sustituye al JSON. Los eventos exportados solo cubren la representativa.

Registrar cualquier fallo con configuración, tipo/error, tiempo, versión y log. No reemplazar semillas, reducir R/T ni descartar la fila. Para un reintento técnico usar un directorio de intento nuevo, la misma configuración y registrar tanto fallo como reintento. Un cambio semántico del motor exige nueva versión de protocolo; un fallo no se resuelve eligiendo otra semilla.

## 8. Preparación y ejecución posterior

Antes de iniciar: entorno fijado por backend/uv.lock; registrar versión de Python/NumPy/NetworkX, commit exacto, sistema, memoria/CPU, protocolo/checksums y comando. El manifiesto exportado conserva versiones del motor/esquema/RNG/canonización. Ejecutar controles técnicos antes de interpretar los resultados primarios, manteniendo el orden de inputs publicado y documentando el orden real. El orden de ejecución no cambia la selección de datos.

**Ahora solo se verifica el plan:**

```powershell
.\backend\.venv\Scripts\python.exe scripts/check_validation_protocol.py
```

El verificador lee y valida los quince inputs, comprueba SHA-256 y derivación de semillas; no genera grafos ni llama al motor. Resultado observado: 15 experimentos/450 unidades previstas, simulationsExecuted=0. SHA-256 de protocol.json: cb6b3e62795de8a6ec87f1a7e4c972c692ebbcb5144d3546ec6f622a92ffbb8b.

**Comando de ejecución futura de una fila, no ejecutado durante la preparación:**

```powershell
$sourceCommit = git rev-parse HEAD
New-Item -ItemType Directory -Path .tools/t22-v1-attempt-01
.\backend\.venv\Scripts\python.exe scripts/export_experiment.py specs/validation/t22-v1/inputs/base-root-0.json .tools/t22-v1-attempt-01/base-root-0.json --no-frames --build-commit $sourceCommit
.\backend\.venv\Scripts\python.exe scripts/reproduce.py .tools/t22-v1-attempt-01/base-root-0.json
```

Iterar después todas las filas de protocol.json con sus IDs exactos y conservar JSON/ZIP/logs, sin sobrescribir outputs existentes. No confundir probar que los inputs son válidos con aprobar la simulación. No se preparó un lanzamiento automático al instalar/abrir archivos ni se ejecutan recursos AWS.

## 9. Informe que debe producir la ejecución

Guardar bajo un directorio nuevo de intento: protocolo/commit, entorno, inventario de los15 runs con estado, configuración/raíz/R, hash, ruta JSON/ZIP/log, tiempos y errores/reintentos. Resumen primario por raíz y combinado: medias por política, ambas diferencias, win rates y estado de decisión. Tabla completa de contrastes y controles, con pérdidas/empates. Reproducciones con hash esperado/obtenido y código de salida. Incluir una sección de limitaciones y datos ausentes. El informe de ejecución se crea después; este protocolo no contiene resultados inventados.

## 10. Aceptación operativa separada

Solicitar a una persona externa una semilla válida y valores nuevos; registrar su procedencia sin datos personales innecesarios. Operador los introduce manualmente, genera preview, compara, explica y exporta. Registrar tiempo humano total<5min (CA-12), sin sustituirlo por tiempo del script. Prueba moderada configurar/interpretar≤3min y accesibilidad se documentan por separado. La semilla externa no se agrega retrospectivamente a las150 unidades primarias; se informa como aceptación adicional. Casos manuales válidos no están restringidos a los contrastes de esta matriz.

Estado actual de esas comprobaciones: pendientes. También siguen pendientes el benchmark AWS N1000/R30/T90, URL pública, costos/seguridad y demás aceptación. PRO no se inicia por preparar o ejecutar este protocolo.
