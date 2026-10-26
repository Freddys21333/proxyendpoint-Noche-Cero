# Acuerdos técnicos de la versión base

**Versión:** 1.0 — 26 de octubre de 2026.
**Estado:** decisiones de diseño adoptadas; implementación y comprobación AWS pendientes.

Este anexo resuelve D-01..D-07 y fija el diseño de infraestructura de D-08. Es parte de [design.md](design.md), [requirements.md](requirements.md) y [tasks.md](tasks.md). Los valores nuevos de generación son supuestos sintéticos del equipo. No representan datos de población o enfermedad real. [Los esquemas ejecutables y ejemplos](../schemas/README.md) se materializaron y verificaron en T-03 siguiendo este contrato; todavía no existe una API implementada.

## 1. Calendario y frontera temporal — D-03/D-05

Se registran exactamente T+1 estados, de 0 a T. El día 0 es lunes; el día d tiene weekday=d mod 7, donde 0=lunes y 6=domingo. No depende de fecha real, huso horario ni reloj del servidor.

Definimos B[d] como el estado tras d intervalos de transmisión y **después** de la intervención programada en d:

1. Inicializar S e I en B[0], aplicar vacunas si interventionDay=0 y registrar día 0.
2. Para d=0..T−1: activar contactos del día d; usar el snapshot B[d] para contagio y progresión. Aplicar transiciones simultáneamente para producir el estado preliminar del día d+1.
3. Si interventionDay=d+1, vacunar los S del estado preliminar antes de registrar B[d+1].
4. Registrar conteos y eventos del día d+1. No ejecutar una transmisión adicional tras B[T].

Por tanto, vacunar en día 7 protege del intervalo [7,8), no deshace exposiciones de [6,7). Los conteos de día 7 ya incluyen la vacunación. Vacunar en T consume dosis y cambia S/R de B[T], pero no reduce contagios anteriores ni crea un día T+1. Con eficacia 1, un S vacunado no puede contagiarse en el siguiente intervalo. Un E nunca es elegible aunque todavía no contagie.

La política puntúa la red activa del día de decisión, también cuando d=T. El calendario se genera hasta T inclusive para permitir ese score; transmisión solo usa 0..T−1. E→I e I→R se evalúan desde el snapshot previo a transiciones; nuevos E/I no progresan dos veces en el mismo intervalo. Los eventos epidemiológicos del intervalo [d,d+1) se etiquetan con day=d+1; las vacunas con su día de decisión.

`outbreakDuration` es el primer día d con E[d]+I[d]=0; devuelve null si no se extinguió al final. Esto evita declarar terminado un brote que aún tiene expuestos. `finalInfectious=I[T]`; peakDay es el primer máximo de I entre 0 y T.

Ejemplo de aceptación: con T=1, un I y un S conectados, beta=1, peso=1, gamma=0 y eficacia=1, vacunar S en 0 evita exposición; vacunar en 1 no puede vacunar al nuevo E. Un S aislado sí puede vacunarse en 1, sin alterar acumulados.

## 2. Grafo, grupos y contactos — D-03

El generador se identifica como `synthetic-manta-v1`. Los enteros porcentuales se calculan con floor, salvo donde se indica mínimo. Cada muestreo de un conjunto toma candidatos por id ascendente antes de la selección; almacenar resultados ordenados. No usar orden de sets/dicts para decidir sorteos.

