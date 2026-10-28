# P-04: publicar y probar los trabajos AWS

Main desplegado el 28/10/2026 con P-04. La prueba AWS de 100 réplicas y el
flujo en navegador pasaron; 1000 réplicas y costos completos siguen pendientes.
Ver [evidencia y URL actuales](../docs/evidencia/despliegue-main-p04-2026-10-28.md).

## Recursos y límites

Con `enable_aws_jobs=true` se agregan S3 privado, DynamoDB, cinco Lambdas de
trabajos (API, preparación, worker, agregación y fallo), Standard Distributed Map
y recuperación de estados terminales por EventBridge. La API conserva las cuatro
rutas `/v1/jobs` de P-03. Resultado: enlace GET S3 firmado durante cinco minutos.
No compartir enlaces ni credenciales de trabajos.

- 2..1000 réplicas por trabajo; cada réplica ejecuta none/random/targeted pareadas.
- Un trabajo activo; dos workers simultáneos; cinco réplicas por lote.
- Tres trabajos nuevos por día UTC, contador atómico compartido por todo el stack.
  Reintentar la misma clave/capacidad no vuelve a consumir admisión.
- Máximo 50 000 000 arista-día-réplica. Para probar 1000 se usa N60/T7, no se
  promete 1000 réplicas para cualquier población/horizonte.
- Worker 3008 MB/120 s; agregado 3008 MB/300 s; flujo máximo una hora.
- Un reintento de errores transitorios de invocación por lote. No redrive manual
  automático; no reintentar una simulación fallida cambiando índice o semilla.
- Metadatos expiran a las 24 h; la aplicación comprueba la expiración aunque TTL
  todavía no haya borrado el registro. Hasta seis trabajos pueden solaparse en
  retención al cruzar días UTC. S3 elimina artefactos con lifecycle de un día,
  cuya limpieza física no es instantánea.
- Si nadie sondea, EventBridge recupera fallos/timeouts y libera el bloqueo. Como
  última protección, la lease del bloqueo vence a los 4200 segundos.
- Los artefactos están sujetos a 32 MiB descomprimidos; un resultado que lo exceda
  falla, no se publica como resultado parcial.

Estos son límites operativos, no un techo monetario. Un tercero con acceso al
sitio podría ocupar las tres admisiones del día: no hay autenticación de usuarios
ni cuota individual. No presentar este staging como servicio público sin límites
o presupuesto garantizado. Budget USD20 no detiene consumo.

## Publicar, con autorización de despliegue

Seguir [CICLO-DESPLIEGUE.md](CICLO-DESPLIEGUE.md), agregando al **plan**:

```powershell
terraform -chdir=infra plan "-var=backend_zip_path=$package" "-var=build_commit=$commit" -var="compare_reserved_concurrency=-1" -var="enable_aws_jobs=true" -out="p04.tfplan"
```

Revisar y aplicar ese plan; después compilar/publicar frontend con los outputs
actuales. No aplicar el plan de validación local que usa un commit descriptivo:
regenerar ZIP y plan con el SHA real que se publicará. Habilitar P-04 no inicia
experimentos automáticamente.

Comprobar `/config`: `features.asyncJobs:true`, `jobBackend:aws`, máximos
1000 réplicas y un trabajo activo. Probar creación, progreso, resultado,
cancelación e idempotencia con una sesión nueva de navegador. El resultado se
descarga desde S3; la capacidad de trabajo nunca se envía a S3.

## Prueba acotada y prueba grande separada

Con autorización para ese consumo:

```powershell
node --experimental-strip-types scripts/verify_aws_jobs.mjs $outputs.api_base_url.value 100
# Revisar duración, registros, errores y costos del lote anterior antes de continuar.
node --experimental-strip-types scripts/verify_aws_jobs.mjs $outputs.api_base_url.value 1000 --allow-large
```

Cada comando crea un solo trabajo y comprueba que repetir la solicitud devuelve
el mismo ID. Guarda resultado y estado en `.tools/p04-aws-*/`; no guarda tokens
ni URLs firmadas. Ante error intenta cancelar el trabajo conocido. No cerrar
abruptamente el proceso: revisar estado/cancelar desde PRO si se interrumpe.

Registrar duración, número de workers/transiciones, bytes S3 y memoria/tiempo
facturable Lambda. Cost Explorer puede demorarse; no sustituir costo real por
créditos disponibles. Conservar pérdidas, empates y resultados desfavorables.
Usar el Python y dependencias registrados en el manifiesto para reproducir.

## Retirada

El plan destroy de la aplicación retira también estos recursos y los archivos
del bucket efímero de resultados (`force_destroy=true`). Exportar antes cualquier
resultado que se quiera conservar; detener trabajos activos antes de retirar.
El bootstrap privado de estado y el Budget siguen separados y se conservan.
