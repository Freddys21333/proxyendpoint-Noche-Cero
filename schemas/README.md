# Contratos compartidos — T-03

Contrato base v1 para frontend y backend. Los artefactos describen la API futura; **no hay endpoints ni simulación implementados** en este incremento.

## Archivos y fuente de verdad

| Archivo | Uso |
|---|---|
| [openapi.yaml](openapi.yaml) | OpenAPI 3.1.0: cuatro rutas, requests, respuestas, errores y ejemplos. |
| [common.schema.json](common.schema.json) | Tipos compartidos Draft 2020-12 en `$defs`, incluyendo configuración y resultados completos. |
| [configuration.schema.json](configuration.schema.json) | Configuración normalizada completa, con todas las propiedades requeridas. |
| [preview-request.schema.json](preview-request.schema.json) | Solicitud de preview: configuración parcial u omitida. |
| [experiment-request.schema.json](experiment-request.schema.json) | Solicitud de compare: hash esperado y selección de frames obligatorios. |
| [health-result.schema.json](health-result.schema.json) | Respuesta de health. |
| [config-result.schema.json](config-result.schema.json) | Defaults completos, límites y features. |
| [preview-result.schema.json](preview-result.schema.json) | Grafo, posiciones, origen y hashes de preview. |
| [experiment-result.schema.json](experiment-result.schema.json) | Comparación completa, métricas, curvas, manifiesto y representativa. |
| [error.schema.json](error.schema.json) | Envoltorio común de error y catálogo de códigos. |
| [examples/index.json](examples/index.json) | Catálogo de los 26 ejemplos y su conexión con esquema, operación y estado HTTP. |

Editar `common.schema.json` para cambiar un tipo compartido; los otros JSON Schemas solo referencian su definición. No mantener copias independientes de los tipos en OpenAPI: sus rutas referencian estos mismos archivos. Las referencias son relativas y se pueden resolver localmente; las pruebas usan un registro local sin descargar esquemas desde Internet.

La definición funcional y las relaciones de dominio están en [agreements.md](../specs/agreements.md). Para cambiar el contrato, actualizar ese acuerdo y los documentos afectados, después schemas, ejemplos y pruebas. Una modificación no compatible requiere revisar schemaVersion. No hay un generador que deba ejecutarse para editar estos artefactos.

## Flujo para frontend

1. Usar `config-response.json` para conocer los defaults y límites del formulario. El origen base es `random`.
2. Usar `preview-request.json` y `preview-response.json` para un caso ligero de 50 personas y un día.
3. Llevar `graphHash` de preview a `expectedGraphHash` de `compare-request.json` y presentar `compare-response.json`.
4. Probar las variantes `compare-response-no-frames.json`, `compare-response-vaccines.json` y `compare-response-bootstrap.json`, además de los errores del catálogo.

Los ejemplos mínimos de request muestran configuración omitida; los futuros handlers deberán completarla con defaults. No están emparejados con la respuesta ligera de 50 personas: un request mínimo usa por defecto 1.000 personas, 90 días y 30 réplicas.

Servidor de referencia en OpenAPI: `http://localhost:8000/v1`, todavía no implementado. Las rutas del documento son `/health`, `/config`, `/scenarios/preview` y `/simulations/compare`; no duplicar `/v1` al construir URLs. El despliegue inyectará la base real mediante `VITE_API_BASE_URL`.

Health/config/errores son JSON ordinario. Preview/compare se documentan como JSON con `Content-Encoding: gzip`; los ejemplos contienen el JSON ya descomprimido que recibe el cliente. Base64 corresponde únicamente al adapter Lambda, no al payload de la aplicación. No hay jobs, polling ni progreso en vivo en la base.

## Mocks y límites de verificación

**Todos los ejemplos están construidos a mano.** Los identifica `requestId=mock-contract-v1`, el índice `kind=handcrafted-contract-examples` y las limitaciones de la recomendación. Los hashes repetidos con letras `a`..`e` son marcadores de formato válido, no hashes calculados por el motor. Nunca enviarlos a una API real esperando que valide el grafo.

La red es una muestra mínima de estructura; no fue producida por `synthetic-manta-v1`. Las estadísticas y frames de los mocks tienen coherencia interna comprobada, pero eso no demuestra el algoritmo generador, reproducibilidad ni impacto de estrategias. No usar estas respuestas como evidencia científica ni como fallback que simule una ejecución real.

JSON Schema comprueba tipos, campos requeridos/desconocidos, enums, rangos absolutos, políticas únicas y algunas condiciones locales: origen node requiere entero; otros orígenes requieren null; estados causales válidos; bootstrap nulo y confianza descriptiva cuando R<30; bootstrap presente cuando R=30.

JSON Schema **no aplica defaults** ni compara valores entre campos. Se implementarán en T-04 relaciones como `vaccines<=populationSize`, `interventionDay<=days` y `origin.value<populationSize`, además de JSON estricto y rechazo de números no finitos en el adapter. T-04 deberá distinguir forma/campo desconocido de errores de valor y usar los estados HTTP acordados. La normalización y validación del dominio no se sustituyen por estas pruebas estáticas.

La correspondencia de conteos con frames, n de estadísticas, extinción, orden, índices, hash real, recomendación y coherencia entre réplicas pertenece al motor/API y sus pruebas futuras. Los tests actuales revisan esas relaciones solo sobre mocks de muestra. El 200 de compare exige resultado completo; 413 no trunca grafos ni devuelve éxito parcial.

## Verificación

Con el entorno instalado, desde `backend/`:

```powershell
..\.tools\bin\uv.exe run --locked --offline --cache-dir ../.uv-cache pytest tests -q
..\.tools\bin\uv.exe run --locked --offline --cache-dir ../.uv-cache openapi-spec-validator ../schemas/openapi.yaml
```

Las pruebas validan todos los JSON Schemas y ejemplos, la especificación OpenAPI, sus referencias a ejemplos y casos negativos. No invocan AWS ni handlers. Resultado observado y ciclo rojo/verde en [la evidencia de T-03](../docs/evidencia/backend-contratos.md).

Referencias: [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0.html), [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12), [registro local de python-jsonschema](https://python-jsonschema.readthedocs.io/en/stable/referencing/).