- Hogares: barajar ids con dominio graph, muestrear tamaños con probabilidades del TRD y truncar el último al remanente. IDs consecutivos `household-0`, etc.; clique por hogar.
- Roles: segunda permutación; floor(0.25N) estudiantes, floor(0.55N) trabajadores, resto comunidad. Agrupar estudiantes en otra permutación, bloques hasta 25, IDs `school-0`, etc.
- Colegio: por salón de m personas, si m<3 usar clique; si no, Watts–Strogatz con k=min(6, mayor entero par menor que m) y reconexión p=0.1. Proveer semilla entera extraída del flujo graph, no RNG global. No aristas escolares entre salones.
- Buses: seleccionar floor(0.40N) personas sin reemplazo y agrupar en bloques hasta 40 (`bus-0`, etc.). Cada día operativo, cada par de su ruta tiene contacto Bernoulli con p=min(1,6/(m−1)); m<2 no tiene aristas. Son contactos sintéticos diarios, no viajes geográficos.
- Mercado: seleccionar max(1,floor(0.10*trabajadores)) vendedores entre trabajadores; un mercado `market-0`. Cada día operativo seleccionar floor(0.20N) visitantes entre no vendedores sin reemplazo. Para cada visitante y vendedor, contacto con p=min(1,8/númeroDeVendedores); no se añaden contactos visitante–visitante. El 20 % de visitantes y el algoritmo de contactos completan supuestos no cuantificados del TRD.
- Barrios: permutar todos los nodos y repartir por índice mod 5 (`neighborhood-0`..`4`); por cada par dentro de un barrio, incluir arista con p=0.02, fija todo el horizonte.
- Hogar/barrio operan todos los días; colegio lunes–viernes; bus/mercado lunes–sábado. Pesos del TRD 1/0.6/0.45/0.5/0.2 respectivamente.

Generar los grupos primero y los contactos después, por día ascendente, contexto en orden `household,school,bus,market,neighborhood`, y pares lexicográficos u<v. Las aristas fijas se reutilizan y las diarias se guardan en unión por (u,v,context), con activeDays ordenado. Asignar edgeId consecutivo tras ordenar esa unión. Dos contextos entre un par siguen siendo dos aristas. Sin lazos ni duplicados dentro de contexto/día.

Grafo canónico: `{generatorVersion,nodes,edges}`; nodo incluye id, role, householdId, neighborhoodId, schoolId/busId/marketId anulables. marketId significa vendedor o visitante al menos un día de 0..T. Edge incluye id,u,v,context,weight,activeDays. graphHash cubre grupos y calendario entero, no posiciones. La red se mantiene igual para todas las réplicas.

Concreción T-06: crear grupos en orden hogares, roles, salones, buses, vendedores, barrios. Permutar candidatos ordenados y conservar la permutación para dividir bloques; ordenar cada bloque para contactos. Extraer la semilla NetworkX como entero uint32 del flujo graph. Crear contactos fijos al procesar su contexto en día 0 y reutilizarlos. Los pares de cada contexto se recorren globalmente en orden lexicográfico antes de sortear contactos diarios. `initialStateHash` es el hash canónico de `{graphHash,initialInfectiousNodeIds}` antes de vacunación; IDs ordenados. Diferentes parámetros que produzcan exactamente el mismo estado pueden conservar este hash, que identifica contenido y no la petición.

El layout base no requiere otro algoritmo: ordenar nodos por id sobre círculo unitario, x=round(cos(2πid/N),6), y=round(sin(2πid/N),6). Su salida es visual y se excluye de graphHash. El frontend puede reubicar nodos sin cambiar el experimento.

## 3. Sorteos y reproducibilidad — D-02/D-06

Algoritmo `rng-v1`: Generator(PCG64(SeedSequence(entropy))). Para etiqueta UTF-8 L, dividir SHA-256(L) en ocho palabras uint32 little-endian. entropy=[rootSeed, replicateIndex, *palabras]. Etiquetas exactas del TRD; graph/layout/bootstrap usan índice 0. Initial, transmission, progression, vaccine y policy-random usan el índice real r=0..R−1. No usar spawn dependiente del orden de ejecución. Fijar versiones exactas de Python/NumPy/NetworkX en el entorno de implementación y conservarlas en manifiesto.

Transmisión: crear potenciales uniformes U[d,edgeId] para d=0..T−1, todas las aristas de la unión y todas las políticas, incluso si ese día están inactivas. Para arista activa con un extremo I y otro S en B[d], hay éxito si U<clamp(beta*weight,0,1). El S entra en E si al menos una arista tuvo éxito. Si hay varias, registrar la menor edgeId exitosa como causal y su vecino I; no es inferencia epidemiológica real.

Así la probabilidad agregada es exactamente `1-product(1-p_edge)` del TRD. No hacer además otro sorteo agregado por nodo. Las aristas activas se fijan por calendario antes de políticas, y el mismo U se reutiliza en todas. Al invertir políticas no cambia nada.

Progresión: generar matriz (T,N,2), orden C día/nodo/canal. Canal 0 decide E→I con sigma; canal 1 decide I→R con gamma. Transmisión: matriz (T,edgeCount), orden C. Eficacia: matriz (T+1,N), orden C, umbral vaccineEfficacy. Crear potenciales aunque no se consuman según el estado. Solo mantener una réplica en memoria.

Concreción binaria T-07: randomnessHash recorre transmission/progression/vaccine. Para cada matriz agrega longitud del encabezado como uint64 little-endian, encabezado canonical-v1 `{name,shape}` y bytes de la matriz float64 little-endian en orden C. El SHA-256 con prefijo identifica estos potenciales y no depende de políticas ni de si un sorteo se usa.

Initial: primer nodo uniforme entre candidatos ordenados; restantes en toda población menos primero, sin reemplazo, y registrar ids ordenados. Random: choice sin reemplazo sobre elegibles por id con policy-random; ordenar selección para serializar. Targeted calcula todos los scores desde un solo snapshot antes de vacunar y ordena (-score,id); no recalcula después de cada dosis.

Concreción T-08: el score suma con math.fsum los pesos de aristas activas hacia S en orden edgeId. contexts enumera las capas de esas aristas, sin duplicados y en orden lexicográfico. El rank empieza en 1; random lo asigna en orden de muestreo antes de serializar por nodeId. La política decide sin recibir potenciales futuros; la eficacia se aplica después por (día,nodo). Ninguna política reintenta dosis fallidas en días siguientes.

Percentiles: método linear, índice (n−1)q e interpolación entre vecinos, incluidos P05/P95. Bootstrap: vector de diferencias pareadas por índice de réplica; 2.000 muestras de tamaño R, con reemplazo, índices generados como una matriz (2000,R) por dominio bootstrap. Calcular medias por fila y percentiles 2.5/97.5 con linear; usar los mismos índices para todas las comparaciones. R<30 devuelve bootstrap=null, no un intervalo inventado.

## 4. Configuración, origen y límites — D-01/D-04

En requests, configuration es objeto con rootSeed, networkMode, repetitions, scenario, intervention, policies y network. schemaVersion está en el request raíz, no duplicado en configuration.

- networkMode=`fixed`; policies contiene exactamente una vez none/random/targeted, en cualquier orden; normalizar en ese orden.
- scenario/intervention y sus defaults son los de requirements §3. El default origin.kind es random; value=null.
- origin.kind=node requiere value entero 0..N−1. Para random o contexto, value debe ser null. En base se elige entre todos los grupos del contexto; selección de grupo específico queda fuera. Si contexto vacío, 422 ORIGIN_EMPTY.
- network incluye generatorVersion=`synthetic-manta-v1`, dayZero=`monday` y weights con las cinco claves del TRD, cada una finita 0..1. El calendario y porcentajes quedan fijados por versión, no editables en base. Incluirlos y su descripción en `/config` y manifiesto. La UI puede editar pesos, pero no es un control obligatorio de la primera pantalla.
- Configuración omitida se completa recursivamente con defaults antes de validar relaciones. Si N<100 y no se especifican vacunas, el default 100 genera 422; no recortar silenciosamente. No aceptar campos desconocidos, NaN/infinitos, strings numéricos ni booleanos como enteros.
- Entrada estricta concretada en T-04: claves JSON duplicadas y desbordamiento a infinito se rechazan como 400 INVALID_JSON; null explícito no equivale a configuración omitida. Números integrales escritos como `1000.0` cumplen el tipo integer de JSON Schema y se normalizan a enteros; no se convierten strings ni booleanos.
- Límites iniciales: request 64 KiB UTF-8; aristas de unión 100.000; frames representativos N*(T+1)≤400.000 estados; JSON sin comprimir ≤32 MiB y respuesta proxy completa ≤5 MiB tras compresión/base64. Son límites de aplicación conservadores, no afirmaciones sobre cuotas AWS. Exceso: 413, sin truncamiento ni resultado de éxito parcial. Publicarlos en `/config`; benchmark puede reducirlos con cambio de contrato registrado.

Preview recibe `{schemaVersion,configuration}` y devuelve configuración normalizada y red. Compare recibe `{schemaVersion,configuration,expectedGraphHash,includeRepresentativeFrames}`. expectedGraphHash obligatorio, patrón `^sha256:[0-9a-f]{64}$`; frames boolean obligatorio. No aceptar `sha256:...`.

graphHash cambia al cambiar rootSeed, N, T o network. InitialStateHash depende además de origen e initialInfectious y réplica. Para evitar preview visual obsoleto, la UI repite preview ante cualquier cambio de configuración; el servidor compara graphHash y devuelve 409 GRAPH_HASH_MISMATCH cuando no coincide. Cambiar solo vacunas puede conservar graphHash y aun así invalida el resultado anterior.

## 5. Respuestas y errores — D-01/D-07

Todas las respuestas llevan schemaVersion=`1.0`, engineVersion string y requestId string no vacío. Fecha generatedAt es ISO-8601 UTC. Nunca incluir cuenta AWS ni credenciales. Los nombres de propiedades son camelCase. Estas formas son normativas para materializar OpenAPI en T-03.

| Respuesta | Campos además del envoltorio común |
|---|---|
| health | status=`ok`, region:string, buildCommit:string, generatedAt:string |
| config | defaults:configuration completa, limits:{maxRequestBytes,maxResponseBytes,maxDecodedResponseBytes,maxEdges,maxFrameStates}, features:{asyncJobs:false,representativeFrames:true}, generatorDescription:string |
| preview | configuration completa, graph:{generatorVersion,nodes,edges}, graphHash, positions:[{nodeId:int,x:number,y:number}], initialInfectiousNodeIds:[int] (réplica 0), initialStateHash |
| compare | configuration completa, manifest, graph, graphHash, summaryByPolicy, pairedComparisons, aggregatedCurves, replicates, representative, recommendation, progress, generatedAt |

Tipos de compare:

- `progress={replicatesTotal:int,replicatesSucceeded:int,replicatesFailed:int}`. Un 200 exige total=succeeded=R y failed=0. Si una réplica falla, abortar comparación con 500 SIMULATION_FAILED; no devolver recomendación parcial. El frontend muestra ejecución indeterminada mientras espera.
- `replicates` ordenado por index: `{index:int,initialInfectiousNodeIds:[int],initialStateHash:hash,randomnessHash:hash,policies:{none:PolicyResult,random:PolicyResult,targeted:PolicyResult}}`. randomnessHash cubre los potenciales compartidos, no policy-random. PolicyResult contiene `metrics`, `daily`, `selections`, `events`, `resultHash`.
- `daily=[{day:int,s:int,e:int,i:int,r:int,cumulativeInfected:int}]`, T+1 filas. `metrics={cumulativeInfected:int,peakInfectious:int,peakDay:int,finalInfectious:int,outbreakDuration:int|null,vaccinesAssigned:int,vaccinesEffective:int,vaccinesUnused:int}`. Unused=K−assigned; none tiene assigned=effective=0, unused=K como inventario no usado.
- `selections=[{day:int,nodeId:int,score:number|null,rank:int,stateAtDecision:"S",contexts:[context],tieBreak:"nodeIdAsc"|"seededRandom",effective:bool}]`. Score/rank explican la decisión previa; random usa score=null y rank del orden muestreado; serializar filas por day/nodeId sin alterar rank. none tiene lista vacía.
- `events=null` en réplicas no representativas; en la representativa se incluye `[{day:int,nodeId:int,from:state,to:state,cause:"initial"|"contact"|"progression"|"vaccine",sourceNodeId:int|null,edgeId:int|null}]`. El motor conserva/procesa eventos completos por réplica para verificar métricas, pero no los transporta todos. Iniciales I: from=to=I y cause=initial; no contabilizarlos dos veces. Vacuna fallida solo queda en selections. Contact incluye fuente; otras causas tienen fuente/arista null. Orden estable day,nodeId,cause. Esto conserva trazabilidad visual y evita multiplicar el payload por R.
- `summaryByPolicy` tiene las tres claves de política; por cada métrica de metrics devuelve `{n:int,mean:number|null,median:number|null,p05:number|null,p95:number|null}`. Para duración censurada usar solo no nulos y n efectivo; si ninguno, n=0 y estadísticos null. Para las demás n=R.
- `pairedComparisons={savedVsNone:{random:Comparison,targeted:Comparison},gainVsRandom:Comparison,targetedWinRateVsNone:number,targetedWinRateVsRandom:number}`. Comparison=`{values:[number],mean:number,median:number,p05:number,p95:number,bootstrap:{level:0.95,resamples:2000,lower:number,upper:number}|null}`; values ordenado por réplica. WinRate cuenta solo diferencias estrictamente positivas / R.
- `aggregatedCurves` tiene claves por política, arrays de T+1 filas `{day,s:Stats,e:Stats,i:Stats,r:Stats,cumulativeInfected:Stats}`; Stats usa forma de summary. No graficar filas de políticas mezcladas.
- `representative={index:int,initialSeed:{rootSeed:int,replicateIndex:int,domain:"initial"},frames:null|{none:[[state]],random:[[state]],targeted:[[state]]}}`; cada matriz tiene T+1 filas y N columnas indexadas por nodeId. Elegir índice según mediana de acumulados targeted.
- `recommendation={winner:"none"|"random"|"targeted"|"tie",confidence:"descriptive"|"inconclusive"|"supported",reasons:[string],limitations:[string]}`. Winner es mínimo de media de acumulados; empate con tolerancia absoluta 1e−9 da tie. Para ganador único, supported requiere R≥30 y que los IC bootstrap de las dos diferencias competidor−ganador tengan lower>0; si no, descriptive con R<30 o inconclusive con R≥30. Los IC adicionales necesarios se calculan con mismos índices. No traducir supported a certeza clínica.
- `manifest={engineVersion,schemaVersion,buildCommit,pythonVersion,dependencies:{nombre:version},generatorVersion,rngVersion:"rng-v1",bitGenerator:"PCG64",canonicalVersion:"canonical-v1",networkMode:"fixed",rootSeed,graphHash,experimentHash}`. La derivación de §3 y la configuración completa acompañan el manifiesto en exportación; no guardar semillas ficticias de una corrida no ejecutada.

Errores: envoltorio común + `{error:{code:string,message:string,fields:[{path:string,reason:string}]}}`. fields=[] si no hay campo concreto. 400 INVALID_JSON/UNKNOWN_FIELD; 404 NOT_FOUND; 409 GRAPH_HASH_MISMATCH; 413 REQUEST_TOO_LARGE/RESULT_TOO_LARGE/GRAPH_TOO_LARGE/FRAMES_TOO_LARGE; 422 VALIDATION_ERROR/ORIGIN_EMPTY; 429 RATE_LIMITED; 500 INTERNAL_ERROR/SIMULATION_FAILED; 503 COMPUTE_UNAVAILABLE. Sin trazas internas ni datos sensibles. HTTP 429 incluye Retry-After cuando el servicio lo conoce; no inventar duración.

## 6. Canonización y exportación — D-01/D-06/D-07

canonical-v1: JSON UTF-8 sin BOM, claves ordenadas lexicográficamente, sin espacios insignificantes, strings sin escapes ASCII innecesarios y sin saltos al final para el hash. Enteros decimales; números finitos normalizados por el serializador fijado de Python, convertir -0.0 a 0 y floats integrales a enteros antes de serializar. Sin redondear los cálculos de simulación/estadística; el formato visual no altera datos. Mismo entorno/versión es parte de la garantía, no promesa de identidad entre serializadores de distintos lenguajes.

Hash=`sha256:`+hex SHA-256. Arrays de entidades ordenados por id, curvas por día y réplicas por índice; policies orden none/random/targeted. resultHash cubre metrics/daily/selections de esa política. experimentHash cubre configuration, graph y resultados de réplicas, excluye eventos opcionales, frames, sus propios campos hash, requestId, generatedAt y manifest.buildCommit. Engine/schema/generator/rng/canonicalVersion sí se incluyen como objeto versions para invalidar cambios semánticos. La derivación de resultHash y graphHash no usa objetos que contengan su propio hash. randomnessHash usa bytes little-endian float64, shapes y nombres de matrices en orden transmission/progression/vaccine.

JSON de descarga: respuesta completa de compare, incluyendo grafo, eventos de la representativa y manifiesto. Un exportador debe poder reproducirlo aun si representative.frames=null; eventos completos se regeneran desde configuración/semilla. El CLI recibe ruta JSON y usa el motor; compara experimentHash y sale con error si no coincide.

CSV: descarga ZIP generado en cliente a partir de la respuesta, sin endpoint nuevo. UTF-8, encabezado, separador coma y escape estándar con comillas dobles. Incluir `configuration.json`, `manifest.json`, `nodes.csv`, `edges.csv`, `daily.csv`, `metrics.csv`, `selections.csv`, `events.csv`, `summary.csv`, `comparisons.csv`:

- nodes: id,role,householdId,neighborhoodId,schoolId,busId,marketId.
- edges: id,u,v,context,weight,activeDays (array JSON en celda).
- daily: replicateIndex,policy,day,s,e,i,r,cumulativeInfected.
- metrics: replicateIndex,policy y las ocho claves de metrics en el orden definido arriba.
- selections: replicateIndex,policy y las claves de selections; contexts es array JSON en celda.
- events: replicateIndex,policy y claves de events en el orden definido arriba; solo representativa, documentado en manifest.json como `exportedEventsScope="representative"` dentro de una propiedad adicional `exportMetadata` del archivo ZIP, no del manifiesto del experimento.
- summary: policy,metric,n,mean,median,p05,p95.
- comparisons: comparison,replicateIndex,value; comparison en savedVsNone.random, savedVsNone.targeted, gainVsRandom. Estadística/IC permanece también en resultado JSON `comparison-summary.json` dentro del ZIP.

Null se escribe como celda vacía; listas como JSON. El JSON es la fuente de reproducción, el ZIP facilita análisis. No duplicar fórmulas de métricas en frontend.

## 7. Interfaz Terraform–backend–frontend — D-08 (diseño cerrado)

Backend entrega `build/backend.zip` compilado en entorno Linux compatible con Lambda Python 3.12 x86_64; dependencias nativas y código en raíz de importación. Paquete incluye módulos `domain/`, `simulation/`, `strategies/`, `api/`. Handlers exactos: `api.health.handler`, `api.config.handler`, `api.preview.handler`, `api.compare.handler`. HTTP API usa payload format 2.0; adapters aceptan event/context y devuelven statusCode, headers y body. Sin framework HTTP obligatorio.

Desde T-04 el ZIP también debe incluir `schemas/common.schema.json` como recurso junto a esas carpetas y jsonschema con sus dependencias de runtime. El dominio carga solo ese recurso local; no descarga schemas. No mantener una copia editada dentro de backend: el build copia el archivo compartido desde `schemas/`.

Health/config/errores usan body JSON string sin codificación binaria. Preview/compare usan JSON UTF-8 comprimido gzip (mtime=0), body base64, isBase64Encoded=true y headers Content-Type:application/json, Content-Encoding:gzip. Limitar el envoltorio proxy completo a 5 MiB; el navegador descomprime antes de parsear JSON. Cliente local/CLI debe soportar gzip. Verificar esta integración en smoke y contrato; no depender de compresión automática de API Gateway. JSON descargado queda descomprimido, con límite 32 MiB. La compresión evita transportar sin necesidad el gran calendario y todos los frames como texto bruto.

Terraform administra cuatro Lambdas, HTTP API/rutas/integraciones, roles/log groups, alarmas y Amplify app/branch. Variables: `project_name` (default zombie-management), `environment` (staging/prod), `aws_region` (us-east-2), `backend_zip_path`, `build_commit`, `allowed_origins` (lista exacta), `frontend_repository_url`, `frontend_branch`. Credenciales GitHub se proporcionan fuera de variables públicas; no hardcodear tokens en HCL/CI/frontend. La conexión de repositorio de Amplify se completa con autorización de cuenta al desplegar; no asumir acceso concedido.

Terraform calcula base64 SHA-256 del ZIP en source_code_hash. Configuración inicial de compare: 2048 MB, timeout 28 s y concurrencia reservada 2; preview: 1024 MB/28 s; health/config: 256 MB/5 s. Son valores iniciales sujetos a benchmark y cuotas, no resultados de rendimiento. Build Linux es requisito: no subir wheels de Windows. Exceso de costo/tiempo requiere revisión antes de subir concurrencia.

Variables de entorno backend: AWS_REGION provista por runtime (no redefinirla), ENGINE_VERSION, SCHEMA_VERSION, BUILD_COMMIT, MAX_REQUEST_BYTES=65536, MAX_RESPONSE_BYTES=5242880, MAX_DECODED_RESPONSE_BYTES=33554432, MAX_EDGES=100000, MAX_FRAME_STATES=400000. CORS se gestiona en HTTP API con allowed_origins; desarrollo solo permite localhost explícito. Frontend usa `VITE_API_BASE_URL` con URL que ya incluye `/v1`, `VITE_BUILD_COMMIT` y `VITE_SCHEMA_VERSION`; el cliente agrega solo `/health`, `/config`, `/scenarios/preview`, `/simulations/compare`.

Outputs Terraform: `api_base_url` (incluye /v1), `frontend_url`, `aws_region`, `build_commit`, `health_url`. Secrets nunca en outputs públicos. Terraform state remoto: S3 privado cifrado/versionado y lockfile nativo (`use_lockfile=true`), clave separada por environment. Sin DynamoDB para bloqueo. Bootstrap del bucket se maneja como stack separado antes de inicializar el stack de aplicación; no intentar crear el backend dentro del mismo state que aún no existe. Planes/estado fuera de Git; `.terraform.lock.hcl` sí versionado.

S3 de estado es infraestructura de administración y no agrega persistencia de resultados al producto base. Despliegue conserva la secuencia build→pruebas→plan revisado→apply autorizado→outputs→build frontend→smoke. Resolver el CORS inicial usando el dominio de Amplify conocido tras crear app/branch; no habilitar wildcard para salir del paso.

## 8. Comprobaciones externas que no se pueden declarar resueltas

Se mantiene `us-east-2` como decisión técnica existente; la aceptación por la organización no está demostrada. No cambiar a us-east-1 por inferencia. También faltan comprobar acceso real para Terraform/IAM/Amplify, cuotas Lambda/API, método de conexión GitHub y entrega de alertas del Budget en la cuenta simplificada.

Estas son verificaciones operativas de T-17, no dudas del contrato. No requieren esperar para programar localmente. No crear recursos ni activar pago/características avanzadas para cerrarlas sin autorización. Mantener evidencia Budget como provisional hasta comprobar notificación.

## 9. Ejemplos de aceptación que deben convertirse en pruebas

1. Dos aristas independientes con probabilidades 0.2 y 0.5 dan p_exposure=0.6; evaluar dos U por arista y nunca un tercer U agregado.
2. Domingo d=6: colegio/bus/mercado inactivos; hogar/barrio activos. Lunes d=7 se reactivan. dayZero no depende del reloj.
3. Intervención d=7 se registra en B[7], protege desde [7,8) y no rescata E generado en [6,7). En T no hay transmisión adicional.
4. Vector [0,10] produce P05=0.5, mediana=5 y P95=9.5 con linear. Para R<30 bootstrap=null.
5. Trayectoria I=[1,0,0] y E=[0,1,0] se extingue en d=2, no d=1; si E[T]>0, duración null.
6. Cambiar eficacia no cambia graphHash; cambiar T sí. Todos los cambios de configuración invalidan el resultado presentado.
7. origin.kind=node con value=null o fuera de población devuelve 422; origin.kind=market con value no null también.
8. Una réplica fallida impide 200 de compare; inversión del orden de políticas/réplicas conserva hashes y ranking de cada política.

## 10. Referencias verificadas para implementación

- [NumPy: generadores y SeedSequence](https://numpy.org/doc/stable/reference/random/bit_generators/index.html).
- [NumPy: percentiles y método linear](https://numpy.org/doc/stable/reference/generated/numpy.percentile.html).
- [Terraform: backend S3, versionado y use_lockfile](https://developer.hashicorp.com/terraform/language/backend/s3).
- [AWS: empaquetado Python Lambda y dependencias nativas](https://docs.aws.amazon.com/lambda/latest/dg/python-package.html).

Las referencias respaldan mecanismos de librerías/servicios. Los supuestos del modelo, tamaños, tiempos y criterios de comparación anteriores son decisiones del proyecto y deben validarse con pruebas/benchmark.
